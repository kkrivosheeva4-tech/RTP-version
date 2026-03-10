from django.urls import path

from auth_custom.views import (
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    RefreshAPIView,
    TwoFASetupAPIView,
    TwoFAVerifyAPIView,
)

urlpatterns = [
    path("login", LoginAPIView.as_view(), name="auth-login-noslash"),
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path("refresh", RefreshAPIView.as_view(), name="auth-refresh-noslash"),
    path("refresh/", RefreshAPIView.as_view(), name="auth-refresh"),
    path("2fa/setup", TwoFASetupAPIView.as_view(), name="auth-2fa-setup-noslash"),
    path("2fa/setup/", TwoFASetupAPIView.as_view(), name="auth-2fa-setup"),
    path("2fa/verify", TwoFAVerifyAPIView.as_view(), name="auth-2fa-verify-noslash"),
    path("2fa/verify/", TwoFAVerifyAPIView.as_view(), name="auth-2fa-verify"),
    path("logout", LogoutAPIView.as_view(), name="auth-logout-noslash"),
    path("logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("me", MeAPIView.as_view(), name="auth-me-noslash"),
    path("me/", MeAPIView.as_view(), name="auth-me"),
]
