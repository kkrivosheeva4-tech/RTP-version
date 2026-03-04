from django.urls import include, path

from config.views import health_check
from technologies.views import (
    TechnologyBulkAPIView,
    TechnologyDetailAPIView,
    TechnologyListCreateAPIView,
)

urlpatterns = [
    path("health", health_check, name="health"),
    path("health/", health_check, name="health-slash"),
    path("technologies", TechnologyListCreateAPIView.as_view(), name="technologies-list-noslash"),
    path("technologies/bulk", TechnologyBulkAPIView.as_view(), name="technologies-bulk-noslash"),
    path("technologies/<int:pk>", TechnologyDetailAPIView.as_view(), name="technologies-detail-noslash"),
    path("technologies/", include("technologies.urls")),
    path("references/", include("references.urls")),
    path("auth/", include("auth_custom.urls")),
    path("admin-panel/", include("admin_panel.urls")),
]
