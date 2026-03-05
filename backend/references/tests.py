from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from auth_custom.models import UserProfile
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
        admin_profile.save(update_fields=["role", "updated_at"])

        self.analyst_user = User.objects.create_user(username="analyst", password="analyst123")
        analyst_profile, _ = UserProfile.objects.get_or_create(user=self.analyst_user)
        analyst_profile.role = UserProfile.ROLE_ANALYST
        analyst_profile.save(update_fields=["role", "updated_at"])

        self.admin_token = self._login("admin", "admin123")
        self.analyst_token = self._login("analyst", "analyst123")

    def _login(self, username, password):
        response = self.client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["access_token"]

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
        get_response = self.client.get("/api/v1/references/vendors")
        self.assertEqual(get_response.data, ["Vendor A", "Vendor B"])

    def test_analyst_cannot_write_references(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.analyst_token}")
        payload = ["Vendor A"]
        response = self.client.put("/api/v1/references/vendors", data=payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_requires_authentication_for_read(self):
        self.client.credentials()
        response = self.client.get("/api/v1/references/vendors")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_payload_type_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        response = self.client.put("/api/v1/references/vendors", data={"bad": "payload"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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
