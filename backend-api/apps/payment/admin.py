from django.contrib import admin
from django.contrib import messages
from django.utils.html import format_html
from django.db import transaction
from django.db.models import Sum
from .models import PaymentMaster, PaymentDetails, CustomerFundTransfer, CustomerFundTransferLine


class PaymentDetailsInline(admin.TabularInline):
    """Inline admin for payment details - edits update invoice balance & overpayment"""
    model = PaymentDetails
    extra = 1
    fields = [
        'pay_amount', 'transaction_id', 'status',
        'received_by', 'remarks'
    ]
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    verbose_name = "Payment Line"
    verbose_name_plural = "Payment Lines (edit amount - invoice balance auto-updates)"


@admin.register(PaymentMaster)
class PaymentMasterAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'payment_date', 'payment_method', 'customer_name', 
        'invoice_number', 'total_paid', 'status', 'received_by', 'created_at'
    ]
    list_filter = ['payment_method', 'status', 'payment_date', 'created_at']
    search_fields = [
        'invoice_master_id__invoice_number',
        'customer_entitlement_master_id__bill_number',
        'customer_entitlement_master_id__customer_master_id__customer_name',
        'customer_entitlement_master_id__customer_master_id__customer_number'
    ]
    ordering = ['-payment_date']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'payment_date'
    list_per_page = 25
    list_select_related = [
        'customer_entitlement_master_id__customer_master_id',
        'invoice_master_id',
        'received_by',
        'created_by'
    ]
    inlines = [PaymentDetailsInline]
    
    fieldsets = (
        ('Payment Information', {
            'fields': (
                'payment_date', 'payment_method', 'status',
                'customer_entitlement_master_id', 'invoice_master_id'
            )
        }),
        ('Additional Information', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': ('received_by', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def customer_name(self, obj):
        """Display customer name"""
        return obj.customer_entitlement_master_id.customer_master_id.customer_name
    customer_name.short_description = 'Customer'
    
    def invoice_number(self, obj):
        """Display invoice number"""
        return obj.invoice_master_id.invoice_number
    invoice_number.short_description = 'Invoice Number'
    
    def total_paid(self, obj):
        """Calculate total paid from all payment details"""
        total = obj.details.aggregate(total=Sum('pay_amount'))['total']
        if total:
            total_formatted = f"{float(total):.2f}"
            return format_html(
                '<span style="color: green; font-weight: bold;">{}</span>', 
                total_formatted
            )
        return format_html('<span style="color: red;">0.00</span>')
    total_paid.short_description = 'Total Paid'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'customer_entitlement_master_id__customer_master_id',
            'invoice_master_id',
            'received_by',
            'created_by'
        ).prefetch_related('details')

    actions = ['recalculate_invoice_balance_action']

    @admin.action(description='Recalculate invoice balance')
    def recalculate_invoice_balance_action(self, request, queryset):
        """Update invoice paid/due amounts for selected payments."""
        seen = set()
        with transaction.atomic():
            for payment in queryset.select_related('invoice_master_id'):
                if payment.invoice_master_id_id and payment.invoice_master_id_id not in seen:
                    payment.invoice_master_id.update_payment_status()
                    seen.add(payment.invoice_master_id_id)
        self.message_user(
            request,
            f'Updated invoice balance for {len(seen)} invoice(s).',
            messages.SUCCESS
        )

    def save_model(self, request, obj, form, change):
        """Save payment and update invoice balance."""
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            if obj.invoice_master_id_id:
                obj.invoice_master_id.update_payment_status()


# Fund transfer models administration --------------------------------------------------

class CustomerFundTransferLineInline(admin.TabularInline):
    """Inline for individual customer amounts within a transfer"""
    model = CustomerFundTransferLine
    extra = 0
    fields = ['customer_id', 'amount']
    readonly_fields = []
    ordering = ['-amount']
    verbose_name = 'Transfer Line'
    verbose_name_plural = 'Transfer Lines'


@admin.register(CustomerFundTransfer)
class CustomerFundTransferAdmin(admin.ModelAdmin):
    list_display = ['id', 'reference_number', 'transfer_date', 'source_payment_master_id', 'total_debit', 'total_credit', 'created_by', 'created_at']
    list_filter = ['transfer_date', 'created_at']
    search_fields = ['reference_number', 'source_payment_master_id__id']
    ordering = ['-transfer_date', '-id']
    readonly_fields = ['created_at']
    date_hierarchy = 'transfer_date'
    inlines = [CustomerFundTransferLineInline]
    list_select_related = ['source_payment_master_id', 'created_by']

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('source_payment_master_id', 'created_by').prefetch_related('lines')

    def total_debit(self, obj):
        return sum([line.amount for line in obj.lines.all() if line.amount < 0])
    total_debit.short_description = 'Total Debit'

    def total_credit(self, obj):
        return sum([line.amount for line in obj.lines.all() if line.amount > 0])
    total_credit.short_description = 'Total Credit'


@admin.register(CustomerFundTransferLine)
class CustomerFundTransferLineAdmin(admin.ModelAdmin):
    list_display = ['id', 'transfer_id', 'customer_id', 'amount']
    list_filter = ['transfer_id', 'customer_id']
    search_fields = ['transfer_id__reference_number', 'customer_id__customer_name']
    ordering = ['-transfer_id', '-amount']
    readonly_fields = []
    date_hierarchy = None
    list_select_related = ['transfer_id', 'customer_id']


@admin.register(PaymentDetails)
class PaymentDetailsAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'payment_master_id', 'customer_name', 'invoice_number', 
        'pay_amount', 'transaction_id', 'status', 'received_by', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = [
        'transaction_id', 
        'payment_master_id__id',
        'payment_master_id__invoice_master_id__invoice_number'
    ]
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    list_per_page = 25
    list_select_related = [
        'payment_master_id__customer_entitlement_master_id__customer_master_id',
        'payment_master_id__invoice_master_id',
        'received_by',
        'created_by'
    ]
    
    fieldsets = (
        ('Payment Detail Information', {
            'fields': ('payment_master_id', 'pay_amount', 'transaction_id', 'status')
        }),
        ('Additional Information', {
            'fields': ('remarks',)
        }),
        ('Metadata', {
            'fields': ('received_by', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def customer_name(self, obj):
        """Display customer name"""
        return obj.payment_master_id.customer_entitlement_master_id.customer_master_id.customer_name
    customer_name.short_description = 'Customer'
    
    def invoice_number(self, obj):
        """Display invoice number"""
        return obj.payment_master_id.invoice_master_id.invoice_number
    invoice_number.short_description = 'Invoice Number'
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related(
            'payment_master_id__customer_entitlement_master_id__customer_master_id',
            'payment_master_id__invoice_master_id',
            'received_by',
            'created_by'
        )

    actions = ['recalculate_invoice_balance_action']

    @admin.action(description='Recalculate invoice balance')
    def recalculate_invoice_balance_action(self, request, queryset):
        """Update invoice paid/due for parent payments of selected details."""
        seen = set()
        with transaction.atomic():
            for detail in queryset.select_related('payment_master_id__invoice_master_id'):
                inv = getattr(detail.payment_master_id, 'invoice_master_id', None)
                if inv and inv.id not in seen:
                    inv.update_payment_status()
                    seen.add(inv.id)
        self.message_user(
            request,
            f'Updated balance for {len(seen)} invoice(s).',
            messages.SUCCESS
        )

    def save_model(self, request, obj, form, change):
        """Save payment detail and update invoice balance."""
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            if obj.payment_master_id and obj.payment_master_id.invoice_master_id_id:
                obj.payment_master_id.invoice_master_id.update_payment_status()

    def delete_model(self, request, obj):
        """Delete payment detail and update invoice balance."""
        payment = obj.payment_master_id
        invoice = payment.invoice_master_id if payment else None
        with transaction.atomic():
            super().delete_model(request, obj)
            if invoice:
                invoice.update_payment_status()
