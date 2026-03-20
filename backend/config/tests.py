import json
import shutil
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.http import Http404
from django.test import RequestFactory, SimpleTestCase, override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from auth_custom.models import UserProfile
from auth_custom.totp_utils import generate_totp_token
from config.observability import reset_metrics
from config.views import frontend_dist_view

User = get_user_model()


class TestMetricsApi(APITestCase):
    TEST_2FA_SECRET = "JBSWY3DPEHPK3PXP"

    def setUp(self):
        cache.clear()
        reset_metrics()
        self.admin = User.objects.create_user(username="admin", password="admin123")
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        admin_profile.role = UserProfile.ROLE_ADMIN
        admin_profile.is_2fa_enabled = True
        admin_profile.totp_secret = self.TEST_2FA_SECRET
        admin_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.guest = User.objects.create_user(username="guest", password="guest123")
        guest_profile, _ = UserProfile.objects.get_or_create(user=self.guest)
        guest_profile.role = UserProfile.ROLE_GUEST
        guest_profile.is_2fa_enabled = True
        guest_profile.totp_secret = self.TEST_2FA_SECRET
        guest_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.admin_token = self._login("admin", "admin123")
        self.guest_token = self._login("guest", "guest123")

    def tearDown(self):
        cache.clear()

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
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.guest_token}")
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
        self.assertGreaterEqual(metrics.data["counters"].get("http.requests.total", 0), 1)


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
        self.assertIn("Content-Security-Policy", response)

    def test_swagger_ui_endpoint(self):
        response = self.client.get("/api/v1/docs")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.content.decode("utf-8")
        self.assertIn("SwaggerUIBundle", body)
        self.assertIn("/api/v1/openapi.json", body)
        self.assertIn("/api/v1/docs/assets/swagger-ui.css", body)
        self.assertIn("/api/v1/docs/assets/swagger-ui-bundle.js", body)
        self.assertNotIn("https://unpkg.com", body)
        self.assertIn("Content-Security-Policy", response)

    def test_swagger_ui_assets_are_served_locally(self):
        response = self.client.get("/api/v1/docs/assets/swagger-ui.css")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("text/css", response["Content-Type"])
        self.assertIn("Content-Security-Policy", response)


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


class TestEnvProfiles(SimpleTestCase):
    def _read_env_file(self, filename: str) -> dict[str, str]:
        env_path = Path(settings.BASE_DIR) / filename
        values: dict[str, str] = {}
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            values[key.strip()] = value.strip()
        return values

    def test_test_env_example_uses_https_by_default_profile(self):
        env_values = self._read_env_file(".env.test.example")

        self.assertEqual(env_values["SECURE_SSL_REDIRECT"], "True")
        self.assertEqual(env_values["SESSION_COOKIE_SECURE"], "True")
        self.assertEqual(env_values["CSRF_COOKIE_SECURE"], "True")
        self.assertEqual(env_values["AUTH_REFRESH_COOKIE_SECURE"], "True")
        self.assertEqual(env_values["SECURE_PROXY_SSL_HEADER_ENABLED"], "True")
        self.assertEqual(env_values["SERVE_FRONTEND_FROM_DJANGO"], "True")
        self.assertEqual(env_values["DB_ENGINE"], "postgresql")
        self.assertTrue(int(env_values["SECURE_HSTS_SECONDS"]) > 0)
        self.assertTrue(env_values["CORS_ALLOWED_ORIGINS"].startswith("https://"))
        self.assertTrue(env_values["CSRF_TRUSTED_ORIGINS"].startswith("https://"))

    def test_default_env_example_uses_postgres_cookie_and_django_serving_baseline(self):
        env_values = self._read_env_file(".env.example")

        self.assertEqual(env_values["DB_ENGINE"], "postgresql")
        self.assertEqual(env_values["SERVE_FRONTEND_FROM_DJANGO"], "True")
        self.assertEqual(env_values["AUTH_REFRESH_COOKIE_ENABLED"], "True")
        self.assertEqual(env_values["AUTH_RETURN_REFRESH_TOKEN_IN_BODY"], "False")
        self.assertEqual(env_values["AUTH_REFRESH_REQUIRE_CSRF"], "True")
        self.assertEqual(env_values["CORS_ALLOW_CREDENTIALS"], "True")


class TestFrontendDistServing(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        base_tmp_dir = Path(settings.BASE_DIR) / ".tmp" / "frontend-dist-tests"
        shutil.rmtree(base_tmp_dir, ignore_errors=True)
        self.dist_dir = base_tmp_dir
        self.dist_dir.mkdir(parents=True, exist_ok=True)
        (self.dist_dir / "assets").mkdir(parents=True, exist_ok=True)
        (self.dist_dir / "index.html").write_text("<html><body>frontend-ok</body></html>", encoding="utf-8")
        (self.dist_dir / "assets" / "app.js").write_text("console.log('frontend-asset');", encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dist_dir, ignore_errors=True)

    @override_settings(DEBUG=False)
    def test_frontend_root_serves_index_from_dist(self):
        with self.settings(FRONTEND_DIST_DIR=self.dist_dir):
            response = frontend_dist_view(self.factory.get("/"), "")
            body = b"".join(response.streaming_content).decode("utf-8")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("frontend-ok", body)
            self.assertIn("text/html", response["Content-Type"])

    @override_settings(DEBUG=False)
    def test_frontend_asset_serves_requested_file(self):
        with self.settings(FRONTEND_DIST_DIR=self.dist_dir):
            response = frontend_dist_view(self.factory.get("/assets/app.js"), "assets/app.js")
            body = b"".join(response.streaming_content).decode("utf-8")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("frontend-asset", body)
            self.assertIn("text/javascript", response["Content-Type"])

    @override_settings(DEBUG=False)
    def test_frontend_spa_route_falls_back_to_index(self):
        with self.settings(FRONTEND_DIST_DIR=self.dist_dir):
            response = frontend_dist_view(self.factory.get("/dashboard"), "dashboard")
            body = b"".join(response.streaming_content).decode("utf-8")
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn("frontend-ok", body)

    @override_settings(DEBUG=False)
    def test_frontend_missing_asset_with_suffix_stays_404(self):
        with self.settings(FRONTEND_DIST_DIR=self.dist_dir):
            with self.assertRaises(Http404):
                frontend_dist_view(self.factory.get("/assets/missing.js"), "assets/missing.js")
