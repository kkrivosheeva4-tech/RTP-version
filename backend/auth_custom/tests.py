import unittest
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from admin_panel.models import AuditLog
from auth_custom import views as auth_views
from auth_custom.models import RefreshToken, UserPasswordHistory, UserProfile
from auth_custom.secret_encryption import is_encrypted_totp_secret
from auth_custom.totp_utils import generate_totp_token, get_totp_provider, verify_totp_token
from config.observability import get_metrics_snapshot, reset_metrics

User = get_user_model()


@override_settings(
    AUTH_REFRESH_COOKIE_ENABLED=True,
    AUTH_RETURN_REFRESH_TOKEN_IN_BODY=False,
    AUTH_REFRESH_COOKIE_SECURE=False,
    AUTH_REFRESH_COOKIE_SAMESITE="Lax",
    AUTH_REFRESH_COOKIE_PATH="/api/v1/auth/",
)
class TestAuthApi(APITestCase):
    def setUp(self):
        cache.clear()
        reset_metrics()
        self.user = User.objects.create_user(
            username="Architect QA",
            email="architect@example.com",
            password="Architect123!",
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.ROLE_OWNER
        profile.save(update_fields=["role", "updated_at"])

    def tearDown(self):
        cache.clear()

    def _set_2fa_required(self, *, secret=""):
        profile = self.user.profile
        profile.is_2fa_enabled = True
        profile.totp_secret = secret
        profile.save(update_fields=["is_2fa_enabled", "totp_secret", "updated_at"])
        return profile

    def _login_for_2fa(self, email="architect@example.com", password="Architect123!"):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": email, "password": password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get("requires_2fa"))
        self.assertIn("session_id", response.data)
        return response

    def _csrf_headers(self):
        csrf_cookie = self.client.cookies.get(
            getattr(settings, "CSRF_COOKIE_NAME", "csrftoken")
        )
        self.assertIsNotNone(csrf_cookie)
        return {"HTTP_X_CSRFTOKEN": csrf_cookie.value}

    def test_login_without_2fa_returns_tokens_immediately(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.data)
        self.assertNotIn("refresh_token", response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)
        self.assertNotIn("requires_2fa", response.data)

    def test_login_requires_password_change_before_tokens(self):
        profile = self.user.profile
        profile.must_change_password = True
        profile.save(update_fields=["must_change_password", "updated_at"])

        response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["requires_password_change"])
        self.assertIn("session_id", response.data)
        self.assertNotIn("access_token", response.data)

    def test_password_change_completes_login_without_2fa(self):
        profile = self.user.profile
        profile.must_change_password = True
        profile.save(update_fields=["must_change_password", "updated_at"])

        login_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertTrue(login_response.data["requires_password_change"])

        change_response = self.client.post(
            "/api/v1/auth/change-password/",
            data={
                "session_id": login_response.data["session_id"],
                "new_password": "ValidPass9!",
                "new_password_confirm": "ValidPass9!",
            },
            format="json",
        )
        self.assertEqual(change_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", change_response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, change_response.cookies)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("ValidPass9!"))
        self.assertFalse(self.user.profile.must_change_password)

    def test_password_change_redirects_into_2fa_when_enabled(self):
        profile = self._set_2fa_required(secret="JBSWY3DPEHPK3PXP")
        profile.must_change_password = True
        profile.save(update_fields=["is_2fa_enabled", "totp_secret", "must_change_password", "updated_at"])

        login_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertTrue(login_response.data["requires_password_change"])

        change_response = self.client.post(
            "/api/v1/auth/change-password/",
            data={
                "session_id": login_response.data["session_id"],
                "new_password": "ValidPass9!",
                "new_password_confirm": "ValidPass9!",
            },
            format="json",
        )
        self.assertEqual(change_response.status_code, status.HTTP_200_OK)
        self.assertTrue(change_response.data["requires_2fa"])
        self.assertTrue(change_response.data["is_2fa_setup"])
        self.assertNotIn("access_token", change_response.data)

        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={
                "session_id": change_response.data["session_id"],
                "code": generate_totp_token(profile.totp_secret),
            },
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", verify_response.data)

    def test_login_setup_verify_refresh_logout_flow(self):
        self._set_2fa_required(secret="")
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
        self.user.profile.refresh_from_db()
        self.assertTrue(self.user.profile.is_2fa_enabled)

        code = generate_totp_token(setup_response.data["secret"])
        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={"session_id": login_response.data["session_id"], "code": code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", verify_response.data)
        self.assertNotIn("refresh_token", verify_response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, verify_response.cookies)

        refresh_response = self.client.post(
            "/api/v1/auth/refresh",
            data={},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", refresh_response.data)
        self.assertNotIn("refresh_token", refresh_response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, refresh_response.cookies)

        logout_response = self.client.post(
            "/api/v1/auth/logout",
            data={},
            format="json",
            **self._csrf_headers(),
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
        profile = self._set_2fa_required(secret="JBSWY3DPEHPK3PXP")

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

    @unittest.skipUnless(
        auth_views.qrcode is not None and auth_views.SvgImage is not None,
        "Python qrcode dependency is not installed in the current environment",
    )
    def test_2fa_qr_endpoint_returns_svg_from_python_runtime(self):
        self._set_2fa_required(secret="JBSWY3DPEHPK3PXP")
        login_response = self._login_for_2fa()

        qr_response = self.client.get(
            f"/api/v1/auth/2fa/qr/?session_id={login_response.data['session_id']}"
        )
        self.assertEqual(qr_response.status_code, status.HTTP_200_OK)
        self.assertIn("image/svg+xml", qr_response["Content-Type"])
        self.assertIn("<svg", qr_response.content.decode("utf-8"))

    @patch("auth_custom.views.SvgImage", None)
    @patch("auth_custom.views.qrcode", None)
    def test_2fa_qr_endpoint_returns_503_without_python_qr_dependency(self):
        self._set_2fa_required(secret="JBSWY3DPEHPK3PXP")
        login_response = self._login_for_2fa()

        qr_response = self.client.get(
            f"/api/v1/auth/2fa/qr/?session_id={login_response.data['session_id']}"
        )
        self.assertEqual(qr_response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(qr_response.data["ok"])

    def test_invalid_2fa_code(self):
        self._set_2fa_required(secret="JBSWY3DPEHPK3PXP")

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
        self._set_2fa_required(secret="")
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
        self.assertEqual(me_response.data["username"], "Architect QA")
        self.assertEqual(me_response.data["email"], "architect@example.com")
        self.assertEqual(me_response.data["role"], UserProfile.ROLE_OWNER)
        self.assertTrue(me_response.data["is_2fa_enabled"])

    def test_invalid_login(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Wrongpass1!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "unauthorized")
        self.assertGreaterEqual(get_metrics_snapshot().get("auth.login.failure", 0), 1)

    def test_login_rejects_email_with_spaces(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": " architect@example.com ", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")
        self.assertIn("email", response.data.get("details", {}))

    def test_account_is_locked_after_ten_failed_attempts(self):
        for attempt in range(10):
            response = self.client.post(
                "/api/v1/auth/login/",
                data={"email": "architect@example.com", "password": "Wrongpass1!"},
                format="json",
            )
            expected_status = (
                status.HTTP_423_LOCKED if attempt == 9 else status.HTTP_401_UNAUTHORIZED
            )
            self.assertEqual(response.status_code, expected_status)

        self.user.refresh_from_db()
        self.assertTrue(self.user.profile.is_locked)
        self.assertEqual(self.user.profile.failed_login_attempts, 10)

        locked_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(locked_response.status_code, status.HTTP_423_LOCKED)
        self.assertFalse(locked_response.data["ok"])

    def test_password_history_blocks_reuse_of_recent_passwords(self):
        UserPasswordHistory.objects.create(user=self.user, password_hash=self.user.password)
        profile = self.user.profile
        profile.must_change_password = True
        profile.save(update_fields=["must_change_password", "updated_at"])

        login_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        change_response = self.client.post(
            "/api/v1/auth/change-password/",
            data={
                "session_id": login_response.data["session_id"],
                "new_password": "Architect123!",
                "new_password_confirm": "Architect123!",
            },
            format="json",
        )
        self.assertEqual(change_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(change_response.data["ok"])

    def test_password_change_rejects_mismatched_confirmation(self):
        profile = self.user.profile
        profile.must_change_password = True
        profile.save(update_fields=["must_change_password", "updated_at"])

        login_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "architect@example.com", "password": "Architect123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        change_response = self.client.post(
            "/api/v1/auth/change-password/",
            data={
                "session_id": login_response.data["session_id"],
                "new_password": "ValidPass9!",
                "new_password_confirm": "ValidPass8!",
            },
            format="json",
        )
        self.assertEqual(change_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password_confirm", change_response.data.get("details", {}))

    def test_refresh_failure_increments_metrics(self):
        response = self.client.post(
            "/api/v1/auth/refresh",
            data={},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data["ok"])
        self.assertEqual(response.data["code"], "bad_request")
        self.assertGreaterEqual(get_metrics_snapshot().get("auth.refresh.failure", 0), 1)

    def test_totp_utils_backward_compatible_secret_normalization(self):
        secret = " jbswy3dpehpk3pxp "
        token = generate_totp_token(secret, at_time=1_700_000_000)
        self.assertTrue(
            verify_totp_token(
                secret.lower(),
                token,
                at_time=1_700_000_000,
                window=0,
            )
        )
        self.assertEqual(get_totp_provider(), "pyotp")

    def test_totp_secret_is_encrypted_at_rest(self):
        secret = "JBSWY3DPEHPK3PXP"
        profile = self._set_2fa_required(secret=secret)
        profile.refresh_from_db()

        self.assertEqual(profile.totp_secret, secret)
        self.assertNotEqual(profile.totp_secret_encrypted, secret)
        self.assertTrue(is_encrypted_totp_secret(profile.totp_secret_encrypted))


@override_settings(
    AUTH_LOGIN_RATE="2/min",
    AUTH_REFRESH_RATE="2/min",
    AUTH_2FA_RATE="2/min",
    AUTH_LOGOUT_RATE="2/min",
)
class TestAuthRateLimitApi(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="Rate User",
            email="rate-user@example.com",
            password="Ratepass123!",
        )

    def tearDown(self):
        cache.clear()

    def test_login_rate_limit_returns_429(self):
        for _ in range(2):
            response = self.client.post(
                "/api/v1/auth/login/",
                data={"email": self.user.email, "password": "Wrongpass1!"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        limited_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": self.user.email, "password": "Wrongpass1!"},
            format="json",
        )
        self.assertEqual(limited_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(limited_response.data["ok"])
        self.assertEqual(limited_response.data["code"], "too_many_requests")

    def test_refresh_rate_limit_returns_429(self):
        for _ in range(2):
            response = self.client.post(
                "/api/v1/auth/refresh/",
                data={},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        limited_response = self.client.post(
            "/api/v1/auth/refresh/",
            data={},
            format="json",
        )
        self.assertEqual(limited_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(limited_response.data["ok"])
        self.assertEqual(limited_response.data["code"], "too_many_requests")


@override_settings(
    AUTH_REFRESH_COOKIE_ENABLED=True,
    AUTH_RETURN_REFRESH_TOKEN_IN_BODY=False,
    AUTH_REFRESH_COOKIE_SECURE=False,
    AUTH_REFRESH_COOKIE_SAMESITE="Lax",
    AUTH_REFRESH_COOKIE_PATH="/api/v1/auth/",
)
class TestAuthCookieRefreshFlow(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="Cookie User",
            email="cookie-user@example.com",
            password="Cookiepass123!",
        )
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.ROLE_OWNER
        profile.save(update_fields=["role", "updated_at"])

    def tearDown(self):
        cache.clear()

    def _set_2fa_required(self, *, secret=""):
        profile = self.user.profile
        profile.is_2fa_enabled = True
        profile.totp_secret = secret
        profile.save(update_fields=["is_2fa_enabled", "totp_secret", "updated_at"])
        return profile

    def _csrf_headers(self):
        csrf_cookie = self.client.cookies.get(
            getattr(settings, "CSRF_COOKIE_NAME", "csrftoken")
        )
        self.assertIsNotNone(csrf_cookie)
        return {"HTTP_X_CSRFTOKEN": csrf_cookie.value}

    def _complete_2fa(self):
        self._set_2fa_required(secret="")
        login_response = self.client.post(
            "/api/v1/auth/login/",
            data={"email": "cookie-user@example.com", "password": "Cookiepass123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        setup_response = self.client.post(
            "/api/v1/auth/2fa/setup/",
            data={"session_id": login_response.data["session_id"]},
            format="json",
        )
        self.assertEqual(setup_response.status_code, status.HTTP_200_OK)
        code = generate_totp_token(setup_response.data["secret"])
        verify_response = self.client.post(
            "/api/v1/auth/2fa/verify/",
            data={"session_id": login_response.data["session_id"], "code": code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        return verify_response

    def test_verify_sets_refresh_cookie_and_hides_refresh_token_in_body(self):
        verify_response = self._complete_2fa()
        self.assertIn("access_token", verify_response.data)
        self.assertNotIn("refresh_token", verify_response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, verify_response.cookies)

    def test_refresh_and_logout_accept_cookie_without_body_token(self):
        verify_response = self._complete_2fa()
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, verify_response.cookies)

        refresh_response = self.client.post(
            "/api/v1/auth/refresh/",
            data={},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", refresh_response.data)
        self.assertNotIn("refresh_token", refresh_response.data)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, refresh_response.cookies)

        logout_response = self.client.post(
            "/api/v1/auth/logout/",
            data={},
            format="json",
            **self._csrf_headers(),
        )
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RefreshToken.objects.filter(revoked_at__isnull=True).count(), 0)
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, logout_response.cookies)

    def test_refresh_rejects_cookie_without_csrf_header(self):
        self._complete_2fa()

        refresh_response = self.client.post("/api/v1/auth/refresh/", data={}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(refresh_response.data["ok"])

        logout_response = self.client.post("/api/v1/auth/logout/", data={}, format="json")
        self.assertEqual(logout_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(logout_response.data["ok"])
