from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog
from auth_custom.models import RefreshToken, UserProfile
from auth_custom.totp_utils import generate_totp_token
from config.observability import get_metrics_snapshot, reset_metrics

User = get_user_model()


class TestAuthApi(APITestCase):
    def setUp(self):
        reset_metrics()
        self.user = User.objects.create_user(username="architect", password="architect123")
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.ROLE_ARCHITECT
        profile.save(update_fields=["role", "updated_at"])

    def _login_for_2fa(self, username="architect", password="architect123"):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"username": username, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("requires_2fa"))
        self.assertIn("session_id", response.data)
        return response

    def test_login_setup_verify_refresh_logout_flow(self):
        login_response = self._login_for_2fa()
        self.assertFalse(login_response.data.get("is_2fa_setup"))

        setup_response = self.client.post(
            "/api/v1/auth/2fa/setup/",
            data={"session_id": login_response.data["session_id"]},
            format="json",
        )
        self.assertEqual(setup_response.status_code, status.HTTP_200_OK)
        self.assertIn("secret", setup_response.data)
        self.assertIn("qr_url", setup_response.data)

        code = generate_totp_token(setup_response.data["secret"])
        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={"session_id": login_response.data["session_id"], "code": code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", verify_response.data)
        self.assertIn("refresh_token", verify_response.data)

        refresh_token = verify_response.data["refresh_token"]
        refresh_response = self.client.post(
            "/api/v1/auth/refresh",
            data={"refresh_token": refresh_token},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", refresh_response.data)
        self.assertIn("refresh_token", refresh_response.data)
        self.assertNotEqual(refresh_response.data["refresh_token"], refresh_token)

        logout_response = self.client.post(
            "/api/v1/auth/logout",
            data={"refresh_token": refresh_response.data["refresh_token"]},
            format="json",
        )
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RefreshToken.objects.filter(revoked_at__isnull=True).count(), 0)
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.ACTION_LOGIN, entity_type="auth").exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(action=AuditLog.ACTION_LOGOUT, entity_type="auth").exists()
        )

    def test_existing_2fa_user_verify_flow(self):
        profile = self.user.profile
        profile.totp_secret = "JBSWY3DPEHPK3PXP"
        profile.is_2fa_enabled = True
        profile.save(update_fields=["totp_secret", "is_2fa_enabled", "updated_at"])

        login_response = self._login_for_2fa()
        self.assertTrue(login_response.data.get("is_2fa_setup"))

        code = generate_totp_token(profile.totp_secret)
        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={"session_id": login_response.data["session_id"], "code": code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", verify_response.data)

    def test_invalid_2fa_code(self):
        profile = self.user.profile
        profile.totp_secret = "JBSWY3DPEHPK3PXP"
        profile.is_2fa_enabled = True
        profile.save(update_fields=["totp_secret", "is_2fa_enabled", "updated_at"])

        login_response = self._login_for_2fa()
        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={"session_id": login_response.data["session_id"], "code": "000000"},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(verify_response.data["ok"])
        self.assertEqual(verify_response.data["code"], "unauthorized")

    def test_me_endpoint(self):
        login_response = self._login_for_2fa()
        setup_response = self.client.post(
            "/api/v1/auth/2fa/setup/",
            data={"session_id": login_response.data["session_id"]},
            format="json",
        )
        code = generate_totp_token(setup_response.data["secret"])
        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={"session_id": login_response.data["session_id"], "code": code},
            format="json",
        )
        access_token = verify_response.data["access_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        me_response = self.client.get("/api/v1/users/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["username"], "architect")
        self.assertEqual(me_response.data["role"], UserProfile.ROLE_ARCHITECT)
        self.assertTrue(me_response.data["is_2fa_enabled"])

    def test_invalid_login(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"username": "architect", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "unauthorized")
        self.assertGreaterEqual(get_metrics_snapshot().get("auth.login.failure", 0), 1)

    def test_refresh_failure_increments_metrics(self):
        response = self.client.post(
            "/api/v1/auth/refresh",
            data={"refresh_token": "invalid"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "unauthorized")
        self.assertGreaterEqual(get_metrics_snapshot().get("auth.refresh.failure", 0), 1)


@override_settings(
    AUTH_LOGIN_RATE="2/min",
    AUTH_REFRESH_RATE="2/min",
    AUTH_2FA_RATE="2/min",
    AUTH_LOGOUT_RATE="2/min",
)
class TestAuthRateLimitApi(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="rate-user", password="rate-pass-123")

    def tearDown(self):
        cache.clear()

    def test_login_rate_limit_returns_429(self):
        for _ in range(2):
            response = self.client.post(
                "/api/v1/auth/login/",
                data={"username": self.user.username, "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        limited_response = self.client.post(
            "/api/v1/auth/login/",
            data={"username": self.user.username, "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(limited_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(limited_response.data["ok"])
        self.assertEqual(limited_response.data["code"], "too_many_requests")

    def test_refresh_rate_limit_returns_429(self):
        for _ in range(2):
            response = self.client.post(
                "/api/v1/auth/refresh/",
                data={"refresh_token": "invalid"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        limited_response = self.client.post(
            "/api/v1/auth/refresh/",
            data={"refresh_token": "invalid"},
            format="json",
        )
        self.assertEqual(limited_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(limited_response.data["ok"])
        self.assertEqual(limited_response.data["code"], "too_many_requests")
