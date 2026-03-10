import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.test import APITestCase

from auth_custom.models import UserProfile
from auth_custom.totp_utils import generate_totp_token
from config.observability import reset_metrics

User = get_user_model()


class TestMetricsApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        reset_metrics()
        self.admin = User.objects.create_user(username="admin", password="admin123")
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        admin_profile.role = UserProfile.ROLE_ADMIN
        admin_profile.is_2fa_enabled = True
        admin_profile.totp_secret = self.TEST_2FA_SECRET
        admin_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.analyst = User.objects.create_user(username="analyst", password="analyst123")
        analyst_profile, _ = UserProfile.objects.get_or_create(user=self.analyst)
        analyst_profile.role = UserProfile.ROLE_ANALYST
        analyst_profile.is_2fa_enabled = True
        analyst_profile.totp_secret = self.TEST_2FA_SECRET
        analyst_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.admin_token = self._login("admin", "admin123")
        self.analyst_token = self._login("analyst", "analyst123")

    def _login(self, username: str, password: str) -> str:
        login_response = self.client.post(
            "/api/v1/auth/login",
            data={"username": username, "password": password},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        session_id = login_response.data["session_id"]

        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify",
            data={"session_id": session_id, "code": generate_totp_token(self.TEST_2FA_SECRET)},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        return verify_response.data["access_token"]

    def test_metrics_endpoint_requires_admin_role(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.analyst_token}")
        denied = self.client.get("/api/v1/metrics")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        allowed = self.client.get("/api/v1/metrics")
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertIn("counters", allowed.data)

    def test_metrics_contains_auth_failure_counter(self):
        invalid_login = self.client.post(
            "/api/v1/auth/login",
            data={"username": "admin", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(invalid_login.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        metrics = self.client.get("/api/v1/metrics")
        self.assertEqual(metrics.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(metrics.data["counters"].get("auth.login.failure", 0), 1)


class TestErrorFormatApi(APITestCase):
    def _assert_standard_error(self, response, expected_status: int):
        self.assertEqual(response.status_code, expected_status)
        self.assertFalse(response.data["ok"])
        self.assertIsInstance(response.data.get("error"), str)
        self.assertIsInstance(response.data.get("message"), str)
        self.assertIsInstance(response.data.get("code"), str)

    def test_health_method_not_allowed_has_standard_error(self):
        response = self.client.post("/api/v1/health", data={}, format="json")
        self._assert_standard_error(response, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_unauthorized_access_has_standard_error(self):
        response = self.client.get("/api/v1/technologies")
        self._assert_standard_error(response, status.HTTP_401_UNAUTHORIZED)

    def test_validation_error_has_standard_error(self):
        response = self.client.post(
            "/api/v1/auth/2fa/verify",
            data={"session_id": "", "code": "abc"},
            format="json",
        )
        self._assert_standard_error(response, status.HTTP_400_BAD_REQUEST)
        self.assertIn("details", response.data)


class TestSchemaDocsApi(APITestCase):
    def test_openapi_json_endpoint(self):
        response = self.client.get("/api/v1/openapi.json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("openapi", response.data)
        self.assertIn("paths", response.data)
        self.assertIn("/api/v1/auth/login", response.data["paths"])

    def test_swagger_ui_endpoint(self):
        response = self.client.get("/api/v1/docs")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.content.decode("utf-8")
        self.assertIn("SwaggerUIBundle", body)
        self.assertIn("/api/v1/openapi.json", body)


class TestOpenApiExportCommand(SimpleTestCase):
    def test_export_openapi_command_creates_json_file(self):
        output_path = Path(settings.BASE_DIR) / "openapi.test.json"
        try:
            call_command("export_openapi", output=str(output_path))
            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertIn("openapi", payload)
            self.assertIn("paths", payload)
        finally:
            if output_path.exists():
                output_path.unlink()
