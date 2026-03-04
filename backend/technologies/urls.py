from django.urls import path

from technologies.views import (
    TechnologyBulkAPIView,
    TechnologyDetailAPIView,
    TechnologyListCreateAPIView,
)

urlpatterns = [
    path("", TechnologyListCreateAPIView.as_view(), name="technologies-list"),
    path("bulk", TechnologyBulkAPIView.as_view(), name="technologies-bulk-noslash"),
    path("bulk/", TechnologyBulkAPIView.as_view(), name="technologies-bulk"),
    path("<int:pk>", TechnologyDetailAPIView.as_view(), name="technologies-detail-noslash"),
    path("<int:pk>/", TechnologyDetailAPIView.as_view(), name="technologies-detail"),
]
