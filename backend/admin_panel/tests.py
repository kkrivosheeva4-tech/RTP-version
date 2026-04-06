from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog, BackupSnapshot
from auth_custom.models import UserProfile
from auth_custom.totp_utils import generate_totp_token
from references.models import (
    DigitalDirection,
    Enterprise,
    EnterpriseBlockMapping,
    FunctionalBlock,
    FunctionReference,
    Integrator,
    Vendor,
)
from technologies.models import Technology, TechnologyProposal

User = get_user_model()


class TestAdminPanelApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        cache.clear()
        self.block_1 = FunctionalBlock.objects.create(id=1, name="Block 1")
        self.block_2 = FunctionalBlock.objects.create(id=2, name="Block 2")
        self.function = FunctionReference.objects.create(name="Function 1", block=self.block_1)
        self.direction = DigitalDirection.objects.create(id=1, name="Direction 1", quadrant=1)
        self.vendor = Vendor.objects.create(name="Vendor 1")
        self.integrator = Integrator.objects.create(name="Integrator 1")
        self.enterprise = Enterprise.objects.create(name="Enterprise A", code="EA")
        EnterpriseBlockMapping.objects.create(enterprise=self.enterprise, block=self.block_1)

        self.technology = Technology.objects.create(
            name="Tech A",
            description="stable description",
            primary_block=self.block_1,
            legacy_function="Function 1",
            trl_stage=5,
            status="planned",
            market_examples=["Example A"],
            documentation_files=["doc-a.pdf"],
        )
        self.technology.blocks.add(self.block_1)
        self.technology.function_coverage.add(self.function)
        self.technology.directions.add(self.direction)
        self.technology.vendors.add(self.vendor)
        self.technology.enterprises.add(
            self.enterprise,
            through_defaults={
                "technological_readiness": 3,
                "organizational_readiness": 4,
                "status": "planned",
            },
        )

        self.admin_user = User.objects.create_user(
            username="Admin User",
            email="admin@example.com",
            password="Adminpass123!",
        )
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin_user)
        admin_profile.role = UserProfile.ROLE_ADMIN
        admin_profile.is_2fa_enabled = True
        admin_profile.totp_secret = self.TEST_2FA_SECRET
        admin_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.guest_user = User.objects.create_user(
            username="Guest User",
            email="guest@example.com",
            password="Guestpass123!",
        )
        guest_profile, _ = UserProfile.objects.get_or_create(user=self.guest_user)
        guest_profile.role = UserProfile.ROLE_GUEST
        guest_profile.is_2fa_enabled = True
        guest_profile.totp_secret = self.TEST_2FA_SECRET
        guest_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.admin_token = self._login("admin@example.com", "Adminpass123!")
        self.guest_token = self._login("guest@example.com", "Guestpass123!")
        self.proposal = TechnologyProposal.objects.create(
            technology=self.technology,
            target_technology_id=self.technology.id,
            action=TechnologyProposal.ACTION_UPDATE,
            status=TechnologyProposal.STATUS_DRAFT,
            payload={"name": "Tech A proposal"},
            comment="proposal comment",
            created_by=self.admin_user,
        )

    def tearDown(self):
        cache.clear()
        for backup in BackupSnapshot.objects.all():
            try:
                path = backup.storage_path
                if path:
                    from pathlib import Path

                    backup_file = Path(path)
                    if backup_file.exists():
                        backup_file.unlink()
            except OSError:
                pass

    def _login(self, email, password):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"email": email, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("requires_2fa"))
        session_id = response.data["session_id"]

        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify",
            data={"session_id": session_id, "code": generate_totp_token(self.TEST_2FA_SECRET)},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        return verify_response.data["access_token"]

    def test_admin_can_crud_users(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        create_response = self.client.post(
            "/api/v1/admin-panel/users",
            data={
                "username": "viewer1",
                "email": "viewer1@example.com",
                "password": "Viewer123!",
                "role": UserProfile.ROLE_GUEST,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_id = create_response.data["id"]
        created_user = User.objects.get(id=created_id)
        self.assertTrue(created_user.profile.must_change_password)

        list_response = self.client.get("/api/v1/admin-panel/users")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["username"] == "viewer1" for row in list_response.data))

        patch_response = self.client.patch(
            f"/api/v1/admin-panel/users/{created_id}",
            data={"role": UserProfile.ROLE_EDITOR, "is_active": False},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["role"], UserProfile.ROLE_EDITOR)
        self.assertFalse(patch_response.data["is_active"])

        reset_password_response = self.client.patch(
            f"/api/v1/admin-panel/users/{created_id}",
            data={"password": "Viewer456!"},
            format="json",
        )
        self.assertEqual(reset_password_response.status_code, status.HTTP_200_OK)
        created_user.refresh_from_db()
        self.assertTrue(created_user.profile.must_change_password)

        delete_response = self.client.delete(f"/api/v1/admin-panel/users/{created_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=created_id).exists())

    def test_admin_can_unlock_locked_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        locked_user = User.objects.create_user(
            username="Locked User",
            email="locked@example.com",
            password="Locked123!",
        )
        locked_profile, _ = UserProfile.objects.get_or_create(user=locked_user)
        locked_profile.role = UserProfile.ROLE_GUEST
        locked_profile.failed_login_attempts = 10
        locked_profile.locked_at = timezone.now()
        locked_profile.save(
            update_fields=["role", "failed_login_attempts", "locked_at", "updated_at"]
        )

        list_response = self.client.get("/api/v1/admin-panel/users")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        locked_row = next(row for row in list_response.data if row["id"] == locked_user.id)
        self.assertTrue(locked_row["is_locked"])
        self.assertEqual(locked_row["failed_login_attempts"], 10)

        unlock_response = self.client.patch(
            f"/api/v1/admin-panel/users/{locked_user.id}",
            data={"unlock_account": True},
            format="json",
        )
        self.assertEqual(unlock_response.status_code, status.HTTP_200_OK)
        self.assertFalse(unlock_response.data["is_locked"])
        self.assertEqual(unlock_response.data["failed_login_attempts"], 0)

    def test_admin_user_create_requires_valid_email_and_password_policy(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        invalid_email_response = self.client.post(
            "/api/v1/admin-panel/users",
            data={
                "username": "viewer2",
                "email": " viewer2@example.com ",
                "password": "Viewer123!",
                "role": UserProfile.ROLE_GUEST,
            },
            format="json",
        )
        self.assertEqual(invalid_email_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", invalid_email_response.data.get("details", {}))

        invalid_password_response = self.client.post(
            "/api/v1/admin-panel/users",
            data={
                "username": "viewer3",
                "email": "viewer3@example.com",
                "password": "short7A",
                "role": UserProfile.ROLE_GUEST,
            },
            format="json",
        )
        self.assertEqual(invalid_password_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", invalid_password_response.data.get("details", {}))

    def test_cannot_delete_self(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        response = self.client.delete(f"/api/v1/admin-panel/users/{self.admin_user.id}")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_access_admin_panel(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.guest_token}")
        response = self.client.get("/api/v1/admin-panel/users")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_audit_list_filters_and_cleanup(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        old_log = AuditLog.objects.create(
            actor=self.admin_user,
            action=AuditLog.ACTION_LOGIN,
            entity_type="auth",
            entity_id="1",
        )
        AuditLog.objects.filter(id=old_log.id).update(
            created_at=timezone.now() - timedelta(days=10)
        )
        AuditLog.objects.create(
            actor=self.admin_user,
            action=AuditLog.ACTION_UPDATE,
            entity_type="user",
            entity_id="2",
        )

        list_response = self.client.get("/api/v1/admin-panel/audit?action=login")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(list_response.data["count"], 1)

        dry_run_response = self.client.delete(
            "/api/v1/admin-panel/audit",
            data={"older_than_days": 5, "dry_run": True},
            format="json",
        )
        self.assertEqual(dry_run_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(dry_run_response.data["deleted"], 1)
        self.assertTrue(dry_run_response.data["dry_run"])

        cleanup_response = self.client.delete(
            "/api/v1/admin-panel/audit",
            data={"older_than_days": 5},
            format="json",
        )
        self.assertEqual(cleanup_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(cleanup_response.data["deleted"], 1)

    def test_backup_create_download_delete(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        create_response = self.client.post(
            "/api/v1/admin-panel/backups",
            data={"name": "smoke-backup", "description": "backup for test"},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        backup_id = create_response.data["id"]

        list_response = self.client.get("/api/v1/admin-panel/backups")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["id"] == backup_id for row in list_response.data))

        download_response = self.client.get(f"/api/v1/admin-panel/backups/{backup_id}/download")
        self.assertEqual(download_response.status_code, status.HTTP_200_OK)
        self.assertIn("attachment", download_response.headers.get("Content-Disposition", ""))
        self.assertGreater(len(download_response.content), 0)

        delete_response = self.client.delete(f"/api/v1/admin-panel/backups/{backup_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BackupSnapshot.objects.filter(id=backup_id).exists())

    def test_backup_restore_recovers_domain_state(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        create_response = self.client.post(
            "/api/v1/admin-panel/backups",
            data={"name": "restore-backup", "description": "restore test"},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        backup_id = create_response.data["id"]
        self.assertEqual(create_response.data["metadata"]["schema_version"], 2)

        self.enterprise.description = "mutated"
        self.enterprise.code = "MUT"
        self.enterprise.save(update_fields=["description", "code"])
        EnterpriseBlockMapping.objects.filter(enterprise=self.enterprise).delete()
        EnterpriseBlockMapping.objects.create(enterprise=self.enterprise, block=self.block_2)
        self.block_1.name = "Block 1 Mutated"
        self.block_1.save(update_fields=["name"])
        self.function.name = "Function Mutated"
        self.function.save(update_fields=["name"])
        self.direction.name = "Direction Mutated"
        self.direction.quadrant = 4
        self.direction.save(update_fields=["name", "quadrant"])
        self.vendor.name = "Vendor Mutated"
        self.vendor.save(update_fields=["name"])
        self.integrator.name = "Integrator Mutated"
        self.integrator.save(update_fields=["name"])
        self.technology.name = "Tech Mutated"
        self.technology.description = "mutated description"
        self.technology.trl_stage = 8
        self.technology.status = "implemented"
        self.technology.market_examples = ["Changed"]
        self.technology.documentation_files = ["mutated.pdf"]
        self.technology.save(
            update_fields=[
                "name",
                "description",
                "trl_stage",
                "status",
                "market_examples",
                "documentation_files",
            ]
        )
        self.proposal.status = TechnologyProposal.STATUS_APPROVED
        self.proposal.payload = {"name": "Changed proposal"}
        self.proposal.save(update_fields=["status", "payload", "updated_at"])
        FunctionalBlock.objects.create(id=99, name="Extra Block")
        Enterprise.objects.create(id=99, name="Extra Enterprise", code="EX")
        Technology.objects.create(name="Extra Tech", primary_block=self.block_2)

        dry_run_response = self.client.post(
            f"/api/v1/admin-panel/backups/{backup_id}/restore",
            data={"dry_run": True},
            format="json",
        )
        self.assertEqual(dry_run_response.status_code, status.HTTP_200_OK)
        self.assertTrue(dry_run_response.data["dry_run"])
        self.assertGreaterEqual(dry_run_response.data["counts"]["enterprises"], 1)
        self.assertGreaterEqual(dry_run_response.data["counts"]["technologies"], 1)
        self.assertGreaterEqual(dry_run_response.data["counts"]["technology_proposals"], 1)

        restore_response = self.client.post(
            f"/api/v1/admin-panel/backups/{backup_id}/restore",
            data={},
            format="json",
        )
        self.assertEqual(restore_response.status_code, status.HTTP_200_OK)
        self.assertTrue(restore_response.data["ok"])
        self.assertGreaterEqual(restore_response.data["restored_counts"]["references"], 1)
        self.assertGreaterEqual(restore_response.data["restored_counts"]["technologies"], 1)

        self.block_1.refresh_from_db()
        self.function.refresh_from_db()
        self.direction.refresh_from_db()
        self.vendor.refresh_from_db()
        self.integrator.refresh_from_db()
        self.enterprise.refresh_from_db()
        self.technology.refresh_from_db()
        self.proposal.refresh_from_db()
        self.assertEqual(self.block_1.name, "Block 1")
        self.assertEqual(self.function.name, "Function 1")
        self.assertEqual(self.direction.name, "Direction 1")
        self.assertEqual(self.direction.quadrant, 1)
        self.assertEqual(self.vendor.name, "Vendor 1")
        self.assertEqual(self.integrator.name, "Integrator 1")
        self.assertEqual(self.enterprise.description, "")
        self.assertEqual(self.enterprise.code, "EA")
        self.assertEqual(
            list(
                EnterpriseBlockMapping.objects.filter(enterprise=self.enterprise)
                .order_by("block_id")
                .values_list("block_id", flat=True)
            ),
            [self.block_1.id],
        )
        self.assertEqual(self.technology.name, "Tech A")
        self.assertEqual(self.technology.description, "stable description")
        self.assertEqual(self.technology.trl_stage, 5)
        self.assertEqual(self.technology.status, "planned")
        self.assertEqual(self.technology.market_examples, ["Example A"])
        self.assertEqual(self.technology.documentation_files, ["doc-a.pdf"])
        self.assertEqual(self.proposal.status, TechnologyProposal.STATUS_DRAFT)
        self.assertEqual(self.proposal.payload, {"name": "Tech A proposal"})
        self.assertFalse(FunctionalBlock.objects.filter(id=99).exists())
        self.assertFalse(Enterprise.objects.filter(id=99).exists())
        self.assertFalse(Technology.objects.filter(name="Extra Tech").exists())

    def test_enterprises_crud_with_block_ids(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        create_response = self.client.post(
            "/api/v1/admin-panel/enterprises",
            data={
                "name": "Enterprise B",
                "code": "EB",
                "description": "desc",
                "block_ids": [self.block_1.id, self.block_2.id],
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_id = create_response.data["id"]
        self.assertEqual(create_response.data["block_ids"], [self.block_1.id, self.block_2.id])

        patch_response = self.client.patch(
            f"/api/v1/admin-panel/enterprises/{created_id}",
            data={"description": "updated", "block_ids": [self.block_2.id]},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["block_ids"], [self.block_2.id])

        get_response = self.client.get(f"/api/v1/admin-panel/enterprises/{created_id}")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["name"], "Enterprise B")

        delete_response = self.client.delete(f"/api/v1/admin-panel/enterprises/{created_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Enterprise.objects.filter(id=created_id).exists())
