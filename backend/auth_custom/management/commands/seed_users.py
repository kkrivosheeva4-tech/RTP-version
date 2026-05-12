from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from auth_custom.models import UserProfile


class Command(BaseCommand):
    help = "Create or update test users for all roles."

    DEFAULT_USERS = [
        {
            "username": "admin",
            "email": "admin@example.com",
            "password": "Admin123!",
            "role": UserProfile.ROLE_ADMIN,
        },
        {
            "username": "owner",
            "email": "owner@example.com",
            "password": "Owner123!",
            "role": UserProfile.ROLE_OWNER,
        },
        {
            "username": "editor",
            "email": "editor@example.com",
            "password": "Editor123!",
            "role": UserProfile.ROLE_EDITOR,
        },
        {
            "username": "guest",
            "email": "guest@example.com",
            "password": "Guest123!",
            "role": UserProfile.ROLE_GUEST,
        },
        # Legacy aliases retained for compatibility during migration.
        {
            "username": "architect",
            "email": "architect@example.com",
            "password": "Architect123!",
            "role": UserProfile.ROLE_OWNER,
        },
        {
            "username": "director",
            "email": "director@example.com",
            "password": "Director123!",
            "role": UserProfile.ROLE_OWNER,
        },
        {
            "username": "project_manager",
            "email": "project_manager@example.com",
            "password": "Manager123!",
            "role": UserProfile.ROLE_OWNER,
        },
        {
            "username": "analyst",
            "email": "analyst@example.com",
            "password": "Analyst123!",
            "role": UserProfile.ROLE_GUEST,
        },
        {
            "username": "viewer",
            "email": "viewer@example.com",
            "password": "Viewer123!",
            "role": UserProfile.ROLE_GUEST,
        },
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset passwords for existing users.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        created = 0
        updated = 0
        reset_passwords = options["reset_passwords"]

        with transaction.atomic():
            for row in self.DEFAULT_USERS:
                username = row["username"]
                email = row["email"]
                password = row["password"]
                role = row["role"]

                user, is_created = User.objects.get_or_create(
                    username=username,
                    defaults={"email": email, "is_active": True},
                )
                if is_created:
                    user.set_password(password)
                    user.is_staff = role == UserProfile.ROLE_ADMIN
                    user.is_superuser = role == UserProfile.ROLE_ADMIN
                    user.save(update_fields=["password", "is_staff", "is_superuser"])
                    created += 1
                else:
                    if reset_passwords:
                        user.set_password(password)
                    user.email = email
                    user.is_staff = role == UserProfile.ROLE_ADMIN
                    user.is_superuser = role == UserProfile.ROLE_ADMIN
                    if reset_passwords:
                        user.save(update_fields=["email", "password", "is_staff", "is_superuser"])
                    else:
                        user.save(update_fields=["email", "is_staff", "is_superuser"])
                    updated += 1

                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.role = role
                profile.legacy_role = ""
                if reset_passwords:
                    profile.failed_login_attempts = 0
                    profile.locked_at = None
                    profile.save(
                        update_fields=[
                            "role",
                            "legacy_role",
                            "failed_login_attempts",
                            "locked_at",
                            "updated_at",
                        ]
                    )
                else:
                    profile.save(update_fields=["role", "legacy_role", "updated_at"])

        self.stdout.write(self.style.SUCCESS("Test users seeded."))
        self.stdout.write(f"Created: {created}")
        self.stdout.write(f"Updated: {updated}")
