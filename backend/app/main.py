import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from .database import init_db
from .routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .auth import APP_PASSWORD, SECRET_KEY
    print(f"APP_PASSWORD loaded: {'yes' if APP_PASSWORD else 'NO - MISSING'}")
    print(f"SECRET_KEY loaded: {'yes' if SECRET_KEY else 'NO - MISSING'}")
    await init_db()
    yield


app = FastAPI(title="FlashLearn API", lifespan=lifespan)

_default_origins = ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001", "http://localhost"]
_extra = os.getenv("CORS_ORIGINS", "")  # comma-separated extra origins
cors_origins = _default_origins + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
