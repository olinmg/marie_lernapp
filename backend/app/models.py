import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class DocumentModel(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    media_type: Mapped[str] = mapped_column(String(100), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    cards: Mapped[list["CardModel"]] = relationship(back_populates="document", lazy="selectin")


class CardModel(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question: Mapped[str] = mapped_column(Text, nullable=False)
    source_ref: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wrong: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    document_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("documents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # SRS fields
    interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    lapses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_reviewed_at: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_result: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default=None)

    answers: Mapped[list["AnswerModel"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", lazy="selectin"
    )
    document: Mapped[Optional["DocumentModel"]] = relationship(back_populates="cards", lazy="selectin")


class AnswerModel(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id"), nullable=False)

    card: Mapped["CardModel"] = relationship(back_populates="answers")


class StudyEventModel(Base):
    __tablename__ = "study_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class GlobalStateModel(Base):
    __tablename__ = "global_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    turn_counter: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
