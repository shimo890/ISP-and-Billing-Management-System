from django.contrib.auth import authenticate, get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Role, Permission, MenuItem, UserInvitation, UserActivityLog, AuditLog, PasswordResetToken

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'codename', 'name', 'resource', 'action', 'description']


class RoleSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(
        queryset=Permission.objects.all(), many=True, required=False
    )

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'is_active', 'created_at', 'updated_at']


class MenuItemSerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = ['id', 'slug', 'title', 'path', 'icon', 'order', 'children']

    def get_children(self, obj):
        qs = obj.children.filter(is_active=True).order_by('order')
        return MenuItemSerializer(qs, many=True).data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class LoginSerializer(TokenObtainPairSerializer):
    username_field = User.EMAIL_FIELD

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'username': self.user.username,
        }
        return data



class InvitationSerializer(serializers.ModelSerializer):
    role = serializers.SlugRelatedField(
        slug_field='name',
        queryset=Role.objects.all()
    )

    class Meta:
        model = UserInvitation
        fields = ['email', 'role']


class AcceptInvitationSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    token = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        
        try:
            invitation = UserInvitation.objects.get(token=attrs['token'], is_used=False)
            if invitation.is_expired():
                raise serializers.ValidationError({"token": "Invitation has expired."})
            attrs['invitation'] = invitation
        except UserInvitation.DoesNotExist:
            raise serializers.ValidationError({"token": "Invalid invitation token."})
            
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        invitation = validated_data['invitation']
        
        # Create user
        username = invitation.email.split('@')[0]
        # Ensure unique username
        if User.objects.filter(username=username).exists():
            import uuid
            username = f"{username}_{uuid.uuid4().hex[:4]}"
            
        user = User.objects.create_user(
            email=invitation.email,
            username=username,
            password=password,
            role=invitation.role
        )
        
        # Mark invitation as used
        invitation.is_used = True
        invitation.save()
        
        return user


class ForgotPasswordSerializer(serializers.Serializer):
    """Request password reset - accepts email"""
    email = serializers.EmailField(required=True, help_text='User email address')


class ResetPasswordSerializer(serializers.Serializer):
    """Reset password with token - accepts token and new password"""
    token = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Password fields didn't match."})
        try:
            reset_token = PasswordResetToken.objects.get(
                token=attrs['token'],
                is_used=False
            )
            if reset_token.is_expired():
                raise serializers.ValidationError({"token": "Reset link has expired."})
            attrs['reset_token'] = reset_token
        except PasswordResetToken.DoesNotExist:
            raise serializers.ValidationError({"token": "Invalid or expired reset link."})
        return attrs


class UserActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for user activity logs"""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = UserActivityLog
        fields = [
            'id', 'user', 'user_email', 'user_username', 
            'action', 'action_display', 'resource', 'resource_id',
            'details', 'ip_address', 'user_agent', 'status_code',
            'response_time', 'created_at'
        ]
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs"""
    user_email = serializers.EmailField(source='user.email', read_only=True, allow_null=True)
    user_username = serializers.CharField(source='user.username', read_only=True, allow_null=True)
    operation_display = serializers.CharField(source='get_operation_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_username',
            'operation', 'operation_display', 'table_name', 'record_id',
            'old_values', 'new_values', 'changes', 'ip_address', 'created_at'
        ]
        read_only_fields = fields
