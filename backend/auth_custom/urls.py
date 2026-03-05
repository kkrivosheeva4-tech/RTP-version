from django.urls import path

from auth_custom.views import LoginAPIView, LogoutAPIView, MeAPIView, RefreshAPIView

urlpatterns = [
    path("login", LoginAPIView.as_view(), name="auth-login-noslash"),
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path("refresh", RefreshAPIView.as_view(), name="auth-refresh-noslash"),
    path("refresh/", RefreshAPIView.as_view(), name="auth-refresh"),
    path("logout", LogoutAPIView.as_view(), name="auth-logout-noslash"),
    path("logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("me", MeAPIView.as_view(), name="auth-me-noslash"),
    path("me/", MeAPIView.as_view(), name="auth-me"),
]
