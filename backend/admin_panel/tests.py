from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog, BackupSnapshot
from auth_custom.models import UserProfile
from auth_custom.totp_utils import generate_totp_token
from references.models import Enterprise, EnterpriseBlockMapping, FunctionalBlock

User = get_user_model()


class TestAdminPanelApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        self.block_1 = FunctionalBlock.objects.create(id=1, name="Block 1")
        self.block_2 = FunctionalBlock.objects.create(id=2, name="Block 2")
        self.enterprise = Enterprise.objects.create(name="Enterprise A", code="EA")
        EnterpriseBlockMapping.objects.create(enterprise=self.enterprise, block=self.block_1)

        self.admin_user = User.objects.create_user(username="admin", password="admin123")
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin_user)
        admin_profile.role = UserProfile.ROLE_ADMIN
        admin_profile.is_2fa_enabled = True
        admin_profile.totp_secret = self.TEST_2FA_SECRET
        admin_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.analyst_user = User.objects.create_user(username="analyst", password="analyst123")
        analyst_profile, _ = UserProfile.objects.get_or_create(user=self.analyst_user)
        analyst_profile.role = UserProfile.ROLE_ANALYST
        analyst_profile.is_2fa_enabled = True
        analyst_profile.totp_secret = self.TEST_2FA_SECRET
        analyst_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.admin_token = self._login("admin", "admin123")
        self.analyst_token = self._login("analyst", "analyst123")

    def tearDown(self):
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

    def _login(self, username, password):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
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
                "password": "viewer123",
                "role": UserProfile.ROLE_VIEWER,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_id = create_response.data["id"]

        list_response = self.client.get("/api/v1/admin-panel/users")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row["username"] == "viewer1" for row in list_response.data))

        patch_response = self.client.patch(
            f"/api/v1/admin-panel/users/{created_id}",
            data={"role": UserProfile.ROLE_ANALYST, "is_active": False},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["role"], UserProfile.ROLE_ANALYST)
        self.assertFalse(patch_response.data["is_active"])

        delete_response = self.client.delete(f"/api/v1/admin-panel/users/{created_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=created_id).exists())

    def test_cannot_delete_self(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        response = self.client.delete(f"/api/v1/admin-panel/users/{self.admin_user.id}")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_access_admin_panel(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.analyst_token}")
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
        AuditLog.objects.filter(id=old_log.id).update(created_at=timezone.now() - timedelta(days=10))
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
        download_response.close()

        delete_response = self.client.delete(f"/api/v1/admin-panel/backups/{backup_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(BackupSnapshot.objects.filter(id=backup_id).exists())

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
