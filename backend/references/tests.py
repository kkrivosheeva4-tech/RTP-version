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
