import os
import io
import json
import math
import asyncio
import time as _time
from typing import AsyncGenerator

from openai import OpenAI

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

# Token estimation
CHARS_PER_TOKEN = 4  # rough approximation for English text
MAX_INPUT_TOKENS = 100_000  # conservative context budget for document text

# Rate-limit-aware scheduling (TPM configurable via env)
PROMPT_OVERHEAD_TOKENS = 600
RATE_LIMIT_TPM = int(os.getenv("OPENAI_RATE_LIMIT_TPM", "200000"))
SAFETY_FACTOR = 0.80
EFFECTIVE_TPM = int(RATE_LIMIT_TPM * SAFETY_FACTOR)

MODEL = "gpt-4.1"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    return OpenAI(api_key=api_key)


def _estimate_tokens(text: str) -> int:
    """Rough token count from character length."""
    return max(1, len(text) // CHARS_PER_TOKEN)


def _extract_pdf_text(file_bytes: bytes) -> list[tuple[int, str]]:
    """Extract text from every PDF page.  Returns [(1-indexed page, text), ...]."""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]


def _format_page_text(pages: list[tuple[int, str]]) -> str:
    """Join extracted page texts with clear page markers."""
    parts = []
    for page_num, text in pages:
        text = text.strip()
        if text:
            parts.append(f"--- Page {page_num} ---\n{text}")
    return "\n\n".join(parts)


def _build_image_content(file_bytes: bytes, media_type: str) -> list[dict]:
    """Build OpenAI vision content blocks for an image."""
    import base64
    data = base64.standard_b64encode(file_bytes).decode("ascii")
    return [
        {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{data}"}},
        {"type": "text", "text": "Generate flashcards from this image."},
    ]


def _parse_json_response(raw_text: str) -> list[dict]:
    """Strip optional markdown fences and parse the JSON array."""
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw_text = "\n".join(lines)
    return json.loads(raw_text)


def _build_system_prompt(
    card_count: int,
    answer_count: int,
    min_correct: int,
    max_correct: int,
    difficulty: str,
    page_range: tuple[int, int] | None = None,
) -> str:
    label = DIFFICULTY_LABELS.get(difficulty, "Normal")
    instruction = DIFFICULTY_PROMPTS.get(difficulty, DIFFICULTY_PROMPTS["normal"])

    page_note = ""
    if page_range:
        page_note = (
            f"\nIMPORTANT: The text below covers pages {page_range[0]}–{page_range[1]} "
            f"of the original document. All sourceRef page numbers MUST refer to the "
            f"original document page numbers.\n"
        )

    return (
        f"You are a flashcard generator. Analyze the provided content carefully and "
        f"generate exactly {card_count} multiple-choice questions.\n"
        f"{page_note}\n"
        f"Difficulty level: {label}\n"
        f"Difficulty instruction: {instruction}\n\n"
        f"Additional rules:\n"
        f"- Each question must have exactly {answer_count} answer options\n"
        f"- For each question, randomly choose the number of correct answers uniformly "
        f"from {min_correct} to {max_correct} (inclusive). Distribute evenly across the "
        f"set — roughly equal numbers of questions for each possible correct-answer count\n"
        f"- For each answer option, provide a short 'explanation' field (1-2 sentences) "
        f"explaining WHY this answer is correct or WHY it is wrong\n"
        f'- For sourceRef, give a precise location (e.g. "Page 3 – Introduction", '
        f'"Section 2.1", "Paragraph about X")\n\n'
        f"Respond ONLY with a raw JSON array. No markdown fences, no explanation:\n"
        f'[{{"question":"...","answers":[{{"text":"...","isCorrect":true,"explanation":"..."}},'
        f'{{"text":"...","isCorrect":false,"explanation":"..."}}],"sourceRef":"..."}}]'
    )


async def _call_llm(system_prompt: str, user_content) -> str:
    """Call OpenAI Chat Completions in a background thread.  Returns raw text."""
    client = _get_client()

    if isinstance(user_content, str):
        user_msg = {"role": "user", "content": user_content}
    else:
        # list of content blocks (image + text)
        user_msg = {"role": "user", "content": user_content}

    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.chat.completions.create(
            model=MODEL,
            max_tokens=16384,
            messages=[
                {"role": "system", "content": system_prompt},
                user_msg,
            ],
        ),
    )
    return response.choices[0].message.content.strip()


# ---------------------------------------------------------------------------
# Single-call generation
# ---------------------------------------------------------------------------

async def _generate_single_difficulty(
    file_bytes: bytes,
    media_type: str,
    card_count: int,
    answer_count: int,
    min_correct: int,
    max_correct: int,
    difficulty: str,
) -> list[dict]:
    """Generate cards for a single difficulty level (non-chunked)."""
    system_prompt = _build_system_prompt(
        card_count, answer_count, min_correct, max_correct, difficulty,
    )

    if media_type == PDF_MEDIA_TYPE:
        pages = _extract_pdf_text(file_bytes)
        user_content = _format_page_text(pages)
    else:
        user_content = _build_image_content(file_bytes, media_type)

    raw_text = await _call_llm(system_prompt, user_content)
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


def _group_pages(
    pages: list[tuple[int, str]], num_groups: int,
) -> list[list[tuple[int, str]]]:
    """Split pages into *num_groups* roughly-equal contiguous groups."""
    total = len(pages)
    base = total // num_groups
    remainder = total % num_groups
    groups: list[list[tuple[int, str]]] = []
    offset = 0
    for i in range(num_groups):
        length = base + (1 if i < remainder else 0)
        groups.append(pages[offset : offset + length])
        offset += length
    return groups


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------

def _estimate_chunk_tokens(text: str) -> int:
    """Estimate input tokens for a text chunk sent to OpenAI."""
    return _estimate_tokens(text) + PROMPT_OVERHEAD_TOKENS


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
# Chunked generation with SSE progress
# ---------------------------------------------------------------------------

def needs_chunking(media_type: str, card_count: int, file_bytes: bytes) -> bool:
    if media_type != PDF_MEDIA_TYPE or card_count <= CHUNK_SIZE:
        return False
    pages = _extract_pdf_text(file_bytes)
    total_tokens = sum(_estimate_tokens(text) for _, text in pages)
    return total_tokens > MAX_INPUT_TOKENS or len(pages) > MIN_PAGES_FOR_CHUNKING


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

    Text is extracted from the PDF up-front, grouped into page chunks,
    and sent **sequentially** with rate limiting.
    """

    normal_count, hard_count = _split_by_ratio(card_count, hard_ratio)

    batches: list[tuple[str, int]] = []
    if normal_count > 0:
        batches.append(("normal", normal_count))
    if hard_count > 0:
        batches.append(("hard", hard_count))

    # Extract text once
    all_pages = _extract_pdf_text(file_bytes)

    # Build ordered chunk definitions: (text, page_start, page_end, q_count, difficulty, est_tokens)
    chunks: list[tuple] = []

    for difficulty, count in batches:
        num_sections = math.ceil(count / CHUNK_SIZE)
        groups = _group_pages(all_pages, num_sections)

        base_q = count // num_sections
        extra_q = count % num_sections
        qs_per = [base_q + (1 if i < extra_q else 0) for i in range(num_sections)]

        for idx, group in enumerate(groups):
            text = _format_page_text(group)
            est_tokens = _estimate_chunk_tokens(text)
            page_start = group[0][0] if group else 1
            page_end = group[-1][0] if group else 1
            chunks.append((text, page_start, page_end, qs_per[idx], difficulty, est_tokens))

    total_sections = len(chunks)
    total_tokens = sum(c[5] for c in chunks)
    estimated_total_seconds = max(30, (total_tokens / EFFECTIVE_TPM) * 60)

    limiter = _TokenRateLimiter(EFFECTIVE_TPM)
    all_cards: list[dict] = []
    completed = 0
    start_wall = _time.monotonic()

    def _progress_event(remaining_secs: float) -> str:
        return f"data: {json.dumps({'type': 'progress', 'completed': completed, 'total': total_sections, 'estimatedTotalSeconds': round(estimated_total_seconds), 'estimatedRemainingSeconds': round(max(0, remaining_secs))})}\n\n"

    # Initial progress
    yield _progress_event(estimated_total_seconds)

    for text, page_start, page_end, q_count, difficulty, est_tokens in chunks:
        await limiter.acquire(est_tokens)

        system_prompt = _build_system_prompt(
            q_count, answer_count, min_correct, max_correct, difficulty,
            page_range=(page_start, page_end),
        )
        raw = await _call_llm(system_prompt, text)
        chunk_cards = _parse_json_response(raw)

        for c in chunk_cards:
            c["difficulty"] = difficulty
        all_cards.extend(chunk_cards)
        completed += 1

        elapsed = _time.monotonic() - start_wall
        if completed < total_sections:
            remaining = (elapsed / completed) * (total_sections - completed)
        else:
            remaining = 0

        yield _progress_event(remaining)

    # Final event with all cards
    yield f"data: {json.dumps({'type': 'complete', 'documentId': document_id, 'cards': all_cards})}\n\n"
