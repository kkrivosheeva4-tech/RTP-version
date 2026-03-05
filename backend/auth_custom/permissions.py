from rest_framework.permissions import SAFE_METHODS, BasePermission

from auth_custom.models import UserProfile


READ_ROLES = {
    UserProfile.ROLE_ADMIN,
    UserProfile.ROLE_ARCHITECT,
    UserProfile.ROLE_ANALYST,
    UserProfile.ROLE_VIEWER,
    UserProfile.ROLE_DIRECTOR,
    UserProfile.ROLE_PROJECT_MANAGER,
}

WRITE_ROLES = {
    UserProfile.ROLE_ADMIN,
    UserProfile.ROLE_ARCHITECT,
    UserProfile.ROLE_DIRECTOR,
    UserProfile.ROLE_PROJECT_MANAGER,
}


class RolePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        role = getattr(getattr(user, "profile", None), "role", UserProfile.ROLE_VIEWER)
        if request.method in SAFE_METHODS:
            allowed = set(getattr(view, "read_roles", READ_ROLES))
        else:
            allowed = set(getattr(view, "write_roles", WRITE_ROLES))
        return role in allowed
