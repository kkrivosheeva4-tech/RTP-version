from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog
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

User = get_user_model()


class TestReferencesApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        FunctionalBlock.objects.create(id=1, name="Block 1")
        FunctionalBlock.objects.create(id=2, name="Block 2")
        FunctionReference.objects.create(name="Function 1", block_id=1)
        DigitalDirection.objects.create(id=1, name="Direction 1", quadrant=2)
        Enterprise.objects.create(id=1, name="Enterprise 1", code="E1")
        EnterpriseBlockMapping.objects.create(enterprise_id=1, block_id=1)
        Vendor.objects.create(name="Vendor 1")
        Integrator.objects.create(name="Integrator 1")

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

    def test_get_supported_references(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.analyst_token}")
        names = [
            "blocks",
            "functions",
            "functionToBlock",
            "digitalDirections",
            "directionToQuadrant",
            "vendors",
            "integrators",
            "enterprises",
            "enterprisesBlocksMapping",
        ]
        for name in names:
            response = self.client.get(f"/api/v1/references/{name}")
            self.assertEqual(response.status_code, status.HTTP_200_OK, msg=name)

    def test_put_vendors(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        payload = ["Vendor A", "Vendor B"]
        response = self.client.put("/api/v1/references/vendors", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_UPDATE,
                entity_type="reference",
                entity_id="vendors",
            ).exists()
        )
        get_response = self.client.get("/api/v1/references/vendors")
        self.assertEqual(get_response.data, ["Vendor A", "Vendor B"])

    def test_analyst_cannot_write_references(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.analyst_token}")
        payload = ["Vendor A"]
        response = self.client.put("/api/v1/references/vendors", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "forbidden")

    def test_requires_authentication_for_read(self):
        self.client.credentials()
        response = self.client.get("/api/v1/references/vendors")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "unauthorized")

    def test_invalid_payload_type_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        response = self.client.put("/api/v1/references/vendors", data={"bad": "payload"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")

    def test_function_to_block_unknown_block_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        payload = {"Function 1": 999}
        response = self.client.put("/api/v1/references/functionToBlock", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_direction_to_quadrant_invalid_value_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        payload = {"Direction 1": [9]}
        response = self.client.put("/api/v1/references/directionToQuadrant", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_enterprises_blocks_mapping_unknown_enterprise_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        payload = {
            "enterprises_blocks_mapping": [
                {
                    "enterprise_id": 999,
                    "enterprise_name": "Unknown",
                    "functional_blocks": [1],
                }
            ]
        }
        response = self.client.put("/api/v1/references/enterprisesBlocksMapping", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_update_enterprises_blocks_mapping(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        payload = {
            "enterprises_blocks_mapping": [
                {
                    "enterprise_id": 1,
                    "enterprise_name": "Enterprise 1",
                    "functional_blocks": [1, 2],
                }
            ]
        }
        put_response = self.client.put(
            "/api/v1/references/enterprisesBlocksMapping",
            data=payload,
            format="json",
        )
        self.assertEqual(put_response.status_code, status.HTTP_204_NO_CONTENT)

        get_response = self.client.get("/api/v1/references/enterprisesBlocksMapping")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["enterprises_blocks_mapping"][0]["enterprise_id"], 1)
        self.assertEqual(get_response.data["enterprises_blocks_mapping"][0]["functional_blocks"], [1, 2])
