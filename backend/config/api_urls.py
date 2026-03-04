from django.urls import include, path

from config.views import health_check

urlpatterns = [
    path("health", health_check, name="health"),
    path("health/", health_check, name="health-slash"),
    path("technologies/", include("technologies.urls")),
    path("references/", include("references.urls")),
    path("auth/", include("auth_custom.urls")),
    path("admin-panel/", include("admin_panel.urls")),
]
