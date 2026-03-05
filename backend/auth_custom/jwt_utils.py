import base64
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timedelta, timezone


ALGORITHM = "HS256"


class JWTError(Exception):
    pass


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def encode_jwt(payload: dict, secret: str) -> str:
    header = {"alg": ALGORITHM, "typ": "JWT"}
    header_segment = _b64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    payload_segment = _b64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_segment = _b64url_encode(signature)
    return f"{header_segment}.{payload_segment}.{signature_segment}"


def decode_jwt(token: str, secret: str, expected_type: str | None = None) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise JWTError("Invalid token format")

    header_segment, payload_segment, signature_segment = parts
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual_signature = _b64url_decode(signature_segment)
    if not hmac.compare_digest(expected_signature, actual_signature):
        raise JWTError("Invalid token signature")

    payload_raw = _b64url_decode(payload_segment)
    payload = json.loads(payload_raw.decode("utf-8"))
    now_ts = int(datetime.now(tz=timezone.utc).timestamp())

    exp = payload.get("exp")
    if exp is None or int(exp) < now_ts:
        raise JWTError("Token expired")

    token_type = payload.get("type")
    if expected_type and token_type != expected_type:
        raise JWTError("Invalid token type")

    return payload


def _jwt_secret() -> str:
    return os.getenv("SECRET_KEY", "django-insecure-change-me")


def _access_lifetime_minutes() -> int:
    return int(os.getenv("ACCESS_TOKEN_LIFETIME_MINUTES", "30"))


def _refresh_lifetime_days() -> int:
    return int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", "7"))


def create_access_token(*, user_id: int, username: str, role: str) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=_access_lifetime_minutes())).timestamp()),
    }
    return encode_jwt(payload, _jwt_secret())


def create_refresh_token(*, user_id: int) -> tuple[str, str, datetime]:
    now = datetime.now(tz=timezone.utc)
    jti = uuid.uuid4().hex
    expires_at = now + timedelta(days=_refresh_lifetime_days())
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return encode_jwt(payload, _jwt_secret()), jti, expires_at


def decode_access_token(token: str) -> dict:
    return decode_jwt(token, _jwt_secret(), expected_type="access")


def decode_refresh_token(token: str) -> dict:
    return decode_jwt(token, _jwt_secret(), expected_type="refresh")
