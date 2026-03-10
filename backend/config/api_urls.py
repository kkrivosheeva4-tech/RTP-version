from django.urls import include, path

from auth_custom.views import MeAPIView
from config.views import MetricsAPIView, health_check, openapi_schema_view, swagger_ui_view
from technologies.views import (
    TechnologyBulkAPIView,
    TechnologyDetailAPIView,
    TechnologyListCreateAPIView,
)

urlpatterns = [
    path("health", health_check, name="health"),
    path("health/", health_check, name="health-slash"),
    path("openapi.json", openapi_schema_view, name="openapi-json-noslash"),
    path("openapi.json/", openapi_schema_view, name="openapi-json"),
    path("docs", swagger_ui_view, name="swagger-ui-noslash"),
    path("docs/", swagger_ui_view, name="swagger-ui"),
    path("metrics", MetricsAPIView.as_view(), name="metrics-noslash"),
    path("metrics/", MetricsAPIView.as_view(), name="metrics"),
    path("technologies", TechnologyListCreateAPIView.as_view(), name="technologies-list-noslash"),
    path("technologies/bulk", TechnologyBulkAPIView.as_view(), name="technologies-bulk-noslash"),
    path("technologies/<int:pk>", TechnologyDetailAPIView.as_view(), name="technologies-detail-noslash"),
    path("technologies/", include("technologies.urls")),
    path("references/", include("references.urls")),
    path("auth/", include("auth_custom.urls")),
    path("users/me", MeAPIView.as_view(), name="users-me-noslash"),
    path("users/me/", MeAPIView.as_view(), name="users-me"),
    path("admin-panel/", include("admin_panel.urls")),
]
