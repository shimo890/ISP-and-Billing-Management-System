from rest_framework.permissions import BasePermission


class RequirePermissions(BasePermission):
    """DRF permission that checks user role permissions.
    Views can set required_permissions = ['resource:action', ...]
    """

    def has_permission(self, request, view):
        required = getattr(view, 'required_permissions', [])
        if not required:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return all(user.has_permission(code) for code in required)


class IsAdminOrSuperAdmin(BasePermission):
    """Only super_admin or admin roles can access"""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if not user.role:
            return False
        return user.role.name in ['super_admin', 'admin']


