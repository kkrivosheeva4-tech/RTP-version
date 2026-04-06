import re
from datetime import timedelta

from django.contrib.auth.hashers import check_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import serializers

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 20
PASSWORD_HISTORY_LIMIT = 10
PASSWORD_MAX_FAILED_ATTEMPTS = 10
PASSWORD_MAX_AGE_DAYS = 90
PASSWORD_SPECIAL_CHARACTERS = "!@#$%^&*()-_+=~[]{}\\:;'\"<>,.?/"

COMMON_PASSWORD_PARTS = {
    "password",
    "passw0rd",
    "admin",
    "administrator",
    "test",
    "user",
    "guest",
    "qwerty",
    "qwertyui",
    "qwertyuiop",
    "12345678",
    "123456789",
    "1234567890",
}

SEQUENTIAL_PASSWORD_PARTS = (
    "0123456789",
    "1234567890",
    "abcdefghijklmnopqrstuvwxyz",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm",
)

PASSWORD_ALLOWED_RE = re.compile(
    rf"^[A-Za-z0-9{re.escape(PASSWORD_SPECIAL_CHARACTERS)}]{{8,20}}$"
)
PASSWORD_UPPER_RE = re.compile(r"[A-Z]")
PASSWORD_LOWER_RE = re.compile(r"[a-z]")
PASSWORD_DIGIT_RE = re.compile(r"\d")


def normalize_email(value: str) -> str:
    return str(value or "").strip().lower()


def validate_login_email(value: str) -> str:
    raw_value = str(value or "")
    if not raw_value:
        raise serializers.ValidationError("Email is required.")
    if raw_value != raw_value.strip():
        raise serializers.ValidationError("Email must not contain leading or trailing spaces.")
    if any(ch.isspace() for ch in raw_value):
        raise serializers.ValidationError("Email must not contain spaces.")
    normalized = normalize_email(raw_value)
    try:
        validate_email(normalized)
    except DjangoValidationError as exc:
        raise serializers.ValidationError("Enter a valid email address.") from exc
    return normalized


def validate_password_format(password: str) -> str:
    raw_password = str(password or "")
    if not raw_password:
        raise serializers.ValidationError("Password is required.")
    if raw_password != raw_password.strip():
        raise serializers.ValidationError(
            "Password must not contain leading or trailing spaces."
        )
    if not PASSWORD_ALLOWED_RE.fullmatch(raw_password):
        raise serializers.ValidationError(
            "Password must be 8-20 characters long and contain only Latin letters, digits, and approved special characters."
        )
    if not PASSWORD_UPPER_RE.search(raw_password):
        raise serializers.ValidationError(
            "Password must contain at least one uppercase Latin letter."
        )
    if not PASSWORD_LOWER_RE.search(raw_password):
        raise serializers.ValidationError(
            "Password must contain at least one lowercase Latin letter."
        )
    if not PASSWORD_DIGIT_RE.search(raw_password):
        raise serializers.ValidationError("Password must contain at least one digit.")
    return raw_password


def _contains_sequential_fragment(password_lc: str) -> bool:
    for sequence in SEQUENTIAL_PASSWORD_PARTS:
        if password_lc in sequence:
            return True
        for idx in range(0, len(sequence) - 4):
            chunk = sequence[idx : idx + 5]
            if chunk in password_lc:
                return True
    return False


def _get_forbidden_user_parts(user) -> set[str]:
    parts: set[str] = set()
    if not user:
        return parts
    username = str(getattr(user, "username", "") or "").strip().lower()
    email = normalize_email(getattr(user, "email", "") or "")
    for value in (username, email, email.split("@")[0] if email else ""):
        if not value:
            continue
        parts.add(value)
        for token in re.split(r"[^a-z0-9]+", value):
            token = token.strip().lower()
            if len(token) >= 3:
                parts.add(token)
    return parts


def validate_password_policy(password: str, *, user=None) -> str:
    raw_password = validate_password_format(password)

    password_lc = raw_password.lower()
    if any(part in password_lc for part in COMMON_PASSWORD_PARTS):
        raise serializers.ValidationError("Password is too common or predictable.")
    if _contains_sequential_fragment(password_lc):
        raise serializers.ValidationError("Password must not contain simple sequential fragments.")

    forbidden_user_parts = _get_forbidden_user_parts(user)
    for part in forbidden_user_parts:
        if len(part) >= 3 and part in password_lc:
            raise serializers.ValidationError(
                "Password must not contain parts of the user's personal data."
            )

    return raw_password


def is_password_reused(user, password: str) -> bool:
    if not user:
        return False
    if user.password and check_password(password, user.password):
        return True
    history_manager = getattr(user, "password_history", None)
    if history_manager is None:
        return False
    for row in history_manager.order_by("-created_at")[:PASSWORD_HISTORY_LIMIT]:
        if check_password(password, row.password_hash):
            return True
    return False


def ensure_password_not_reused(user, password: str) -> None:
    if user and is_password_reused(user, password):
        raise serializers.ValidationError(
            f"Password must not match any of the last {PASSWORD_HISTORY_LIMIT} passwords."
        )


def get_password_expiry_deadline(changed_at):
    if not changed_at:
        return None
    return changed_at + timedelta(days=PASSWORD_MAX_AGE_DAYS)


def is_password_expired(changed_at) -> bool:
    deadline = get_password_expiry_deadline(changed_at)
    return bool(deadline and deadline <= timezone.now())
