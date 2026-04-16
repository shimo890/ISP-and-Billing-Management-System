
from django.db import models
from django.utils.translation import gettext_lazy as _
import json




class Permission(models.Model):
    """Fine-grained permissions"""
    RESOURCE_CHOICES = (
        ('users', 'Users'),
        ('customers', 'Customers'),
        ('prospects', 'Prospects'),
        ('bills', 'Bills'),
        ('dashboard', 'Dashboard'),
        ('reports', 'Reports'),
        ('settings', 'Settings'),
        ('logs', 'Logs'),
        ('role', 'Roles'),
        ('roles', 'Roles (Admin)'),
        ('entitlements', 'Entitlements'),
        ('entitlement_details', 'Entitlement Details'),
        ('invoices', 'Invoices'),
        ('payments', 'Payments'),
        ('payment_details', 'Payment Details'),
        ('ledger', 'Ledger'),
        ('packages', 'Packages'),
        ('package_pricing', 'Package Pricing'),
        ('utilities', 'Utilities'),
        ('kam', 'KAM'),
        ('audit', 'Audit'),
    )
    
    ACTION_CHOICES = (
        ('read', 'Read'),
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('export', 'Export'),
        ('import', 'Import'),
        ('comment', 'Comment'),
    )
    
    codename = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    resource = models.CharField(max_length=50, choices=RESOURCE_CHOICES)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'auth_permissions'
        ordering = ['resource', 'action']
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
        indexes = [
            models.Index(fields=['resource', 'action']),
        ]
    
    def __str__(self):
        return self.codename
    
    def save(self, *args, **kwargs):
        if not self.codename:
            self.codename = f"{self.resource}:{self.action}"
        if not self.name:
            self.name = self.codename.replace(':', ' ').title()
        super().save(*args, **kwargs)


class Role(models.Model):
    """Role model for RBAC with M2M permissions"""
    ROLE_CHOICES = (
        ('super_admin', 'Super Administrator'),
        ('admin', 'Administrator'),
        ('sales_manager', 'Sales Manager'),
        ('sales_person', 'Sales Person'),
        ('billing_manager', 'Billing Manager'),
        ('data_entry', 'Data Entry Officer'),
        ('accountant', 'Accountant'),
        ('user', 'Regular User'),
    )
    
    name = models.CharField(
        max_length=50,
        choices=ROLE_CHOICES,
        unique=True,
        db_index=True
    )
    description = models.TextField(blank=True, null=True)
    permissions = models.ManyToManyField(
        Permission,
        related_name='roles',
        blank=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'auth_roles'
        ordering = ['name']
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
    
    def __str__(self):
        return f"{self.get_name_display()}"
    
    def has_permission(self, permission_codename: str) -> bool:
        if self.name in ('super_admin', 'admin'):
            return True
        return self.permissions.filter(codename=permission_codename).exists()


class MenuItem(models.Model):
    """Dynamic menu driven by permissions/roles."""
    slug = models.SlugField(max_length=100, unique=True)
    title = models.CharField(max_length=100)
    path = models.CharField(max_length=255)
    icon = models.CharField(max_length=100, blank=True)
    order = models.IntegerField(default=0)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    required_permissions = models.ManyToManyField(Permission, blank=True, related_name='menu_items')
    allowed_roles = models.ManyToManyField(Role, blank=True, related_name='menu_items')
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'auth_menu_items'
        ordering = ['order', 'title']
    
    def __str__(self):
        return self.title




class UserActivityLog(models.Model):
    """Track user activities for audit trail"""
    ACTION_CHOICES = (
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('read', 'Read'),
        ('export', 'Export'),
        ('import', 'Import'),
        ('download', 'Download'),
        ('upload', 'Upload'),
    )
    
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='activity_logs',
        db_index=True
    )
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        db_index=True
    )
    resource = models.CharField(
        max_length=100,
        blank=True,
        help_text="Resource type (e.g., 'customer', 'bill')"
    )
    resource_id = models.IntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    status_code = models.IntegerField(null=True, blank=True)
    response_time = models.FloatField(null=True, blank=True, help_text="Response time in ms")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'auth_activity_logs'
        ordering = ['-created_at']
        verbose_name = 'Activity Log'
        verbose_name_plural = 'Activity Logs'
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['resource', 'resource_id']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.action} - {self.resource}"


class AuditLog(models.Model):
    """Track all data changes for audit trail"""
    OPERATION_CHOICES = (
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
    )
    
    user = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    operation = models.CharField(
        max_length=20,
        choices=OPERATION_CHOICES,
        db_index=True
    )
    table_name = models.CharField(
        max_length=100,
        db_index=True
    )
    record_id = models.IntegerField(db_index=True)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    changes = models.JSONField(default=dict, help_text="Only changed fields")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'auth_audit_logs'
        ordering = ['-created_at']
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        indexes = [
            models.Index(fields=['table_name', 'record_id']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['operation', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.operation} - {self.table_name}:{self.record_id}"


class UserInvitation(models.Model):
    """User invitation for account creation"""
    email = models.EmailField(unique=True)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='invitations')
    invited_by = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='sent_invitations')
    token = models.CharField(max_length=100, unique=True)
    temp_password = models.CharField(max_length=128)  # Store hashed temp password
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auth_user_invitations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation for {self.email} ({self.role.name})"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at


class PasswordResetToken(models.Model):
    """Password reset token for forgot-password flow"""
    user = models.ForeignKey(
        'users.User',
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(max_length=100, unique=True, db_index=True)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auth_password_reset_tokens'
        ordering = ['-created_at']

    def __str__(self):
        return f"Reset token for {self.user.email}"

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at or self.is_used

