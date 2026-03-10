from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog
from auth_custom.models import UserProfile
from auth_custom.totp_utils import generate_totp_token
from references.models import DigitalDirection, Enterprise, FunctionalBlock, FunctionReference
from technologies.models import Technology

User = get_user_model()


class TestTechnologiesApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        FunctionalBlock.objects.create(id=1, name="Block 1")
        FunctionalBlock.objects.create(id=2, name="Block 2")
        DigitalDirection.objects.create(id=1, name="Direction 1", quadrant=1)
        DigitalDirection.objects.create(id=2, name="Direction 2", quadrant=2)
        Enterprise.objects.create(id=1, name="Enterprise 1", code="E1")
        Enterprise.objects.create(id=2, name="Enterprise 2", code="E2")
        FunctionReference.objects.create(name="Function A", block_id=1)
        FunctionReference.objects.create(name="Function B", block_id=2)

        self.architect = User.objects.create_user(username="architect", password="architect123")
        architect_profile, _ = UserProfile.objects.get_or_create(user=self.architect)
        architect_profile.role = UserProfile.ROLE_ARCHITECT
        architect_profile.is_2fa_enabled = True
        architect_profile.totp_secret = self.TEST_2FA_SECRET
        architect_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.analyst = User.objects.create_user(username="analyst", password="analyst123")
        analyst_profile, _ = UserProfile.objects.get_or_create(user=self.analyst)
        analyst_profile.role = UserProfile.ROLE_ANALYST
        analyst_profile.is_2fa_enabled = True
        analyst_profile.totp_secret = self.TEST_2FA_SECRET
        analyst_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.architect_token = self._login("architect", "architect123")
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

    @staticmethod
    def payload(name="Tech 1", enterprise_id=1):
        return {
            "name": name,
            "description": "Description",
            "block": 1,
            "blocks": [1, 2],
            "functionCoverage": ["Function A", "Function B"],
            "enterprises": [
                {
                    "enterpriseId": enterprise_id,
                    "technologicalReadiness": 3,
                    "organizationalReadiness": 4,
                    "status": "Внедрена",
                }
            ],
            "directions": [1, 2],
            "trlStage": 5,
            "status": "Внедрена",
            "vendors": [
                {"name": "Vendor 1", "integrators": ["Integrator 1", "Integrator 2"]},
                {"name": "Vendor 2", "integrators": ["Integrator 3"]},
            ],
            "marketExamples": ["Example A"],
            "documentationFiles": ["doc-a.pdf"],
        }

    def test_create_and_get_technology(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        response = self.client.post("/api/v1/technologies", data=self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        tech_id = response.data["id"]
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_CREATE,
                entity_type="technology",
                entity_id=str(tech_id),
            ).exists()
        )

        get_response = self.client.get(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["name"], "Tech 1")
        self.assertEqual(len(get_response.data["vendors"]), 2)
        self.assertEqual(get_response.data["trlStage"], 5)

    def test_list_filter_by_enterprise_id(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        self.client.post("/api/v1/technologies", data=self.payload(name="Tech E1", enterprise_id=1), format="json")
        self.client.post("/api/v1/technologies", data=self.payload(name="Tech E2", enterprise_id=2), format="json")

        response = self.client.get("/api/v1/technologies?enterpriseId=1")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Tech E1")

    def test_update_and_delete_technology(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        create_response = self.client.post("/api/v1/technologies", data=self.payload(), format="json")
        tech_id = create_response.data["id"]

        patch_response = self.client.patch(
            f"/api/v1/technologies/{tech_id}",
            data={"name": "Tech Updated", "trlStage": 7},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["name"], "Tech Updated")
        self.assertEqual(patch_response.data["trlStage"], 7)
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_UPDATE,
                entity_type="technology",
                entity_id=str(tech_id),
            ).exists()
        )

        delete_response = self.client.delete(f"/api/v1/technologies/{tech_id}")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Technology.objects.filter(id=tech_id).exists())
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_DELETE,
                entity_type="technology",
                entity_id=str(tech_id),
            ).exists()
        )

    def test_bulk_upsert(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        created = self.client.post("/api/v1/technologies", data=self.payload(name="Bulk Base"), format="json")
        tech_id = created.data["id"]

        bulk_payload = [
            {
                "id": tech_id,
                "name": "Bulk Updated",
                "trlStage": 6,
            },
            self.payload(name="Bulk New", enterprise_id=2),
        ]
        response = self.client.put("/api/v1/technologies/bulk", data=bulk_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Technology.objects.count(), 2)
        self.assertEqual(Technology.objects.get(id=tech_id).name, "Bulk Updated")
        self.assertTrue(
            AuditLog.objects.filter(
                action=AuditLog.ACTION_UPDATE,
                entity_type="technology_bulk",
            ).exists()
        )

    def test_bulk_upsert_by_name_when_id_is_unknown(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        created = self.client.post("/api/v1/technologies", data=self.payload(name="Bulk Name Match"), format="json")
        tech_id = created.data["id"]

        bulk_payload = [
            {
                "id": 999999,
                "name": "Bulk Name Match",
                "trlStage": 8,
            }
        ]
        response = self.client.put("/api/v1/technologies/bulk", data=bulk_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Technology.objects.count(), 1)
        self.assertEqual(Technology.objects.get(id=tech_id).trl_stage, 8)

    def test_create_duplicate_name_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        first = self.client.post("/api/v1/technologies", data=self.payload(name="Tech Duplicate"), format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post("/api/v1/technologies", data=self.payload(name="Tech Duplicate"), format="json")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(second.data["ok"])
        self.assertEqual(second.data["code"], "bad_request")
        self.assertIn("name", second.data["details"])

    def test_invalid_enterprise_filter_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        response = self.client.get("/api/v1/technologies?enterpriseId=bad")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")

    def test_requires_authentication(self):
        response = self.client.get("/api/v1/technologies")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "unauthorized")

    def test_analyst_cannot_write(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.analyst_token}")
        response = self.client.post("/api/v1/technologies", data=self.payload(name="Analyst Tech"), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "forbidden")

    def test_create_with_duplicate_directions_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        bad_payload = self.payload(name="Duplicate Directions")
        bad_payload["directions"] = [1, 1]
        response = self.client.post("/api/v1/technologies", data=bad_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")
        self.assertIn("directions", response.data["details"])

    def test_create_with_duplicate_enterprise_rows_returns_400(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.architect_token}")
        bad_payload = self.payload(name="Duplicate Enterprises")
        bad_payload["enterprises"] = [
            {
                "enterpriseId": 1,
                "technologicalReadiness": 3,
                "organizationalReadiness": 3,
                "status": "planned",
            },
            {
                "enterpriseId": 1,
                "technologicalReadiness": 4,
                "organizationalReadiness": 4,
                "status": "planned",
            },
        ]
        response = self.client.post("/api/v1/technologies", data=bad_payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")
        self.assertIn("enterprises.enterpriseId", response.data["details"])
