from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from auth_custom.models import RefreshToken, UserProfile

User = get_user_model()


class TestAuthApi(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="architect", password="architect123")
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.role = UserProfile.ROLE_ARCHITECT
        profile.save(update_fields=["role", "updated_at"])

    def test_login_refresh_logout_flow(self):
        login_response = self.client.post(
            "/api/v1/auth/login/",
            data={"username": "architect", "password": "architect123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", login_response.data)
        self.assertIn("refresh_token", login_response.data)

        refresh_token = login_response.data["refresh_token"]
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

    def test_me_endpoint(self):
        login_response = self.client.post(
            "/api/v1/auth/login",
            data={"username": "architect", "password": "architect123"},
            format="json",
        )
        access_token = login_response.data["access_token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        me_response = self.client.get("/api/v1/users/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["username"], "architect")
        self.assertEqual(me_response.data["role"], UserProfile.ROLE_ARCHITECT)

    def test_invalid_login(self):
        response = self.client.post(
            "/api/v1/auth/login/",
            data={"username": "architect", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
