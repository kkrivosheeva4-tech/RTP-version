from django.contrib import admin
from django.urls import include, path

from config.views import (
    ui_admin_panel_view,
    ui_auth_change_password_view,
    ui_auth_2fa_setup_view,
    ui_auth_2fa_verify_view,
    ui_auth_login_view,
    ui_help_view,
    ui_home_view,
    ui_radar_view,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
    path("", ui_home_view, name="ui-home"),
    path("radar/", ui_radar_view, name="ui-radar"),
    path("admin-panel/", ui_admin_panel_view, name="ui-admin-panel"),
    path("auth/login/", ui_auth_login_view, name="ui-auth-login"),
    path("auth/change-password/", ui_auth_change_password_view, name="ui-auth-change-password"),
    path("auth/2fa/setup/", ui_auth_2fa_setup_view, name="ui-auth-2fa-setup"),
    path("auth/2fa/verify/", ui_auth_2fa_verify_view, name="ui-auth-2fa-verify"),
    path("help/", ui_help_view, name="ui-help"),
    # Legacy paths stay available during migration so old hardcoded links keep working.
    path("src/pages/index.html", ui_home_view, name="legacy-ui-home"),
    path("src/pages/radar.html", ui_radar_view, name="legacy-ui-radar"),
    path("src/pages/admin.html", ui_admin_panel_view, name="legacy-ui-admin-panel"),
    path("src/pages/auth.html", ui_auth_login_view, name="legacy-ui-auth-login"),
    path(
        "src/pages/auth-change-password.html",
        ui_auth_change_password_view,
        name="legacy-ui-auth-change-password",
    ),
    path("src/pages/auth-2fa-setup.html", ui_auth_2fa_setup_view, name="legacy-ui-auth-2fa-setup"),
    path("src/pages/auth-2fa-verify.html", ui_auth_2fa_verify_view, name="legacy-ui-auth-2fa-verify"),
    path("src/pages/help.html", ui_help_view, name="legacy-ui-help"),
]
