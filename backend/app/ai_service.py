import os
import io
import json
import math
import asyncio
import time as _time
from typing import AsyncGenerator

import anthropic

DIFFICULTY_PROMPTS = {
    "normal": "Clear, direct questions testing basic comprehension and recall of key concepts. Questions should be unambiguous and fair.",
    "hard": "Challenging questions requiring deep understanding, critical analysis, and the ability to apply and connect concepts. Include non-obvious nuances. Wrong answer options should be highly plausible.",
}

DIFFICULTY_LABELS = {
    "normal": "Normal",
    "hard": "Hard",
}

PDF_MEDIA_TYPE = "application/pdf"
IMAGE_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

CHUNK_SIZE = 25  # max questions per LLM call
MIN_PAGES_FOR_CHUNKING = 20

# Rate-limit-aware scheduling
TOKENS_PER_PDF_PAGE = 2000    # rough avg input tokens per PDF page
PROMPT_OVERHEAD_TOKENS = 600  # estimated tokens for the system/user text
RATE_LIMIT_TPM = 30_000       # Anthropic org rate limit (input tokens/min)
SAFETY_FACTOR = 0.80          # use 80% of budget to stay safe
EFFECTIVE_TPM = int(RATE_LIMIT_TPM * SAFETY_FACTOR)


def _build_content_block(file_bytes: bytes, media_type: str) -> dict:
    import base64
    data = base64.standard_b64encode(file_bytes).decode("ascii")

    if media_type == PDF_MEDIA_TYPE:
        return {
            "type": "document",
            "source": {"type": "base64", "media_type": PDF_MEDIA_TYPE, "data": data},
        }
    else:
        return {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": data},
        }


def _parse_json_response(raw_text: str) -> list[dict]:
    """Strip optional markdown fences and parse the JSON array."""
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw_text = "\n".join(lines)
    return json.loads(raw_text)


async def _generate_single_difficulty(
    file_bytes: bytes,
    media_type: str,
    card_count: int,
    answer_count: int,
    min_correct: int,
    max_correct: int,
    difficulty: str,
) -> list[dict]:
    """Generate cards for a single difficulty level (simple, non-chunked)."""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    label = DIFFICULTY_LABELS.get(difficulty, "Normal")
    instruction = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["normal"])

    system_prompt = (
        f"You are a flashcard generator. Analyze the provided content carefully and generate exactly {card_count} multiple-choice questions.\n\n"
        f"Difficulty level: {label}\n"
        f"Difficulty instruction: {instruction}\n\n"
        f"Additional rules:\n"
        f"- Each question must have exactly {answer_count} answer options\n"
        f"- For each question, randomly choose the number of correct answers uniformly from {min_correct} to {max_correct} (inclusive). Distribute evenly across the set — roughly equal numbers of questions for each possible correct-answer count)\n"
        f"- For each answer option, provide a short 'explanation' field (1-2 sentences) explaining WHY this answer is correct or WHY it is wrong\n"
        f'- For sourceRef, give a precise location (e.g. "Page 3 – Introduction", "Section 2.1", "Paragraph about X")\n\n'
        f"Respond ONLY with a raw JSON array. No markdown fences, no explanation:\n"
        f'[{{"question":"...","answers":[{{"text":"...","isCorrect":true,"explanation":"..."}},{{"text":"...","isCorrect":false,"explanation":"..."}}],"sourceRef":"..."}}]'
    )

    content_block = _build_content_block(file_bytes, media_type)

    extra_headers = {}
    if media_type == PDF_MEDIA_TYPE:
        extra_headers["anthropic-beta"] = "pdfs-2024-09-25"

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=16384,
        extra_headers=extra_headers if extra_headers else None,
        messages=[
            {
                "role": "user",
                "content": [
                    content_block,
                    {"type": "text", "text": system_prompt},
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()
    return _parse_json_response(raw_text)


def _split_by_ratio(card_count: int, hard_ratio: int) -> tuple[int, int]:
    """Return (normal_count, hard_count) that sum to card_count."""
    hard_ratio = max(0, min(100, hard_ratio))
    normal_count = round(card_count * (100 - hard_ratio) / 100)
    hard_count = card_count - normal_count
    return normal_count, hard_count


async def generate_cards(
    file_bytes: bytes,
    media_type: str,
    card_count: int,
    answer_count: int,
    min_correct: int,
    max_correct: int,
    hard_ratio: int = 50,
) -> list[dict]:
    normal_count, hard_count = _split_by_ratio(card_count, hard_ratio)

    all_cards: list[dict] = []

    if normal_count > 0:
        cards = await _generate_single_difficulty(
            file_bytes, media_type, normal_count, answer_count,
            min_correct, max_correct, "normal",
        )
        for c in cards:
            c["difficulty"] = "normal"
        all_cards.extend(cards)

    if hard_count > 0:
        cards = await _generate_single_difficulty(
            file_bytes, media_type, hard_count, answer_count,
            min_correct, max_correct, "hard",
        )
        for c in cards:
            c["difficulty"] = "hard"
        all_cards.extend(cards)

    return all_cards


# ---------------------------------------------------------------------------
# PDF page helpers
# ---------------------------------------------------------------------------

def count_pdf_pages(file_bytes: bytes) -> int:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    return len(reader.pages)


def split_pdf(file_bytes: bytes, num_sections: int) -> list[tuple[bytes, int, int]]:
    """Split a PDF into *num_sections* roughly-equal parts.

    Returns a list of (section_bytes, start_page, end_page) where pages
    are 1-indexed and refer to the original document.
    """
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(io.BytesIO(file_bytes))
    total = len(reader.pages)
    base_size = total // num_sections
    remainder = total % num_sections

    sections: list[tuple[bytes, int, int]] = []
    offset = 0
    for i in range(num_sections):
        length = base_size + (1 if i < remainder else 0)
        writer = PdfWriter()
        for p in range(offset, offset + length):
            writer.add_page(reader.pages[p])
        buf = io.BytesIO()
        writer.write(buf)
        sections.append((buf.getvalue(), offset + 1, offset + length))  # 1-indexed
        offset += length

    return sections


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

def _estimate_chunk_tokens(page_count: int) -> int:
    """Rough estimate of input tokens for a PDF chunk sent to Anthropic."""
    return page_count * TOKENS_PER_PDF_PAGE + PROMPT_OVERHEAD_TOKENS


class _TokenRateLimiter:
    """Sliding-window token rate limiter (per minute)."""

    def __init__(self, tokens_per_minute: int):
        self.tpm = tokens_per_minute
        self._log: list[tuple[float, int]] = []

    def _purge(self, now: float):
        cutoff = now - 60.0
        self._log = [(t, n) for t, n in self._log if t > cutoff]

    async def acquire(self, tokens: int) -> float:
        """Block until *tokens* fit in the rolling window. Returns seconds waited."""
        waited = 0.0
        while True:
            now = _time.monotonic()
            self._purge(now)
            used = sum(n for _, n in self._log)
            if used + tokens <= self.tpm:
                self._log.append((now, tokens))
                return waited
            oldest = self._log[0][0] if self._log else now
            delay = max(0.5, (oldest + 60.0) - now + 0.5)
            await asyncio.sleep(delay)
            waited += delay


# ---------------------------------------------------------------------------
# Chunk-level generation (single section → cards)
# ---------------------------------------------------------------------------

async def _generate_chunk(
    chunk_bytes: bytes,
    media_type: str,
    card_count: int,
    answer_count: int,
    min_correct: int,
    max_correct: int,
    difficulty: str,
    page_start: int,
    page_end: int,
) -> list[dict]:
    """Generate cards for one PDF section, running the Anthropic call in a
    thread so the event loop stays responsive."""

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable is not set")

    label = DIFFICULTY_LABELS.get(difficulty, "Normal")
    instruction = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["normal"])

    system_prompt = (
        f"You are a flashcard generator. Analyze the provided content carefully and generate exactly {card_count} multiple-choice questions.\n\n"
        f"IMPORTANT: This PDF excerpt contains pages {page_start}–{page_end} of the original document. "
        f"All sourceRef page numbers MUST refer to the original document page numbers "
        f"(i.e. page 1 of this excerpt is page {page_start} in the original).\n\n"
        f"Difficulty level: {label}\n"
        f"Difficulty instruction: {instruction}\n\n"
        f"Additional rules:\n"
        f"- Each question must have exactly {answer_count} answer options\n"
        f"- For each question, randomly choose the number of correct answers uniformly from {min_correct} to {max_correct} (inclusive). Distribute evenly across the set — roughly equal numbers of questions for each possible correct-answer count)\n"
        f"- For each answer option, provide a short 'explanation' field (1-2 sentences) explaining WHY this answer is correct or WHY it is wrong\n"
        f'- For sourceRef, give a precise location referencing the ORIGINAL page numbers (e.g. "Page {page_start} – Introduction", "Page {page_end} – Summary")\n\n'
        f"Respond ONLY with a raw JSON array. No markdown fences, no explanation:\n"
        f'[{{"question":"...","answers":[{{"text":"...","isCorrect":true,"explanation":"..."}},{{"text":"...","isCorrect":false,"explanation":"..."}}],"sourceRef":"..."}}]'
    )

    content_block = _build_content_block(chunk_bytes, media_type)
    extra_headers = {"anthropic-beta": "pdfs-2024-09-25"}
    client = anthropic.Anthropic(api_key=api_key)

    loop = asyncio.get_running_loop()
    message = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=16384,
            extra_headers=extra_headers,
            messages=[
                {
                    "role": "user",
                    "content": [
                        content_block,
                        {"type": "text", "text": system_prompt},
                    ],
                }
            ],
        ),
    )

    raw_text = message.content[0].text.strip()
    return _parse_json_response(raw_text)


# ---------------------------------------------------------------------------
# Chunked generation with SSE progress
# ---------------------------------------------------------------------------

def needs_chunking(media_type: str, card_count: int, file_bytes: bytes) -> bool:
    if media_type != PDF_MEDIA_TYPE or card_count <= CHUNK_SIZE:
        return False
    return count_pdf_pages(file_bytes) > MIN_PAGES_FOR_CHUNKING


async def generate_cards_chunked(
    file_bytes: bytes,
    media_type: str,
    card_count: int,
    answer_count: int,
    min_correct: int,
    max_correct: int,
    hard_ratio: int,
    document_id: str,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted events as chunks complete.

    Chunks are processed **sequentially** with a sliding-window token rate
    limiter so we never exceed the Anthropic 30 k input-tokens/min limit.
    Each progress event includes an ETA so the frontend can show a
    meaningful timer.
    """

    normal_count, hard_count = _split_by_ratio(card_count, hard_ratio)

    batches: list[tuple[str, int]] = []
    if normal_count > 0:
        batches.append(("normal", normal_count))
    if hard_count > 0:
        batches.append(("hard", hard_count))

    # Build ordered list of chunk definitions
    ChunkDef = tuple  # (chunk_bytes, start, end, q_count, difficulty, est_tokens)
    chunks: list[ChunkDef] = []

    for difficulty, count in batches:
        num_sections = math.ceil(count / CHUNK_SIZE)
        sections = split_pdf(file_bytes, num_sections)

        base_q = count // num_sections
        extra_q = count % num_sections
        questions_per_section = [
            base_q + (1 if i < extra_q else 0) for i in range(num_sections)
        ]

        for idx, (chunk_bytes_sec, start, end) in enumerate(sections):
            page_count = end - start + 1
            est_tokens = _estimate_chunk_tokens(page_count)
            chunks.append(
                (chunk_bytes_sec, start, end,
                 questions_per_section[idx], difficulty, est_tokens)
            )

    total_sections = len(chunks)
    total_tokens = sum(c[5] for c in chunks)
    # Pre-compute a rough ETA (seconds) based on token budget
    estimated_total_seconds = max(30, (total_tokens / EFFECTIVE_TPM) * 60)

    limiter = _TokenRateLimiter(EFFECTIVE_TPM)
    all_cards: list[dict] = []
    completed = 0
    start_wall = _time.monotonic()

    def _progress_event(remaining_secs: float) -> str:
        return f"data: {json.dumps({'type': 'progress', 'completed': completed, 'total': total_sections, 'estimatedTotalSeconds': round(estimated_total_seconds), 'estimatedRemainingSeconds': round(max(0, remaining_secs))})}\n\n"

    # Initial progress
    yield _progress_event(estimated_total_seconds)

    for chunk_bytes_sec, start, end, q_count, difficulty, est_tokens in chunks:
        # Respect rate limit – may sleep here
        await limiter.acquire(est_tokens)

        chunk_cards = await _generate_chunk(
            chunk_bytes_sec, media_type, q_count,
            answer_count, min_correct, max_correct, difficulty,
            start, end,
        )
        for c in chunk_cards:
            c["difficulty"] = difficulty
        all_cards.extend(chunk_cards)
        completed += 1

        # Compute ETA from observed pace
        elapsed = _time.monotonic() - start_wall
        if completed < total_sections:
            avg_per_chunk = elapsed / completed
            remaining = avg_per_chunk * (total_sections - completed)
        else:
            remaining = 0

        yield _progress_event(remaining)

    # Final event with all cards
    yield f"data: {json.dumps({'type': 'complete', 'documentId': document_id, 'cards': all_cards})}\n\n"
