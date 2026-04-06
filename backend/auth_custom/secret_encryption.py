import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

ENCRYPTED_TOTP_PREFIX = "enc1:"


def _build_fernet() -> Fernet:
    key = getattr(settings, "TOTP_SECRET_ENCRYPTION_KEY", "").strip()
    if not key:
        raise ValueError("TOTP secret encryption key is not configured.")
    return Fernet(key.encode("utf-8"))


def derive_fernet_key(seed: str) -> str:
    digest = hashlib.sha256(str(seed).encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def is_encrypted_totp_secret(value: str | None) -> bool:
    return str(value or "").startswith(ENCRYPTED_TOTP_PREFIX)


def encrypt_totp_secret(secret: str | None) -> str:
    normalized = str(secret or "").strip()
    if not normalized:
        return ""
    if is_encrypted_totp_secret(normalized):
        return normalized
    token = _build_fernet().encrypt(normalized.encode("utf-8")).decode("utf-8")
    return f"{ENCRYPTED_TOTP_PREFIX}{token}"


def decrypt_totp_secret(secret: str | None) -> str:
    raw_value = str(secret or "").strip()
    if not raw_value:
        return ""
    if not is_encrypted_totp_secret(raw_value):
        return raw_value
    token = raw_value[len(ENCRYPTED_TOTP_PREFIX) :]
    try:
        return _build_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Stored TOTP secret cannot be decrypted.") from exc
