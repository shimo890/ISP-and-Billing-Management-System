from rest_framework import status, generics, permissions, viewsets, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Avg, Q
from django.utils import timezone
from datetime import timedelta, datetime, date
import uuid

from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    RoleSerializer,
    PermissionSerializer,
    MenuItemSerializer,
    InvitationSerializer,
    AcceptInvitationSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    UserActivityLogSerializer,
    AuditLogSerializer,
)
from .models import Role, Permission, MenuItem, UserInvitation, UserActivityLog, AuditLog, PasswordResetToken
from .permissions import IsAdminOrSuperAdmin
from apps.customers.email_service import send_invitation_email, send_password_reset_email
from django.contrib.auth.hashers import make_password

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response({'detail': 'Invalid refresh token'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Logged out'}, status=status.HTTP_205_RESET_CONTENT)


class TokenRefresh(TokenRefreshView):
    permission_classes = [permissions.AllowAny]


class ForgotPasswordView(APIView):
    """
    Request password reset. Sends reset link to email if account exists.
    Always returns same success message (do not reveal if email exists).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            # Invalidate any existing unused tokens for this user
            PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)
            token_str = uuid.uuid4().hex + uuid.uuid4().hex
            reset_token = PasswordResetToken.objects.create(
                user=user,
                token=token_str,
                expires_at=timezone.now() + timedelta(hours=1),
            )
            send_password_reset_email(reset_token)

        return Response(
            {'detail': 'If an account exists with that email, you will receive a password reset link shortly.'},
            status=status.HTTP_200_OK,
        )


class ResetPasswordView(APIView):
    """Reset password using token from email link."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_token = serializer.validated_data['reset_token']
        new_password = serializer.validated_data['new_password']

        user = reset_token.user
        user.set_password(new_password)
        user.save()

        reset_token.is_used = True
        reset_token.save()

        return Response(
            {'detail': 'Password has been reset successfully. You can now sign in with your new password.'},
            status=status.HTTP_200_OK,
        )


class RoleListCreateView(generics.ListCreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]


class RoleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]


class PermissionListView(generics.ListAPIView):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]
    pagination_class = None  # Disable pagination for permissions


class RoleChoicesView(APIView):
    """Get predefined role name choices"""
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]

    def get(self, request):
        choices = [
            {'value': value, 'label': label}
            for value, label in Role.ROLE_CHOICES
        ]
        return Response(choices, status=status.HTTP_200_OK)


class AssignRoleView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, user_id):
        role_name = request.data.get('role')
        role = Role.objects.filter(name=role_name).first()
        if not role:
            return Response({'detail': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user.role = role
        user.save()
        return Response({'detail': 'Role assigned'}, status=status.HTTP_200_OK)


class MenuView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # Top-level items
        qs = MenuItem.objects.filter(is_active=True, parent__isnull=True).order_by('order')
        allowed = []
        for item in qs:
            if self._allowed(user, item):
                allowed.append(item)
        data = MenuItemSerializer(allowed, many=True).data
        return Response(data)

    def _allowed(self, user, item):
        if user.is_superuser:
            return True
        if user.role and user.role.name in ('super_admin', 'admin'):
            return True
        # Role allowlist OR permission-based
        if item.allowed_roles.exists():
            if user.role and item.allowed_roles.filter(id=user.role_id).exists():
                return True
        required = item.required_permissions.all()
        if not required:
            return True
        for perm in required:
            if not user.has_permission(perm.codename):
                return False
        return True

class SendInvitationView(generics.CreateAPIView):
    """
    Send invitation to new user
    Only accessible by Admin/SuperAdmin
    """
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        role_name = serializer.validated_data['role']  # This is a Role object due to SlugRelatedField

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "User with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create invitation
        token = str(uuid.uuid4())
        # Generate a temporary fake password hash just to satisfy constraint if needed, 
        # though we decided user sets password. 
        # But model requires it. So we just put a dummy value.
        temp_password = make_password(str(uuid.uuid4()))
        
        expires_at = timezone.now() + timedelta(days=7) # 7 days expiry
        
        invitation = UserInvitation.objects.create(
            email=email,
            role=role_name,
            invited_by=request.user,
            token=token,
            temp_password=temp_password,
            expires_at=expires_at
        )

        # Send email
        if send_invitation_email(invitation):
            return Response(
                {"detail": f"Invitation sent to {email}"},
                status=status.HTTP_201_CREATED
            )
        else:
            invitation.delete()
            return Response(
                {"detail": "Failed to send invitation email."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ValidateInvitationView(APIView):
    """
    Validate invitation token without creating account
    Public endpoint to check if token is valid and not expired
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        token = request.data.get('token')
        
        if not token:
            return Response(
                {"detail": "Token is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            invitation = UserInvitation.objects.get(token=token, is_used=False)
            
            if invitation.is_expired():
                return Response(
                    {"detail": "This invitation has expired. Please request a new invitation."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Return invitation details
            return Response({
                "email": invitation.email,
                "role": invitation.role.name,
                "role_display": invitation.role.get_name_display(),
                "invited_by": invitation.invited_by.username if invitation.invited_by else None,
                "expires_at": invitation.expires_at,
                "is_valid": True
            }, status=status.HTTP_200_OK)
            
        except UserInvitation.DoesNotExist:
            return Response(
                {"detail": "Invalid invitation token. The link may be incorrect or already used."},
                status=status.HTTP_400_BAD_REQUEST
            )


class AcceptInvitationView(generics.GenericAPIView):
    """
    Accept invitation and set password
    Public endpoint (no auth required as token permits it)
    """
    serializer_class = AcceptInvitationSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response(
            {
                "detail": "Account created successfully. You can now login.",
                "email": user.email,
                "username": user.username
            },
            status=status.HTTP_201_CREATED
        )


class UserActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View user activity logs
    Read-only endpoint for viewing activity history
    """
    queryset = UserActivityLog.objects.select_related('user').all()
    serializer_class = UserActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'resource', 'user', 'status_code']
    search_fields = ['user__email', 'user__username', 'resource', 'ip_address']
    ordering_fields = ['created_at', 'response_time']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter activity logs with query parameters"""
        queryset = self.queryset
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(created_at__gte=start)
            except ValueError:
                pass
        
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d')
                # Include the entire end date
                end = datetime.combine(end.date(), datetime.max.time())
                queryset = queryset.filter(created_at__lte=end)
            except ValueError:
                pass
        
        # Filter by user ID
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by resource type
        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            queryset = queryset.filter(resource=resource_type)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def my_activity(self, request):
        """Get current user's activity logs"""
        logs = self.queryset.filter(user=request.user).order_by('-created_at')[:50]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get activity statistics"""
        queryset = self.get_queryset()
        
        # Get date range from params or default to last 30 days
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        # Activity by action type
        by_action = queryset.values('action').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Activity by resource
        by_resource = queryset.values('resource').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Activity by user (top 10)
        by_user = queryset.values(
            'user__username', 'user__email'
        ).annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        # Total counts
        total_activities = queryset.count()
        unique_users = queryset.values('user').distinct().count()
        
        # Average response time (ms)
        avg_response = queryset.filter(response_time__isnull=False).aggregate(
            avg=Avg('response_time')
        )['avg'] or 0
        
        return Response({
            'total_activities': total_activities,
            'unique_users': unique_users,
            'average_response_time': avg_response,
            'by_action': list(by_action),
            'by_resource': list(by_resource),
            'by_user': list(by_user),
            'date_range': {
                'start': start_date,
                'end': end_date
            }
        })


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View audit logs (data changes)
    Read-only endpoint for viewing data change history
    """
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['operation', 'table_name', 'user', 'record_id']
    search_fields = ['user__email', 'user__username', 'table_name', 'record_id']
    ordering_fields = ['created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Filter audit logs with query parameters"""
        queryset = self.queryset
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d')
                queryset = queryset.filter(created_at__gte=start)
            except ValueError:
                pass
        
        if end_date:
            try:
                end = datetime.strptime(end_date, '%Y-%m-%d')
                end = datetime.combine(end.date(), datetime.max.time())
                queryset = queryset.filter(created_at__lte=end)
            except ValueError:
                pass
        
        # Filter by table name
        table = self.request.query_params.get('table')
        if table:
            queryset = queryset.filter(table_name=table)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_record(self, request):
        """Get audit trail for a specific record"""
        table_name = request.query_params.get('table_name')
        record_id = request.query_params.get('record_id')
        
        if not table_name or not record_id:
            return Response(
                {'error': 'table_name and record_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        logs = self.queryset.filter(
            table_name=table_name,
            record_id=record_id
        ).order_by('-created_at')
        
        serializer = self.get_serializer(logs, many=True)
        return Response({
            'table_name': table_name,
            'record_id': record_id,
            'history': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get audit statistics"""
        queryset = self.get_queryset()
        
        # Changes by operation type
        by_operation = queryset.values('operation').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Changes by table
        by_table = queryset.values('table_name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Changes by user (top 10)
        by_user = queryset.values(
            'user__username', 'user__email'
        ).annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        # Total counts
        total_changes = queryset.count()
        unique_tables = queryset.values('table_name').distinct().count()
        unique_records = queryset.values('table_name', 'record_id').distinct().count()
        
        return Response({
            'total_changes': total_changes,
            'unique_tables': unique_tables,
            'unique_records': unique_records,
            'by_operation': list(by_operation),
            'by_table': list(by_table),
            'by_user': list(by_user)
        })
