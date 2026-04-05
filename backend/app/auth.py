import os
import hmac
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

APP_PASSWORD = os.getenv("APP_PASSWORD", "")
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
TOKEN_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

_serializer = URLSafeTimedSerializer(SECRET_KEY)
_bearer = HTTPBearer()


def verify_password(candidate: str) -> bool:
    if not APP_PASSWORD:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "APP_PASSWORD not configured on server",
        )
    return hmac.compare_digest(candidate.encode(), APP_PASSWORD.encode())


def create_token() -> str:
    return _serializer.dumps({"auth": True})


def validate_token(token: str) -> bool:
    try:
        data = _serializer.loads(token, max_age=TOKEN_MAX_AGE)
        return data.get("auth") is True
    except (BadSignature, SignatureExpired):
        return False


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> None:
    if not validate_token(credentials.credentials):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
