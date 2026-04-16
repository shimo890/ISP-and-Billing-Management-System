from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    TokenRefresh,
    ForgotPasswordView,
    ResetPasswordView,
    RoleListCreateView,
    RoleDetailView,
    PermissionListView,
    RoleChoicesView,
    AssignRoleView,
    MenuView,
    SendInvitationView,
    ValidateInvitationView,
    AcceptInvitationView,
    UserActivityLogViewSet,
    AuditLogViewSet,
)

# Router for viewsets
router = DefaultRouter()
router.register(r'activity-logs', UserActivityLogViewSet, basename='activity-logs')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth-register'),
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('refresh/', TokenRefresh.as_view(), name='auth-refresh'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='auth-reset-password'),

    path('roles/', RoleListCreateView.as_view(), name='roles-list-create'),
    path('roles/<int:pk>/', RoleDetailView.as_view(), name='roles-detail'),
    path('role-choices/', RoleChoicesView.as_view(), name='role-choices'),
    path('permissions/', PermissionListView.as_view(), name='permissions-list'),
    path('assign-role/<int:user_id>/', AssignRoleView.as_view(), name='assign-role'),
    path('menu/', MenuView.as_view(), name='menu'),
    path('invite/', SendInvitationView.as_view(), name='auth-invite'),
    path('invite/validate/', ValidateInvitationView.as_view(), name='auth-invite-validate'),
    path('invite/accept/', AcceptInvitationView.as_view(), name='auth-invite-accept'),
    
    # Include router URLs
    path('', include(router.urls)),
]


