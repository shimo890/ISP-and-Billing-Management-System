from rest_framework import generics, permissions, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .serializers import UserSerializer, UserCreateSerializer, ChangePasswordSerializer
from apps.authentication.permissions import IsAdminOrSuperAdmin

User = get_user_model()


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # Get user permissions
        permissions_list = []
        if user.is_superuser:
            permissions_list = ['all']
        elif user.role:
            permissions_list = list(user.role.permissions.values_list('codename', flat=True))
        
        return Response({
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'role': user.role.name if getattr(user, 'role', None) else None,
            'role_name': user.role.name if getattr(user, 'role', None) else None,
            'permissions': permissions_list,
            'is_superuser': user.is_superuser,
        })


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'username', 'first_name', 'last_name']
    ordering_fields = ['created_at', 'email']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSuperAdmin]


class FieldStaffUsersView(APIView):
    """Users with account-facing roles (KAM / field staff) for dropdowns and assignments."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        staff = User.objects.filter(
            role__name__in=['sales_manager', 'sales_person'],
            is_active=True
        ).select_related('role').order_by('username')

        users_data = [{
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role_name': user.role.name if user.role else None,
        } for user in staff]

        return Response(users_data)


class ChangePasswordView(APIView):
    """Change password for authenticated user"""
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_summary='Change password',
        operation_description='Change the password for the currently authenticated user. Requires old password and new password confirmation.',
        request_body=ChangePasswordSerializer,
        responses={
            200: openapi.Response(
                description='Password changed successfully',
                schema=openapi.Schema(
                    type=openapi.TYPE_OBJECT,
                    properties={
                        'message': openapi.Schema(type=openapi.TYPE_STRING, description='Success message'),
                    }
                )
            ),
            400: 'Bad request - validation errors',
        },
        tags=['Users']
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            serializer.save()
            return Response(
                {'message': 'Password changed successfully.'},
                status=status.HTTP_200_OK
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
