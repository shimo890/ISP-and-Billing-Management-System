from django.contrib import admin
from django.contrib import messages
from django.utils.html import format_html
from django.db import transaction
from django.db.models import Sum
from .models import CustomerEntitlementMaster, CustomerEntitlementDetails, InvoiceMaster, InvoiceDetails
from .recalculation_service import compute_invoice_detail_sub_total, recalculate_invoice_totals


class CustomerEntitlementDetailsInline(admin.TabularInline):
    """Inline admin for entitlement details"""
    model = CustomerEntitlementDetails
    extra = 1
    fields = [
        'type', 'start_date', 'end_date', 'mbps', 'unit_price', 
        'package_master_id', 'package_pricing_id', 'status', 
        'is_active', 'last_changes_updated_date'
    ]
    readonly_fields = ['created_at', 'updated_at', 'last_changes_updated_date']
    ordering = ['-created_at']

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        """Filter package pricing/master based on customer type"""
        if request.resolver_match and request.resolver_match.kwargs.get('object_id'):
            try:
                entitlement = CustomerEntitlementMaster.objects.get(
                    pk=request.resolver_match.kwargs.get('object_id')
                )
                customer_type = entitlement.customer_master_id.customer_type
                
                if db_field.name == "package_pricing_id":
                    # Only for SOHO
                    if customer_type == 'soho':
                        kwargs["queryset"] = db_field.related_model.objects.filter(
                            package_master_id__package_type='soho'
                        )
                    else:
                        # For others, maybe empty or all? User said "make this two field optional to select based on customer type"
                        # Let's keep it open but maybe filtered if possible, or just leave it.
                        # Actually, for BW/CP they select package_master_id.
                        pass
                        
                if db_field.name == "package_master_id":
                    # For BW and Channel Partner
                    if customer_type == 'bw':
                        kwargs["queryset"] = db_field.related_model.objects.filter(
                            package_type='bw'
                        )
                    elif customer_type == 'soho':
                         kwargs["queryset"] = db_field.related_model.objects.filter(
                            package_type='soho'
                        )

            except CustomerEntitlementMaster.DoesNotExist:
                pass
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(CustomerEntitlementMaster)
class CustomerEntitlementMasterAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'bill_number', 'customer_master_id', 'customer_type', 
        'activation_date', 'total_bill', 'details_count', 'created_by', 'created_at'
    ]
    list_filter = ['activation_date', 'created_at', 'customer_master_id__customer_type']
    search_fields = [
        'bill_number', 'customer_master_id__customer_name', 
        'customer_master_id__customer_number', 'customer_master_id__email'
    ]
    ordering = ['-created_at']
    readonly_fields = ['bill_number' , 'created_at', 'updated_at']
    date_hierarchy = 'created_at'
    list_per_page = 25
    list_select_related = ['customer_master_id', 'created_by', 'updated_by']
    inlines = [CustomerEntitlementDetailsInline]
    
    fieldsets = (
        ('Entitlement Information', {
            'fields': ('customer_master_id', 'activation_date', 'total_bill')
        }),
        ('NTTN Information', {
            'fields': ('nttn_company', 'nttn_capacity', 'link_id', 'nttn_uses'),
            'classes': ('collapse',)
        }),
        ('Home Package Information', {
            'fields': ('type_of_bw', 'type_of_connection', 'connected_pop'),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def customer_type(self, obj):
        """Display customer type"""
        return obj.customer_master_id.get_customer_type_display()
    customer_type.short_description = 'Customer Type'
    
    def details_count(self, obj):
        """Display count of entitlement details"""
        count = obj.details.count()
        return format_html('<span style="color: blue; font-weight: bold;">{}</span>', count)
    details_count.short_description = 'Details Count'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('customer_master_id', 'created_by', 'updated_by').prefetch_related('details')


@admin.register(CustomerEntitlementDetails)
class CustomerEntitlementDetailsAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'cust_entitlement_id', 'customer_name', 'type', 'start_date', 
        'end_date', 'mbps', 'unit_price', 
        'line_total', 'status', 'is_active', 'last_changes_updated_date', 'created_at'
    ]
    list_filter = ['type', 'status', 'is_active', 'created_at', 'start_date', 'end_date']
    search_fields = [
        'cust_entitlement_id__bill_number', 
        'cust_entitlement_id__customer_master_id__customer_name'
    ]
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at', 'last_changes_updated_date', 'created_by', 'updated_by']
    date_hierarchy = 'created_at'
    list_per_page = 25
    list_select_related = ['cust_entitlement_id__customer_master_id', 'package_pricing_id', 'created_by', 'updated_by']
    
    fieldsets = (
        ('Entitlement Information', {
            'fields': ('cust_entitlement_id', 'type', 'start_date', 'end_date', 'package_pricing_id')
        }),
        ('Bandwidth Details', {
            'fields': ('mbps', 'unit_price'),
            'description': 'For Bandwidth customers'
        }),
        ('Status', {
            'fields': ('status', 'is_active', 'last_changes_updated_date')
        }),
        ('Metadata', {
            'fields': ('created_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def customer_name(self, obj):
        """Display customer name"""
        return obj.cust_entitlement_id.customer_master_id.customer_name
    customer_name.short_description = 'Customer'
    
    def line_total(self, obj):
        """Calculate and display line total"""
        if obj.mbps and obj.unit_price:
            total = float(obj.mbps * obj.unit_price)
            total_formatted = f"{total:.2f}"
            return format_html('<span style="color: green; font-weight: bold;">{}</span>', total_formatted)
        return '-'
    line_total.short_description = 'Line Total'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'cust_entitlement_id__customer_master_id', 
            'package_pricing_id', 
            'created_by', 
            'updated_by'
        )


class InvoiceDetailsInline(admin.TabularInline):
    """Inline admin for invoice details - full edit with auto-recalculation"""
    model = InvoiceDetails
    extra = 1
    fields = [
        'entitlement_details_id', 'start_date', 'end_date', 'type',
        'package_pricing_id', 'package_master_id', 'mbps', 'unit_price',
        'sub_total', 'vat_rate',
        'sub_discount_rate', 'remarks'
    ]
    readonly_fields = ['created_at']
    ordering = ['-created_at']
    verbose_name = "Invoice Line"
    verbose_name_plural = "Invoice Lines (add/edit/remove - totals auto-recalculate)"


@admin.register(InvoiceMaster)
class InvoiceMasterAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'invoice_number', 'customer_master_id', 'bill_number',
        'activation_date', 'nttn_company', 'nttn_capacity', 'total_bill',
        'type_of_bw', 'type_of_connection', 'connected_pop',
        'issue_date', 'total_bill_amount', 'total_paid_amount',
        'total_balance_due', 'payment_status', 'status', 'created_at'
    ]
    list_filter = ['status', 'issue_date', 'created_at', 'information_master_id']
    search_fields = [
        'invoice_number', 
        'customer_entitlement_master_id__bill_number',
        'customer_entitlement_master_id__customer_master_id__customer_name',
        'customer_entitlement_master_id__customer_master_id__customer_number'
    ]
    ordering = ['-created_at']
    readonly_fields = [
        'invoice_number', 'created_by', 'updated_by', 'created_at', 'updated_at', 
        # 'total_bill_amount', 'total_paid_amount', 'total_balance_due', 'total_vat_amount', 
        # 'total_discount_amount'
    ]
    date_hierarchy = 'issue_date'
    list_per_page = 25
    list_select_related = [
        'customer_entitlement_master_id__customer_master_id',
        'information_master_id',
        'created_by'
    ]
    inlines = [InvoiceDetailsInline]
    
    fieldsets = (
        ('Invoice Information', {
            'fields': (
                'customer_entitlement_master_id', 'customer_master_id',
                'bill_number', 'activation_date', 'issue_date', 'information_master_id', 'status'
            )
        }),
        ('NTTN Information', {
            'fields': ('nttn_company', 'nttn_capacity'),
            'classes': ('collapse',)
        }),
        ('Home Package Information', {
            'fields': ('type_of_bw', 'type_of_connection', 'connected_pop'),
            'classes': ('collapse',)
        }),
        ('Amounts', {
            'fields': (
                'total_bill', 'total_bill_amount', 'total_paid_amount', 'total_balance_due',
                'total_vat_amount', 'total_discount_amount'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Information', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': ('created_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def customer_name(self, obj):
        """Display customer name"""
        return obj.customer_entitlement_master_id.customer_master_id.customer_name
    customer_name.short_description = 'Customer'
    
    def bill_number(self, obj):
        """Display bill number"""
        return obj.customer_entitlement_master_id.bill_number
    bill_number.short_description = 'Bill Number'
    
    def payment_status(self, obj):
        """Display payment status with color coding"""
        if obj.total_balance_due == 0:
            return format_html(
                '<span style="color: green; font-weight: bold;">PAID</span>'
            )
        elif obj.total_paid_amount > 0:
            return format_html(
                '<span style="color: orange; font-weight: bold;">PARTIAL</span>'
            )
        else:
            return format_html(
                '<span style="color: red; font-weight: bold;">UNPAID</span>'
            )
    payment_status.short_description = 'Payment Status'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'customer_entitlement_master_id__customer_master_id',
            'information_master_id',
            'created_by'
        ).prefetch_related('details')

    actions = ['recalculate_totals_action', 'add_details_from_entitlement_action']

    @admin.action(description='Recalculate totals')
    def recalculate_totals_action(self, request, queryset):
        """Recalculate subtotal, VAT, discount, total, paid, due for selected invoices."""
        updated = 0
        with transaction.atomic():
            for invoice in queryset:
                recalculate_invoice_totals(invoice)
                updated += 1
        self.message_user(
            request,
            f'Recalculated totals for {updated} invoice(s).',
            messages.SUCCESS
        )

    @admin.action(description='Add details from entitlement')
    def add_details_from_entitlement_action(self, request, queryset):
        """Open selected invoices for editing - use the Invoice Lines inline to add new lines."""
        if queryset.count() == 1:
            from django.shortcuts import redirect
            return redirect(f'../{queryset.first().pk}/change/')
        self.message_user(
            request,
            'Select one invoice and run this action to open it. Then add lines in the "Invoice Lines" inline.',
            messages.INFO
        )

    def save_model(self, request, obj, form, change):
        """Save invoice within transaction. Model save triggers calculate_totals."""
        with transaction.atomic():
            super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        """Save invoice details, recompute sub_totals, and trigger full recalculation."""
        instances = formset.save(commit=False)
        invoice = form.instance
        with transaction.atomic():
            for instance in instances:
                if isinstance(instance, InvoiceDetails):
                    ent = instance.entitlement_details_id
                    if ent and (instance.mbps is None or instance.start_date is None):
                        if instance.start_date is None:
                            instance.start_date = ent.start_date
                        if instance.end_date is None:
                            instance.end_date = ent.end_date
                        if not instance.type:
                            instance.type = ent.type
                        if instance.mbps is None:
                            instance.mbps = ent.mbps
                        if instance.unit_price is None:
                            instance.unit_price = ent.unit_price
                        if instance.package_pricing_id is None:
                            instance.package_pricing_id = ent.package_pricing_id
                        if instance.package_master_id is None:
                            instance.package_master_id = ent.package_master_id
                    instance.sub_total = compute_invoice_detail_sub_total(instance, invoice)
                instance.save()
            for obj in formset.deleted_objects:
                if isinstance(obj, InvoiceDetails):
                    obj.delete()
            formset.save_m2m()
            if invoice.pk:
                recalculate_invoice_totals(invoice)


@admin.register(InvoiceDetails)
class InvoiceDetailsAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'invoice_number', 'customer_name', 'start_date', 'end_date', 'type',
        'package_pricing_id', 'package_master_id', 'mbps', 'unit_price',
        'sub_total', 'vat_rate', 'vat_amount',
        'sub_discount_rate', 'discount_amount', 'line_total', 'created_at'
    ]
    list_filter = ['created_at', 'vat_rate', 'sub_discount_rate']
    search_fields = [
        'invoice_master_id__invoice_number',
        'entitlement_details_id__cust_entitlement_id__bill_number'
    ]
    ordering = ['-created_at']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'
    list_per_page = 25
    list_select_related = [
        'invoice_master_id__customer_entitlement_master_id__customer_master_id',
        'entitlement_details_id'
    ]
    
    fieldsets = (
        ('Invoice Information', {
            'fields': ('invoice_master_id', 'entitlement_details_id')
        }),
        ('Entitlement Details', {
            'fields': ('start_date', 'end_date', 'type', 'package_pricing_id', 'package_master_id')
        }),
        ('Bandwidth Details', {
            'fields': ('mbps', 'unit_price', 'last_changes_updated_date'),
            'classes': ('collapse',)
        }),
        ('Amounts', {
            'fields': ('sub_total', 'vat_rate', 'sub_discount_rate')
        }),
        ('Additional Information', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def invoice_number(self, obj):
        """Display invoice number"""
        return obj.invoice_master_id.invoice_number
    invoice_number.short_description = 'Invoice Number'
    
    def customer_name(self, obj):
        """Display customer name"""
        return obj.invoice_master_id.customer_entitlement_master_id.customer_master_id.customer_name
    customer_name.short_description = 'Customer'
    
    def entitlement_type(self, obj):
        """Display entitlement type"""
        if obj.entitlement_details_id:
            return obj.entitlement_details_id.get_type_display()
        return '-'
    entitlement_type.short_description = 'Type'
    
    def vat_amount(self, obj):
        """Calculate VAT amount"""
        vat = float(obj.sub_total * (obj.vat_rate / 100))
        vat_formatted = f"{vat:.2f}"
        return format_html('<span style="color: blue;">{}</span>', vat_formatted)
    vat_amount.short_description = 'VAT Amount'
    
    def discount_amount(self, obj):
        """Calculate discount amount"""
        discount = float(obj.sub_total * (obj.sub_discount_rate / 100))
        discount_formatted = f"{discount:.2f}"
        return format_html('<span style="color: orange;">{}</span>', discount_formatted)
    discount_amount.short_description = 'Discount Amount'
    
    def line_total(self, obj):
        """Calculate line total"""
        sub_total = float(obj.sub_total)
        vat = float(obj.sub_total * (obj.vat_rate / 100))
        discount = float(obj.sub_total * (obj.sub_discount_rate / 100))
        total = sub_total + vat - discount
        total_formatted = f"{total:.2f}"
        return format_html('<span style="color: green; font-weight: bold;">{}</span>', total_formatted)
    line_total.short_description = 'Line Total'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'invoice_master_id__customer_entitlement_master_id__customer_master_id',
            'entitlement_details_id'
        )

    def save_model(self, request, obj, form, change):
        """Recompute sub_total and recalculate invoice totals."""
        with transaction.atomic():
            obj.sub_total = compute_invoice_detail_sub_total(obj, obj.invoice_master_id)
            super().save_model(request, obj, form, change)
            if obj.invoice_master_id_id:
                recalculate_invoice_totals(obj.invoice_master_id)

    actions = ['recalculate_parent_invoice_action']

    @admin.action(description='Recalculate parent invoice totals')
    def recalculate_parent_invoice_action(self, request, queryset):
        """Recalculate totals for parent invoices of selected details."""
        seen = set()
        with transaction.atomic():
            for detail in queryset.select_related('invoice_master_id'):
                if detail.invoice_master_id_id and detail.invoice_master_id_id not in seen:
                    recalculate_invoice_totals(detail.invoice_master_id)
                    seen.add(detail.invoice_master_id_id)
        self.message_user(
            request,
            f'Recalculated {len(seen)} invoice(s).',
            messages.SUCCESS
        )
