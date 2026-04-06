from django.urls import path

from auth_custom.views import (
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    PasswordChangeConfirmAPIView,
    RefreshAPIView,
    TwoFAQrAPIView,
    TwoFASetupAPIView,
    TwoFAVerifyAPIView,
)

urlpatterns = [
    path("login", LoginAPIView.as_view(), name="auth-login-noslash"),
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path(
        "change-password",
        PasswordChangeConfirmAPIView.as_view(),
        name="auth-change-password-noslash",
    ),
    path(
        "change-password/",
        PasswordChangeConfirmAPIView.as_view(),
        name="auth-change-password",
    ),
    path("refresh", RefreshAPIView.as_view(), name="auth-refresh-noslash"),
    path("refresh/", RefreshAPIView.as_view(), name="auth-refresh"),
    path("2fa/setup", TwoFASetupAPIView.as_view(), name="auth-2fa-setup-noslash"),
    path("2fa/setup/", TwoFASetupAPIView.as_view(), name="auth-2fa-setup"),
    path("2fa/qr", TwoFAQrAPIView.as_view(), name="auth-2fa-qr-noslash"),
    path("2fa/qr/", TwoFAQrAPIView.as_view(), name="auth-2fa-qr"),
    path("2fa/verify", TwoFAVerifyAPIView.as_view(), name="auth-2fa-verify-noslash"),
    path("2fa/verify/", TwoFAVerifyAPIView.as_view(), name="auth-2fa-verify"),
    path("logout", LogoutAPIView.as_view(), name="auth-logout-noslash"),
    path("logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("me", MeAPIView.as_view(), name="auth-me-noslash"),
    path("me/", MeAPIView.as_view(), name="auth-me"),
]
