from django.contrib import admin

from .models import CustomerMaster, KAMMaster


@admin.register(KAMMaster)
class KAMMasterAdmin(admin.ModelAdmin):
    list_display = ("id", "kam_name", "designation", "phone", "email", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("kam_name", "email", "phone", "designation")
    ordering = ("kam_name",)


@admin.register(CustomerMaster)
class CustomerMasterAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customer_number",
        "customer_name",
        "company_name",
        "customer_type",
        "status",
        "kam_id",
        "is_active",
        "updated_at",
    )
    list_filter = ("customer_type", "status", "is_active", "kam_id")
    search_fields = (
        "customer_number",
        "customer_name",
        "company_name",
        "email",
        "phone",
        "nid",
    )
    autocomplete_fields = ("kam_id", "created_by", "updated_by")
    ordering = ("-updated_at",)
