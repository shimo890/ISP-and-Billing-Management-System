from django.contrib import admin
from django.utils.html import format_html
from .models import PackageMaster, PackagePricing


class PackagePricingInline(admin.TabularInline):
    """Inline admin for package pricing"""
    model = PackagePricing
    extra = 1
    fields = [
        'mbps', 'rate', 'description', 'is_active', 
        'val_start_at', 'val_end_at'
    ]
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-val_start_at']


@admin.register(PackageMaster)
class PackageMasterAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'package_name', 'package_type', 'service_name', 'is_active', 
        # 'pricings_count', 'active_pricing',
          'created_at'
    ]
    list_filter = ['package_type', 'is_active', 'created_at']
    search_fields = ['package_name', 'service_name']
    ordering = ['package_name']
    readonly_fields = ['created_at', 'updated_at']
    list_per_page = 25
    # inlines = [PackagePricingInline]
    
    fieldsets = (
        ('Package Information', {
            'fields': ('package_name', 'package_type', 'service_name', 'is_active')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    # def pricings_count(self, obj):
    #     """Display count of pricing records"""
    #     count = obj.pricings.count()
    #     return format_html('<span style="color: blue; font-weight: bold;">{}</span>', count)
    # pricings_count.short_description = 'Pricings Count'
    
    # def active_pricing(self, obj):
    #     """Display active pricing if available"""
    #     from django.utils import timezone
    #     today = timezone.now().date()
    #     active = obj.pricings.filter(
    #         is_active=True,
    #         val_start_at__lte=today,
    #         val_end_at__gte=today
    #     ).first()
    #     if active:
    #         rate_value = float(active.rate) if active.rate else 0
    #         rate_formatted = f"{rate_value:.2f}"
    #         return format_html(
    #             '<span style="color: green; font-weight: bold;">{}</span> ({} to {})',
    #             rate_formatted,
    #             active.val_start_at,
    #             active.val_end_at
    #         )
    #     return format_html('<span style="color: red;">No Active Pricing</span>')
    # active_pricing.short_description = 'Active Pricing'
    
    # def get_queryset(self, request):
    #     qs = super().get_queryset(request)
    #     return qs.prefetch_related('pricings')


@admin.register(PackagePricing)
class PackagePricingAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'package_name', 'package_type', 'mbps', 'rate',
        'val_start_at', 'val_end_at', 'is_active', 'is_currently_active', 'created_at'
    ]
    list_filter = ['is_active', 'val_start_at', 'val_end_at', 'package_master_id__package_type']
    search_fields = ['package_master_id__package_name', 'description']
    ordering = ['-val_start_at']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'val_start_at'
    list_per_page = 25
    list_select_related = ['package_master_id']
    
    fieldsets = (
        ('Pricing Information', {
            'fields': ('package_master_id', 'mbps', 'rate', 'description', 'is_active')
        }),
        ('Validity Period', {
            'fields': ('val_start_at', 'val_end_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def package_name(self, obj):
        """Display package name"""
        return obj.package_master_id.package_name
    package_name.short_description = 'Package'
    
    def package_type(self, obj):
        """Display package type"""
        return obj.package_master_id.get_package_type_display()
    package_type.short_description = 'Type'
    
    def is_currently_active(self, obj):
        """Check if pricing is currently active"""
        from django.utils import timezone
        today = timezone.now().date()
        if obj.is_active and obj.val_start_at <= today <= obj.val_end_at:
            return format_html('<span style="color: green; font-weight: bold;">✓ Active</span>')
        return format_html('<span style="color: red;">✗ Inactive</span>')
    is_currently_active.short_description = 'Currently Active'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('package_master_id')
