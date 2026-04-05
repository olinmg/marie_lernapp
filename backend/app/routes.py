import uuid
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .database import get_db
from .models import CardModel, AnswerModel, DocumentModel, GlobalStateModel, StudyEventModel
from .schemas import (
    CardCreate, CardUpdate, CardResponse, StatsSchema, SrsState, AnswerSchema,
    CardDraft, AnswerSubmission, AnswerResult, ActivityPoint, ProgressPoint, StatsResponse,
)
from .ai_service import generate_cards, generate_cards_chunked, needs_chunking, PDF_MEDIA_TYPE, IMAGE_MEDIA_TYPES
from .auth import require_auth, verify_password, create_token
from pydantic import BaseModel as _BaseModel

router = APIRouter(prefix="/api")


class _LoginRequest(_BaseModel):
    password: str


@router.post("/auth/login")
async def login(body: _LoginRequest):
    if not verify_password(body.password):
        raise HTTPException(401, "Wrong password")
    return {"token": create_token()}


@router.get("/auth/verify")
async def verify_token(_: None = Depends(require_auth)):
    return {"ok": True}

ALLOWED_MEDIA_TYPES = {PDF_MEDIA_TYPE} | IMAGE_MEDIA_TYPES


def _card_to_response(card: CardModel) -> CardResponse:
    return CardResponse(
        id=card.id,
        question=card.question,
        answers=[
            AnswerSchema(id=a.id, text=a.text, isCorrect=a.is_correct, explanation=a.explanation)
            for a in card.answers
        ],
        sourceRef=card.source_ref,
        difficulty=card.difficulty,
        stats=StatsSchema(correct=card.correct, wrong=card.wrong),
        srs=SrsState(
            interval=card.interval,
            repetitions=card.repetitions,
            easeFactor=card.ease_factor,
            lapses=card.lapses,
            lastReviewedAt=card.last_reviewed_at,
            lastResult=card.last_result,
        ),
        createdAt=card.created_at,
        documentId=card.document_id,
    )


def _derive_rating(is_correct: bool, response_time_ms: int, answer_count: int) -> int:
    if not is_correct:
        return 1
    # Guess detection for multiple-choice
    if answer_count > 1 and response_time_ms < 800:
        return 3
    if response_time_ms < 3000:
        return 5
    if response_time_ms < 8000:
        return 4
    return 3


def _update_card_srs(card: CardModel, rating: int, turn_counter: int) -> CardModel:
    if rating >= 3:
        if card.repetitions == 0:
            card.interval = 1
        elif card.repetitions == 1:
            card.interval = 6
        else:
            card.interval = round(card.interval * card.ease_factor)
        card.repetitions += 1
    else:
        card.lapses += 1
        card.repetitions = 0
        card.interval = 1

    card.ease_factor += 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)
    card.ease_factor = max(1.3, card.ease_factor)
    card.last_result = "correct" if rating >= 3 else "wrong"
    card.last_reviewed_at = turn_counter
    return card


@router.post("/generate")
async def generate(
    file: UploadFile = File(...),
    card_count: int = Form(...),
    answer_count: int = Form(...),
    min_correct: int = Form(1),
    max_correct: int = Form(4),
    hard_ratio: int = Form(50),
    db: AsyncSession = Depends(get_db),
    _auth: None = Depends(require_auth),
):
    if card_count < 1 or card_count > 500:
        raise HTTPException(400, "card_count must be 1–500")
    if answer_count < 2 or answer_count > 8:
        raise HTTPException(400, "answer_count must be 2–8")
    if min_correct < 1 or max_correct > answer_count - 1 or min_correct > max_correct:
        raise HTTPException(400, "Invalid min_correct / max_correct range")
    if hard_ratio < 0 or hard_ratio > 100:
        raise HTTPException(400, "hard_ratio must be 0–100")

    media_type = file.content_type
    if media_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(400, f"Unsupported file type: {media_type}")

    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(400, "File too large (max 50 MB)")

    # Save document to DB
    doc = DocumentModel(
        id=str(uuid.uuid4()),
        filename=file.filename or "upload",
        media_type=media_type,
        data=file_bytes,
    )
    db.add(doc)
    await db.commit()

    # If large PDF + many questions, use chunked generation with SSE
    if needs_chunking(media_type, card_count, file_bytes):
        return StreamingResponse(
            generate_cards_chunked(
                file_bytes, media_type, card_count, answer_count,
                min_correct, max_correct, hard_ratio, doc.id,
            ),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    try:
        cards = await generate_cards(file_bytes, media_type, card_count, answer_count, min_correct, max_correct, hard_ratio)
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")

    return {"documentId": doc.id, "cards": cards}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    result = await db.execute(select(DocumentModel).where(DocumentModel.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    return Response(
        content=doc.data,
        media_type=doc.media_type,
        headers={"Content-Disposition": f'inline; filename="{doc.filename}"'},
    )


@router.post("/cards", response_model=CardResponse)
async def create_card(card: CardCreate, db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    db_card = CardModel(
        id=str(uuid.uuid4()),
        question=card.question,
        source_ref=card.sourceRef,
        difficulty=card.difficulty,
        document_id=card.documentId,
    )
    for ans in card.answers:
        db_card.answers.append(
            AnswerModel(
                id=str(uuid.uuid4()),
                text=ans.text,
                is_correct=ans.isCorrect,
                explanation=ans.explanation,
            )
        )
    db.add(db_card)
    await db.commit()
    await db.refresh(db_card)
    return _card_to_response(db_card)


@router.get("/cards", response_model=list[CardResponse])
async def list_cards(db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    result = await db.execute(select(CardModel))
    cards = result.scalars().all()
    return [_card_to_response(c) for c in cards]


@router.patch("/cards/{card_id}", response_model=CardResponse)
async def update_card(card_id: str, update: CardUpdate, db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    result = await db.execute(select(CardModel).where(CardModel.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Card not found")

    if update.question is not None:
        card.question = update.question
    if update.sourceRef is not None:
        card.source_ref = update.sourceRef
    if update.difficulty is not None:
        card.difficulty = update.difficulty
    if update.correct is not None:
        card.correct = update.correct
    if update.wrong is not None:
        card.wrong = update.wrong
    if update.answers is not None:
        # Replace all answers
        for old in card.answers:
            await db.delete(old)
        card.answers = []
        for ans in update.answers:
            card.answers.append(
                AnswerModel(
                    id=str(uuid.uuid4()),
                    text=ans.text,
                    is_correct=ans.isCorrect,
                    explanation=ans.explanation,
                )
            )

    await db.commit()
    await db.refresh(card)
    return _card_to_response(card)


@router.delete("/cards/{card_id}", status_code=204)
async def delete_card(card_id: str, db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    result = await db.execute(select(CardModel).where(CardModel.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Card not found")
    await db.delete(card)
    await db.commit()


@router.post("/cards/{card_id}/answer", response_model=AnswerResult)
async def submit_answer(card_id: str, body: AnswerSubmission, db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    result = await db.execute(select(CardModel).where(CardModel.id == card_id))
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Card not found")

    # Load global state
    state_result = await db.execute(select(GlobalStateModel).where(GlobalStateModel.id == 1))
    state = state_result.scalar_one_or_none()
    if not state:
        state = GlobalStateModel(id=1, turn_counter=0)
        db.add(state)

    rating = _derive_rating(body.isCorrect, body.responseTimeMs, body.answerCount)
    _update_card_srs(card, rating, state.turn_counter)

    # Update legacy stats
    if body.isCorrect:
        card.correct += 1
    else:
        card.wrong += 1

    state.turn_counter += 1

    # Record study event for statistics
    db.add(StudyEventModel(card_id=card.id, is_correct=body.isCorrect))

    await db.commit()
    await db.refresh(card)

    return AnswerResult(
        cardId=card.id,
        srs=SrsState(
            interval=card.interval,
            repetitions=card.repetitions,
            easeFactor=card.ease_factor,
            lapses=card.lapses,
            lastReviewedAt=card.last_reviewed_at,
            lastResult=card.last_result,
        ),
        turnCounter=state.turn_counter,
        wasCorrect=body.isCorrect,
    )


@router.get("/state")
async def get_state(db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    result = await db.execute(select(GlobalStateModel).where(GlobalStateModel.id == 1))
    state = result.scalar_one_or_none()
    return {"turnCounter": state.turn_counter if state else 0}


@router.get("/stats", response_model=StatsResponse)
async def get_stats(db: AsyncSession = Depends(get_db), _auth: None = Depends(require_auth)):
    # Load all study events
    ev_result = await db.execute(
        select(StudyEventModel).order_by(StudyEventModel.answered_at)
    )
    events = ev_result.scalars().all()

    # Load all cards (id + created_at only)
    card_result = await db.execute(select(CardModel))
    cards = card_result.scalars().all()

    now = datetime.now(timezone.utc)

    # --- Activity: hourly (last 48h) ---
    cutoff_48h = now - timedelta(hours=48)
    hourly_counts: dict[str, int] = defaultdict(int)
    for ev in events:
        ev_time = ev.answered_at
        if ev_time.tzinfo is None:
            ev_time = ev_time.replace(tzinfo=timezone.utc)
        if ev_time >= cutoff_48h:
            label = ev_time.strftime("%m/%d %H:00")
            hourly_counts[label] += 1
    # Fill gaps for last 48 hours
    hourly: list[ActivityPoint] = []
    for h in range(48, -1, -1):
        t = now - timedelta(hours=h)
        label = t.strftime("%m/%d %H:00")
        hourly.append(ActivityPoint(label=label, count=hourly_counts.get(label, 0)))

    # --- Activity: daily (all time) ---
    daily_counts: dict[str, int] = defaultdict(int)
    for ev in events:
        ev_time = ev.answered_at
        if ev_time.tzinfo is None:
            ev_time = ev_time.replace(tzinfo=timezone.utc)
        label = ev_time.strftime("%Y-%m-%d")
        daily_counts[label] += 1

    # Fill gaps from first event date to today
    # --- Compute shared date range for daily/cumulative/progress ---
    # Build card creation dates (needed by progress, but date range needed now)
    card_created: dict[str, datetime] = {}
    for c in cards:
        ct = c.created_at
        if ct.tzinfo is None:
            ct = ct.replace(tzinfo=timezone.utc)
        card_created[c.id] = ct

    today = now.date()
    # Earliest date = min of first event date and first card creation date
    range_start = None
    if daily_counts:
        range_start = datetime.strptime(min(daily_counts.keys()), "%Y-%m-%d").date()
    if card_created:
        first_card_date = min(ct.date() for ct in card_created.values())
        range_start = min(range_start, first_card_date) if range_start else first_card_date

    daily: list[ActivityPoint] = []
    cumulative: list[ActivityPoint] = []
    if range_start:
        d = range_start
        running = 0
        while d <= today:
            ds = d.isoformat()
            c = daily_counts.get(ds, 0)
            daily.append(ActivityPoint(label=ds, count=c))
            running += c
            cumulative.append(ActivityPoint(label=ds, count=running))
            d += timedelta(days=1)

    # --- Progress: stacked correct/wrong/unanswered per day ---
    # Build per-card event timeline
    card_events: dict[str, list[tuple[datetime, bool]]] = defaultdict(list)
    for ev in events:
        ev_time = ev.answered_at
        if ev_time.tzinfo is None:
            ev_time = ev_time.replace(tzinfo=timezone.utc)
        card_events[ev.card_id].append((ev_time, ev.is_correct))

    progress: list[ProgressPoint] = []
    if range_start:
        d = range_start
        # Track last result state per card
        last_result: dict[str, str | None] = {cid: None for cid in card_created}
        # Pre-index events by date for efficiency
        events_by_date: dict[str, list[tuple[str, bool]]] = defaultdict(list)
        for ev in events:
            ev_time = ev.answered_at
            if ev_time.tzinfo is None:
                ev_time = ev_time.replace(tzinfo=timezone.utc)
            events_by_date[ev_time.date().isoformat()].append((ev.card_id, ev.is_correct))

        while d <= today:
            ds = d.isoformat()
            # Process events for this day
            for card_id, is_correct in events_by_date.get(ds, []):
                if card_id in last_result:
                    last_result[card_id] = "correct" if is_correct else "wrong"

            # Count cards that exist on this day
            total = 0
            correct_count = 0
            wrong_count = 0
            for cid, created in card_created.items():
                if created.date() <= d:
                    total += 1
                    lr = last_result.get(cid)
                    if lr == "correct":
                        correct_count += 1
                    elif lr == "wrong":
                        wrong_count += 1

            progress.append(ProgressPoint(
                date=ds,
                total=total,
                correct=correct_count,
                wrong=wrong_count,
                unanswered=total - correct_count - wrong_count,
            ))
            d += timedelta(days=1)

    return StatsResponse(
        hourly=hourly,
        daily=daily,
        cumulative=cumulative,
        progress=progress,
    )
