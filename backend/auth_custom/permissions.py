from rest_framework.permissions import SAFE_METHODS, BasePermission

from auth_custom.models import UserProfile

READ_ROLES = {
    UserProfile.ROLE_ADMIN,
    UserProfile.ROLE_OWNER,
    UserProfile.ROLE_EDITOR,
    UserProfile.ROLE_GUEST,
}

TECH_WRITE_ROLES = {
    UserProfile.ROLE_ADMIN,
    UserProfile.ROLE_OWNER,
}


class RolePermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        profile = getattr(user, "profile", None)
        role = profile.get_effective_role() if profile is not None else UserProfile.ROLE_GUEST
        if request.method in SAFE_METHODS:
            allowed = set(getattr(view, "read_roles", READ_ROLES))
        else:
            allowed = set(getattr(view, "write_roles", TECH_WRITE_ROLES))
        return role in allowed
