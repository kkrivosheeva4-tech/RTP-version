from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from auth_custom.models import UserProfile


class Command(BaseCommand):
    help = "Create or update test users for all roles."

    DEFAULT_USERS = [
        {"username": "admin", "password": "admin123", "role": UserProfile.ROLE_ADMIN},
        {"username": "architect", "password": "architect123", "role": UserProfile.ROLE_ARCHITECT},
        {"username": "director", "password": "director123", "role": UserProfile.ROLE_DIRECTOR},
        {
            "username": "project_manager",
            "password": "pm123",
            "role": UserProfile.ROLE_PROJECT_MANAGER,
        },
        {"username": "analyst", "password": "analyst123", "role": UserProfile.ROLE_ANALYST},
        {"username": "viewer", "password": "viewer123", "role": UserProfile.ROLE_VIEWER},
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
                password = row["password"]
                role = row["role"]

                user, is_created = User.objects.get_or_create(
                    username=username,
                    defaults={"is_active": True},
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
                    user.is_staff = role == UserProfile.ROLE_ADMIN
                    user.is_superuser = role == UserProfile.ROLE_ADMIN
                    if reset_passwords:
                        user.save(update_fields=["password", "is_staff", "is_superuser"])
                    else:
                        user.save(update_fields=["is_staff", "is_superuser"])
                    updated += 1

                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.role = role
                profile.save(update_fields=["role", "updated_at"])

        self.stdout.write(self.style.SUCCESS("Test users seeded."))
        self.stdout.write(f"Created: {created}")
        self.stdout.write(f"Updated: {updated}")
