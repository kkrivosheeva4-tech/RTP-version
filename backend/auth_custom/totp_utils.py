import base64
import hashlib
import hmac
import secrets
import time
from urllib.parse import quote


def generate_totp_secret(byte_length: int = 20) -> str:
    return base64.b32encode(secrets.token_bytes(byte_length)).decode("ascii").rstrip("=")


def _decode_base32(secret: str) -> bytes:
    normalized = (secret or "").strip().replace(" ", "").upper()
    if not normalized:
        raise ValueError("Empty TOTP secret")
    padding = "=" * (-len(normalized) % 8)
    return base64.b32decode(normalized + padding, casefold=True)


def _hotp(secret_bytes: bytes, counter: int, digits: int = 6) -> str:
    counter_bytes = counter.to_bytes(8, byteorder="big", signed=False)
    digest = hmac.new(secret_bytes, counter_bytes, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = (
        ((digest[offset] & 0x7F) << 24)
        | ((digest[offset + 1] & 0xFF) << 16)
        | ((digest[offset + 2] & 0xFF) << 8)
        | (digest[offset + 3] & 0xFF)
    )
    return str(code_int % (10**digits)).zfill(digits)


def generate_totp_token(
    secret: str,
    *,
    at_time: int | None = None,
    period: int = 30,
    digits: int = 6,
) -> str:
    timestamp = int(time.time() if at_time is None else at_time)
    counter = timestamp // period
    secret_bytes = _decode_base32(secret)
    return _hotp(secret_bytes, counter, digits)


def verify_totp_token(
    secret: str,
    token: str,
    *,
    window: int = 1,
    at_time: int | None = None,
    period: int = 30,
    digits: int = 6,
) -> bool:
    if not token or not token.isdigit() or len(token) != digits:
        return False

    timestamp = int(time.time() if at_time is None else at_time)
    base_counter = timestamp // period
    try:
        secret_bytes = _decode_base32(secret)
    except ValueError:
        return False

    for delta in range(-window, window + 1):
        counter = base_counter + delta
        if counter < 0:
            continue
        if _hotp(secret_bytes, counter, digits) == token:
            return True
    return False


def build_otpauth_uri(secret: str, username: str, issuer: str = "Radar") -> str:
    label = quote(f"{issuer}:{username}")
    issuer_param = quote(issuer)
    return f"otpauth://totp/{label}?secret={secret}&issuer={issuer_param}"
