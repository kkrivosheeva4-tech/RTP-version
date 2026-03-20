import time

import pyotp


def _normalize_secret(secret: str) -> str:
    return str(secret or "").strip().replace(" ", "").upper()


def get_totp_provider() -> str:
    return "pyotp"


def generate_totp_secret(byte_length: int = 20) -> str:
    target_length = max(16, int(round(byte_length * 8 / 5)))
    return pyotp.random_base32(length=target_length)


def generate_totp_token(
    secret: str,
    *,
    at_time: int | None = None,
    period: int = 30,
    digits: int = 6,
) -> str:
    timestamp = int(time.time() if at_time is None else at_time)
    normalized_secret = _normalize_secret(secret)
    return pyotp.TOTP(normalized_secret, digits=digits, interval=period).at(timestamp)


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
    normalized_secret = _normalize_secret(secret)
    try:
        totp = pyotp.TOTP(normalized_secret, digits=digits, interval=period)
        return bool(totp.verify(token, for_time=timestamp, valid_window=window))
    except Exception:
        return False


def build_otpauth_uri(secret: str, username: str, issuer: str = "Radar") -> str:
    normalized_secret = _normalize_secret(secret)
    return pyotp.TOTP(normalized_secret).provisioning_uri(name=username, issuer_name=issuer)
