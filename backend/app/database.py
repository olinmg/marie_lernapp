import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:////app/data/flashlearn.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrations for existing DBs (idempotent — errors ignored if column/row exists)
        migrations = [
            "ALTER TABLE answers ADD COLUMN explanation TEXT",
            "ALTER TABLE cards ADD COLUMN interval INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE cards ADD COLUMN repetitions INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE cards ADD COLUMN ease_factor REAL NOT NULL DEFAULT 2.5",
            "ALTER TABLE cards ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE cards ADD COLUMN last_reviewed_at INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE cards ADD COLUMN last_result VARCHAR(20)",
        ]
        for sql in migrations:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass

        # Seed global_state row if it doesn't exist
        try:
            await conn.execute(
                text("INSERT INTO global_state (id, turn_counter) VALUES (1, 0)")
            )
        except Exception:
            pass
