from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

User = get_user_model()


class UserProfile(models.Model):
    ROLE_ADMIN = "admin"
    ROLE_OWNER = "owner"
    ROLE_EDITOR = "editor"
    ROLE_GUEST = "guest"

    LEGACY_ROLE_ARCHITECT = "architect"
    LEGACY_ROLE_DIRECTOR = "director"
    LEGACY_ROLE_PROJECT_MANAGER = "project_manager"
    LEGACY_ROLE_ANALYST = "analyst"
    LEGACY_ROLE_VIEWER = "viewer"

    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_OWNER, "Owner"),
        (ROLE_EDITOR, "Editor"),
        (ROLE_GUEST, "Guest"),
    ]

    LEGACY_ROLE_CHOICES = [
        (LEGACY_ROLE_ARCHITECT, "Architect"),
        (LEGACY_ROLE_DIRECTOR, "Director"),
        (LEGACY_ROLE_PROJECT_MANAGER, "Project Manager"),
        (LEGACY_ROLE_ANALYST, "Analyst"),
        (LEGACY_ROLE_VIEWER, "Viewer"),
    ]

    LEGACY_TO_V2 = {
        LEGACY_ROLE_ARCHITECT: ROLE_OWNER,
        LEGACY_ROLE_DIRECTOR: ROLE_OWNER,
        LEGACY_ROLE_PROJECT_MANAGER: ROLE_OWNER,
        LEGACY_ROLE_ANALYST: ROLE_GUEST,
        LEGACY_ROLE_VIEWER: ROLE_GUEST,
    }

    V2_ROLES = {ROLE_ADMIN, ROLE_OWNER, ROLE_EDITOR, ROLE_GUEST}
    LEGACY_ROLES = set(LEGACY_TO_V2.keys())

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default=ROLE_GUEST)
    legacy_role = models.CharField(max_length=32, blank=True, default="")
    is_2fa_enabled = models.BooleanField(default=False)
    totp_secret = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def normalize_role(cls, role: str | None) -> str:
        key = str(role or "").strip().lower()
        if key in cls.V2_ROLES:
            return key
        if key in cls.LEGACY_TO_V2:
            return cls.LEGACY_TO_V2[key]
        return cls.ROLE_GUEST

    def get_effective_role(self) -> str:
        role_key = str(self.role or "").strip().lower()
        if role_key in self.V2_ROLES:
            return role_key
        if role_key in self.LEGACY_TO_V2:
            return self.LEGACY_TO_V2[role_key]
        return self.normalize_role(self.legacy_role)

    def save(self, *args, **kwargs):
        normalized = self.normalize_role(self.role)
        role_key = str(self.role or "").strip().lower()
        if role_key in self.LEGACY_TO_V2 and not self.legacy_role:
            self.legacy_role = role_key
        self.role = normalized
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.user.username} ({self.get_effective_role()})"


class RefreshToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="refresh_tokens",
    )
    jti = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > timezone.now()

    def revoke(self):
        if self.revoked_at is None:
            self.revoked_at = timezone.now()
            self.save(update_fields=["revoked_at"])


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, raw=False, **kwargs):
    # During fixture loading (loaddata), related objects are restored from the dump.
    # Auto-creating profiles here leads to one-to-one uniqueness conflicts.
    if raw:
        return
    if created:
        UserProfile.objects.get_or_create(user=instance)
