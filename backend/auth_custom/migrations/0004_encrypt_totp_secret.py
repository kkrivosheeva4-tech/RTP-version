import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import migrations, models


ENCRYPTED_TOTP_PREFIX = "enc1:"


def _derive_fernet_key() -> str:
    configured = str(getattr(settings, "TOTP_SECRET_ENCRYPTION_KEY", "") or "").strip()
    if configured:
        return configured
    digest = hashlib.sha256(
        f"rtp3-totp:{getattr(settings, 'SECRET_KEY', '')}".encode("utf-8")
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def _encrypt_secret(secret: str) -> str:
    normalized = str(secret or "").strip()
    if not normalized:
        return ""
    if normalized.startswith(ENCRYPTED_TOTP_PREFIX):
        return normalized
    token = Fernet(_derive_fernet_key().encode("utf-8")).encrypt(
        normalized.encode("utf-8")
    ).decode("utf-8")
    return f"{ENCRYPTED_TOTP_PREFIX}{token}"


def _decrypt_secret(secret: str) -> str:
    normalized = str(secret or "").strip()
    if not normalized:
        return ""
    if not normalized.startswith(ENCRYPTED_TOTP_PREFIX):
        return normalized
    token = normalized[len(ENCRYPTED_TOTP_PREFIX) :]
    return Fernet(_derive_fernet_key().encode("utf-8")).decrypt(token.encode("utf-8")).decode(
        "utf-8"
    )


def forwards(apps, schema_editor):
    UserProfile = apps.get_model("auth_custom", "UserProfile")
    for profile in UserProfile.objects.all().iterator():
        profile.totp_secret_encrypted = _encrypt_secret(profile.totp_secret)
        profile.save(update_fields=["totp_secret_encrypted"])


def backwards(apps, schema_editor):
    UserProfile = apps.get_model("auth_custom", "UserProfile")
    for profile in UserProfile.objects.all().iterator():
        profile.totp_secret = _decrypt_secret(profile.totp_secret_encrypted)
        profile.save(update_fields=["totp_secret"])


class Migration(migrations.Migration):
    dependencies = [
        ("auth_custom", "0003_role_model_v2"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="totp_secret_encrypted",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(
            model_name="userprofile",
            name="totp_secret",
        ),
    ]
