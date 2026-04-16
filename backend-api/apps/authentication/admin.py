from django.contrib import admin
from django.utils.html import format_html
from .models import Permission, Role, MenuItem, UserActivityLog, AuditLog, UserInvitation, PasswordResetToken


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'codename', 'name', 'resource', 'action', 'description', 'created_at']
    list_filter = ['resource', 'action', 'created_at']
    search_fields = ['codename', 'name', 'description']
    ordering = ['resource', 'action']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('codename', 'name', 'description')
        }),
        ('Permission Details', {
            'fields': ('resource', 'action')
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )


class PermissionInline(admin.TabularInline):
    model = Role.permissions.through
    extra = 1
    verbose_name = 'Permission'
    verbose_name_plural = 'Permissions'


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'get_name_display', 'is_active', 'permissions_count', 'users_count', 'created_at']
    list_filter = ['is_active', 'name', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']
    readonly_fields = ['created_at', 'updated_at']
    filter_horizontal = ['permissions']
    inlines = [PermissionInline]
    
    fieldsets = (
        ('Role Information', {
            'fields': ('name', 'description', 'is_active')
        }),
        ('Permissions', {
            'fields': ('permissions',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def permissions_count(self, obj):
        return obj.permissions.count()
    permissions_count.short_description = 'Permissions'
    
    def users_count(self, obj):
        return obj.users.count()
    users_count.short_description = 'Users'


class MenuItemInline(admin.TabularInline):
    model = MenuItem
    fk_name = 'parent'
    extra = 0
    fields = ['slug', 'title', 'path', 'icon', 'order', 'is_active']
    ordering = ['order']


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'slug', 'path', 'parent', 'order', 'is_active', 'icon_display']
    list_filter = ['is_active', 'parent']
    search_fields = ['title', 'slug', 'path']
    ordering = ['order', 'title']
    # readonly_fields = []  # No readonly fields for MenuItem
    filter_horizontal = ['required_permissions', 'allowed_roles']
    list_editable = ['order', 'is_active']
    inlines = [MenuItemInline]
    
    fieldsets = (
        ('Menu Item Information', {
            'fields': ('slug', 'title', 'path', 'icon', 'parent', 'order', 'is_active')
        }),
        ('Access Control', {
            'fields': ('required_permissions', 'allowed_roles'),
            'description': 'Menu item will be visible if user has required permissions OR is in allowed roles'
        }),
    )
    
    def icon_display(self, obj):
        if obj.icon:
            return format_html('<span style="font-size: 18px;">{}</span>', obj.icon)
        return '-'
    icon_display.short_description = 'Icon'


@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'resource', 'resource_id', 'status_code', 'response_time', 'created_at']
    list_filter = ['action', 'resource', 'status_code', 'created_at']
    search_fields = ['user__email', 'user__username', 'resource', 'ip_address']
    ordering = ['-created_at']
    readonly_fields = ['user', 'action', 'resource', 'resource_id', 'details', 'ip_address', 
                      'user_agent', 'status_code', 'response_time', 'created_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Activity Information', {
            'fields': ('user', 'action', 'resource', 'resource_id')
        }),
        ('Request Details', {
            'fields': ('ip_address', 'user_agent', 'status_code', 'response_time'),
            'classes': ('collapse',)
        }),
        ('Additional Data', {
            'fields': ('details',),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'operation', 'table_name', 'record_id', 'created_at']
    list_filter = ['operation', 'table_name', 'created_at']
    search_fields = ['user__email', 'user__username', 'table_name', 'record_id']
    ordering = ['-created_at']
    readonly_fields = ['user', 'operation', 'table_name', 'record_id', 'old_values', 
                      'new_values', 'changes', 'ip_address', 'created_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Audit Information', {
            'fields': ('user', 'operation', 'table_name', 'record_id')
        }),
        ('Changes', {
            'fields': ('old_values', 'new_values', 'changes'),
            'classes': ('collapse',)
        }),
        ('Request Details', {
            'fields': ('ip_address',),
            'classes': ('collapse',)
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False

@admin.register(UserInvitation)
class UserInvitationAdmin(admin.ModelAdmin):
    list_display = ['email', 'role', 'token', 'expires_at', 'created_at']
    list_filter = ['role', 'expires_at', 'created_at']
    search_fields = ['email', 'token']
    ordering = ['-created_at']
    readonly_fields = ['email', 'role', 'token', 'expires_at', 'created_at']
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Invitation Information', {
            'fields': ('email', 'role', 'token', 'expires_at')
        }),
        ('Timestamp', {
            'fields': ('created_at',)
        }),
    )
    
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'token', 'is_used', 'expires_at', 'created_at']
    list_filter = ['is_used', 'created_at']
    search_fields = ['user__email', 'token']
    ordering = ['-created_at']
    readonly_fields = ['user', 'token', 'is_used', 'expires_at', 'created_at']
    date_hierarchy = 'created_at'

