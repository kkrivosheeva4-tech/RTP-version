import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.staticfiles import finders
from django.core.cache import cache
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
        cache.clear()
        reset_metrics()
        self.admin = User.objects.create_user(
            username="Admin User",
            email="admin@example.com",
            password="Adminpass123!",
        )
        admin_profile, _ = UserProfile.objects.get_or_create(user=self.admin)
        admin_profile.role = UserProfile.ROLE_ADMIN
        admin_profile.is_2fa_enabled = True
        admin_profile.totp_secret = self.TEST_2FA_SECRET
        admin_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.guest = User.objects.create_user(
            username="Guest User",
            email="guest@example.com",
            password="Guestpass123!",
        )
        guest_profile, _ = UserProfile.objects.get_or_create(user=self.guest)
        guest_profile.role = UserProfile.ROLE_GUEST
        guest_profile.is_2fa_enabled = True
        guest_profile.totp_secret = self.TEST_2FA_SECRET
        guest_profile.save(update_fields=["role", "is_2fa_enabled", "totp_secret", "updated_at"])

        self.admin_token = self._login("admin@example.com", "Adminpass123!")
        self.guest_token = self._login("guest@example.com", "Guestpass123!")

    def tearDown(self):
        cache.clear()

    def _login(self, email: str, password: str) -> str:
        login_response = self.client.post(
            "/api/v1/auth/login",
            data={"email": email, "password": password},
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
            data={"email": "admin@example.com", "password": "Wrongpass1!"},
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

    def test_csp_header_contains_hardening_directives(self):
        response = self.client.get("/api/v1/docs")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        policy = response["Content-Security-Policy"]
        self.assertIn("form-action 'self'", policy)
        self.assertIn("frame-src 'none'", policy)
        self.assertIn("manifest-src 'self'", policy)
        self.assertIn("media-src 'self'", policy)


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
        self.assertEqual(env_values["DB_ENGINE"], "postgresql")
        self.assertTrue(int(env_values["SECURE_HSTS_SECONDS"]) > 0)
        self.assertEqual(env_values["CSP_INCLUDE_UPGRADE_INSECURE_REQUESTS"], "True")
        self.assertTrue(env_values["CORS_ALLOWED_ORIGINS"].startswith("https://"))
        self.assertTrue(env_values["CSRF_TRUSTED_ORIGINS"].startswith("https://"))

    def test_default_env_example_uses_postgres_cookie_and_django_serving_baseline(self):
        env_values = self._read_env_file(".env.example")

        self.assertEqual(env_values["DB_ENGINE"], "postgresql")
        self.assertEqual(env_values["AUTH_REFRESH_COOKIE_ENABLED"], "True")
        self.assertEqual(env_values["AUTH_RETURN_REFRESH_TOKEN_IN_BODY"], "False")
        self.assertEqual(env_values["AUTH_REFRESH_REQUIRE_CSRF"], "True")
        self.assertEqual(env_values["CORS_ALLOW_CREDENTIALS"], "True")
        self.assertIn("CSP_SCRIPT_SRC_EXTRA", env_values)
        self.assertIn("TOTP_SECRET_ENCRYPTION_KEY", env_values)


class TestUiTemplateRoutes(SimpleTestCase):
    def test_home_route_renders_through_django(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "detailViewLink")

    def test_home_route_remains_public_without_redirect_to_login(self):
        response = self.client.get("/", follow=False)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(response.status_code, {301, 302, 303, 307, 308})
        self.assertContains(response, 'id="authInfo"', html=False)
        self.assertContains(response, 'id="logoutContainer"', html=False)
        self.assertContains(response, "/static/main.js")
        self.assertNotContains(response, "/auth/login/")

    def test_radar_route_renders_through_django(self):
        response = self.client.get("/radar/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'id="rmk-director"', html=False)

    def test_admin_panel_route_renders_through_django(self):
        response = self.client.get("/admin-panel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "Админ-панель", html=False)

    def test_admin_panel_uses_static_asset_urls(self):
        response = self.client.get("/admin-panel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "/static/css/admin.css")
        self.assertContains(response, "/static/js/admin.js")
        self.assertContains(response, "/static/js/modules/core/api-client.js")
        self.assertNotContains(response, "/src/css/")
        self.assertNotContains(response, "/src/js/")

    def test_admin_panel_contains_user_management_controls(self):
        response = self.client.get("/admin-panel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'id="addUserBtn"', html=False)
        self.assertContains(response, 'id="userPassword"', html=False)
        self.assertContains(response, 'id="generateUserPasswordBtn"', html=False)
        self.assertContains(response, 'id="toggleUserPasswordBtn"', html=False)
        self.assertContains(response, 'При первом входе пользователь должен будет его сменить.', html=False)

    def test_help_route_renders_through_django(self):
        response = self.client.get("/help/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "help-nav-menu")

    def test_auth_login_route_uses_new_template(self):
        response = self.client.get("/auth/login/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'id="loginForm"', html=False)
        self.assertContains(response, "/auth/2fa/setup/")

    def test_auth_2fa_setup_route_uses_new_template(self):
        response = self.client.get("/auth/2fa/setup/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'id="retryQrBtn"', html=False)
        self.assertContains(response, "/auth/login/")

    def test_auth_change_password_route_uses_new_template(self):
        response = self.client.get("/auth/change-password/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'id="changePasswordForm"', html=False)
        self.assertContains(response, "/static/js/auth-change-password.js")

    def test_auth_2fa_verify_route_uses_new_template(self):
        response = self.client.get("/auth/2fa/verify/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, 'id="verify2faForm"', html=False)
        self.assertContains(response, "/auth/2fa/setup/")

    def test_unknown_ui_path_no_longer_falls_back_to_dist(self):
        response = self.client.get("/dashboard")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class TestStaticfilesMigration(SimpleTestCase):
    def test_staticfiles_find_migrated_assets(self):
        self.assertIsNotNone(finders.find("css/auth.css"))
        self.assertIsNotNone(finders.find("js/auth.js"))
        self.assertIsNotNone(finders.find("data/ru/technologies.json"))
        self.assertIsNotNone(finders.find("img/icon.png"))
        self.assertIsNotNone(finders.find("main.js"))

    def test_home_and_auth_templates_reference_static_runtime_paths(self):
        home = self.client.get("/")
        self.assertEqual(home.status_code, status.HTTP_200_OK)
        self.assertContains(home, "/static/main.js")
        self.assertNotContains(home, "/static/home-public.js")
        self.assertContains(home, "/static/css/styles.css")

        auth = self.client.get("/auth/login/")
        self.assertEqual(auth.status_code, status.HTTP_200_OK)
        self.assertContains(auth, "/static/css/auth.css")
        self.assertContains(auth, "/static/js/auth.js")
