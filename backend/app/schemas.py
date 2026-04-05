from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AnswerSchema(BaseModel):
    id: Optional[str] = None
    text: str
    isCorrect: bool = Field(alias="isCorrect")
    explanation: Optional[str] = None

    model_config = {"populate_by_name": True}


class CardCreate(BaseModel):
    question: str
    answers: list[AnswerSchema]
    sourceRef: str = Field(default="", alias="sourceRef")
    difficulty: str = "normal"
    documentId: Optional[str] = Field(default=None, alias="documentId")

    model_config = {"populate_by_name": True}


class CardUpdate(BaseModel):
    question: Optional[str] = None
    answers: Optional[list[AnswerSchema]] = None
    sourceRef: Optional[str] = Field(default=None, alias="sourceRef")
    difficulty: Optional[str] = None
    correct: Optional[int] = None
    wrong: Optional[int] = None

    model_config = {"populate_by_name": True}


class StatsSchema(BaseModel):
    correct: int
    wrong: int


class SrsState(BaseModel):
    interval: int = 1
    repetitions: int = 0
    easeFactor: float = Field(default=2.5, alias="easeFactor")
    lapses: int = 0
    lastReviewedAt: int = Field(default=0, alias="lastReviewedAt")
    lastResult: Optional[str] = Field(default=None, alias="lastResult")

    model_config = {"populate_by_name": True}


class CardResponse(BaseModel):
    id: str
    question: str
    answers: list[AnswerSchema]
    sourceRef: str
    difficulty: str
    stats: StatsSchema
    srs: SrsState
    createdAt: datetime
    documentId: Optional[str] = None
    documentFilename: Optional[str] = Field(default=None, alias="documentFilename")
    approved: bool = True

    model_config = {"populate_by_name": True, "from_attributes": True}


class AnswerSubmission(BaseModel):
    isCorrect: bool = Field(alias="isCorrect")
    responseTimeMs: int = Field(alias="responseTimeMs")
    answerCount: int = Field(alias="answerCount")

    model_config = {"populate_by_name": True}


class AnswerResult(BaseModel):
    cardId: str = Field(alias="cardId")
    srs: SrsState
    turnCounter: int = Field(alias="turnCounter")
    wasCorrect: bool = Field(alias="wasCorrect")

    model_config = {"populate_by_name": True}


class CardDraftAnswer(BaseModel):
    text: str
    isCorrect: bool
    explanation: Optional[str] = None


class CardDraft(BaseModel):
    question: str
    answers: list[CardDraftAnswer]
    sourceRef: str = ""


class ActivityPoint(BaseModel):
    label: str
    count: int


class ProgressPoint(BaseModel):
    date: str
    total: int
    correct: int
    wrong: int
    unanswered: int


class StatsResponse(BaseModel):
    hourly: list[ActivityPoint]
    daily: list[ActivityPoint]
    cumulative: list[ActivityPoint]
    progress: list[ProgressPoint]


class DocumentCardStats(BaseModel):
    total: int
    new: int
    correct: int
    wrong: int


class DocumentResponse(BaseModel):
    id: str
    filename: str
    mediaType: str = Field(alias="mediaType")
    createdAt: datetime = Field(alias="createdAt")
    cardStats: DocumentCardStats = Field(alias="cardStats")

    model_config = {"populate_by_name": True, "from_attributes": True}
