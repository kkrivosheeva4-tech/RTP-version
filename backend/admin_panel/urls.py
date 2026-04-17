from django.urls import path

from admin_panel.views import (
    AuditListCleanupAPIView,
    EnterpriseDetailAPIView,
    EnterpriseListCreateAPIView,
    UserDetailAPIView,
    UserListCreateAPIView,
)

urlpatterns = [
    path("users", UserListCreateAPIView.as_view(), name="admin-users-list-noslash"),
    path("users/", UserListCreateAPIView.as_view(), name="admin-users-list"),
    path("users/<int:pk>", UserDetailAPIView.as_view(), name="admin-users-detail-noslash"),
    path("users/<int:pk>/", UserDetailAPIView.as_view(), name="admin-users-detail"),
    path("audit", AuditListCleanupAPIView.as_view(), name="admin-audit-noslash"),
    path("audit/", AuditListCleanupAPIView.as_view(), name="admin-audit"),
    path(
        "enterprises", EnterpriseListCreateAPIView.as_view(), name="admin-enterprises-list-noslash"
    ),
    path("enterprises/", EnterpriseListCreateAPIView.as_view(), name="admin-enterprises-list"),
    path(
        "enterprises/<int:pk>",
        EnterpriseDetailAPIView.as_view(),
        name="admin-enterprises-detail-noslash",
    ),
    path(
        "enterprises/<int:pk>/", EnterpriseDetailAPIView.as_view(), name="admin-enterprises-detail"
    ),
]
