from django.contrib import admin
from django.utils.html import format_html
from .models import UtilityInformationMaster, UtilityDetails


class UtilityDetailsInline(admin.TabularInline):
    """Inline admin for utility details"""
    model = UtilityDetails
    extra = 1
    fields = [
        'type', 'name', 'number', 'branch', 
        'routing_no', 'swift_no', 'is_active', 'remarks'
    ]
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['type', 'name']


@admin.register(UtilityInformationMaster)
class UtilityInformationMasterAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'vat_rate', 'is_active', 'details_count', 
        'active_details_count', 'created_at'
    ]
    list_filter = ['is_active', 'created_at']
    search_fields = ['terms_condition', 'regards', 'remarks']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    list_per_page = 25
    inlines = [UtilityDetailsInline]
    
    fieldsets = (
        ('Utility Information', {
            'fields': ('vat_rate', 'is_active')
        }),
        ('Terms & Conditions', {
            'fields': ('terms_condition',)
        }),
        ('Additional Information', {
            'fields': ('regards', 'remarks')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def details_count(self, obj):
        """Display count of all utility details"""
        count = obj.details.count()
        return format_html('<span style="color: blue; font-weight: bold;">{}</span>', count)
    details_count.short_description = 'Total Details'
    
    def active_details_count(self, obj):
        """Display count of active utility details"""
        count = obj.details.filter(is_active=True).count()
        return format_html('<span style="color: green; font-weight: bold;">{}</span>', count)
    active_details_count.short_description = 'Active Details'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.prefetch_related('details')


@admin.register(UtilityDetails)
class UtilityDetailsAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'utility_master_id', 'type', 'name', 'number', 
        'branch', 'routing_no', 'swift_no', 'is_active', 'created_at'
    ]
    list_filter = ['type', 'is_active', 'created_at', 'utility_master_id']
    search_fields = ['name', 'number', 'branch', 'routing_no', 'swift_no']
    ordering = ['type', 'name']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    list_per_page = 25
    list_select_related = ['utility_master_id']
    
    fieldsets = (
        ('Utility Detail Information', {
            'fields': ('utility_master_id', 'type', 'name', 'number', 'is_active')
        }),
        ('Bank Information', {
            'fields': ('branch', 'routing_no', 'swift_no'),
            'description': 'Bank-specific information (if applicable)'
        }),
        ('Additional Information', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('utility_master_id')
