"""
Centralized invoice and payment recalculation service.

Provides unified logic for:
- Computing InvoiceDetails sub_total from mbps/unit_price/dates (BW, SOHO)
- Recalculating InvoiceMaster totals (subtotal, VAT, discount, paid, due, overpayment)
- Ensuring data consistency across invoice, payment, and entitlement records.

All monetary calculations use per-line VAT and discount rates stored on InvoiceDetails.
"""
from decimal import Decimal
from datetime import date
from calendar import monthrange

from django.db import transaction
from apps.customers.models import CustomerMaster


def compute_invoice_detail_sub_total(invoice_detail, invoice=None):
    """
    Compute sub_total for an InvoiceDetails line based on type (BW/SOHO).

    Uses the same formulas as invoice generation (utils.calculate_*_customer_bill).
    Requires: start_date, end_date, type. For BW: mbps, unit_price. For SOHO: package_pricing_id.

    Args:
        invoice_detail: InvoiceDetails instance (or dict with keys)
        invoice: InvoiceMaster (optional, for billing period and customer_type if not on detail)

    Returns:
        Decimal: Computed sub_total, or existing sub_total if insufficient data
    """
    from apps.bills.utils import calculate_pro_rated_amount
    from apps.bills.models import InvoiceMaster

    # Resolve invoice if not provided
    if invoice is None and hasattr(invoice_detail, 'invoice_master_id'):
        invoice = invoice_detail.invoice_master_id
    if invoice is None:
        return getattr(invoice_detail, 'sub_total', Decimal('0'))

    # Get customer type from invoice's entitlement
    try:
        entitlement = invoice.customer_entitlement_master_id
        customer = entitlement.customer_master_id
        customer_type = customer.customer_type
    except Exception:
        return getattr(invoice_detail, 'sub_total', Decimal('0'))

    # Extract fields (support both model instance and dict)
    def _get(obj, key, default=None):
        if hasattr(obj, key):
            return getattr(obj, key, default)
        return obj.get(key, default) if isinstance(obj, dict) else default

    line_type = _get(invoice_detail, 'type') or customer_type
    start_date = _get(invoice_detail, 'start_date')
    end_date = _get(invoice_detail, 'end_date')
    mbps = _get(invoice_detail, 'mbps')
    unit_price = _get(invoice_detail, 'unit_price')
    package_pricing = _get(invoice_detail, 'package_pricing_id')

    # Billing period from invoice
    issue_date = invoice.issue_date
    if not issue_date:
        return getattr(invoice_detail, 'sub_total', Decimal('0'))
    _, last_day = monthrange(issue_date.year, issue_date.month)
    billing_start = date(issue_date.year, issue_date.month, 1)
    billing_end = date(issue_date.year, issue_date.month, last_day)

    if not start_date:
        return getattr(invoice_detail, 'sub_total', Decimal('0'))

    # Determine effective dates
    effective_end = end_date if end_date else billing_end
    if effective_end > billing_end:
        effective_end = billing_end
    effective_start = start_date
    if effective_start < billing_start:
        effective_start = billing_start
    if effective_start > effective_end:
        return Decimal('0.00')

    days = (effective_end - effective_start).days + 1
    if days <= 0:
        return Decimal('0.00')

    sub_total = Decimal('0.00')

    if customer_type == CustomerMaster.CUSTOMER_TYPE_BW or line_type == 'bw':
        if mbps is not None and unit_price is not None:
            sub_total = calculate_pro_rated_amount(
                mbps, unit_price, start_date, end_date, billing_start, billing_end
            )
    elif customer_type == CustomerMaster.CUSTOMER_TYPE_SOHO or line_type == 'soho':
        if isinstance(package_pricing, int):
            from apps.package.models import PackagePricing
            try:
                package_pricing = PackagePricing.objects.get(pk=package_pricing)
            except PackagePricing.DoesNotExist:
                package_pricing = None
        if package_pricing and hasattr(package_pricing, 'rate') and package_pricing.rate is not None:
            _, days_in_month = monthrange(effective_end.year, effective_end.month)
            prorated = (Decimal(days) / Decimal(days_in_month)) * package_pricing.rate
            sub_total = prorated.quantize(Decimal('0.01'))
        elif mbps is not None and unit_price is not None:
            sub_total = Decimal(str(days)) * mbps * unit_price
            sub_total = sub_total.quantize(Decimal('0.01'))

    return sub_total if sub_total else getattr(invoice_detail, 'sub_total', Decimal('0'))


def recalculate_invoice_totals(invoice):
    """
    Recalculate all totals on InvoiceMaster from its details and payments.

    Uses per-line VAT and discount (from InvoiceDetails).
    Total paid from completed PaymentDetails; overpayment stays as customer credit.

    Updates: total_bill, total_vat_amount, total_discount_amount, total_bill_amount,
             total_paid_amount, total_balance_due, status.
    """
    from django.db.models import Sum

    if not invoice or not invoice.pk:
        return

    details = invoice.details.all()
    # Use Decimal('0') as start value so sum() returns Decimal even when details is empty
    # (sum([]) returns int 0, which has no .quantize() method)
    total_subtotal = sum((d.sub_total for d in details), Decimal('0'))
    total_subtotal = total_subtotal.quantize(Decimal('0.01'))

    total_vat = sum(
        (d.sub_total * (d.vat_rate / Decimal('100')) for d in details),
        Decimal('0')
    )
    total_vat = total_vat.quantize(Decimal('0.01'))

    total_discount = sum(
        (d.sub_total * (d.sub_discount_rate / Decimal('100')) for d in details),
        Decimal('0')
    )
    total_discount = total_discount.quantize(Decimal('0.01'))

    total_bill_amount = total_subtotal + total_vat - total_discount
    total_bill_amount = total_bill_amount.quantize(Decimal('0.01'))

    # Total paid from completed payment details (matches ledger and update_payment_status)
    from apps.payment.models import PaymentDetails
    total_paid_raw = (
        PaymentDetails.objects.filter(
            payment_master_id__invoice_master_id=invoice,
            status='completed'
        ).aggregate(total=Sum('pay_amount'))['total'] or Decimal('0')
    )
    # Cap paid at bill amount on invoice (excess is customer credit)
    total_paid = min(total_paid_raw, total_bill_amount)
    total_paid = total_paid.quantize(Decimal('0.01'))

    total_balance_due = total_bill_amount - total_paid
    total_balance_due = total_balance_due.quantize(Decimal('0.01'))

    # Status
    if total_balance_due <= 0 and total_bill_amount > 0:
        status = 'paid'
    elif total_balance_due == 0 and total_bill_amount == 0:
        status = 'paid'
    elif total_paid > 0:
        status = 'partial'
    else:
        status = 'unpaid'

    invoice.total_bill = total_subtotal
    invoice.total_vat_amount = total_vat
    invoice.total_discount_amount = total_discount
    invoice.total_bill_amount = total_bill_amount
    invoice.total_paid_amount = total_paid
    invoice.total_balance_due = total_balance_due
    invoice.status = status
    # Use skip_auto_calc=True to avoid recursion: save() -> calculate_totals() -> recalculate_invoice_totals()
    invoice.save(
        update_fields=[
            'total_bill', 'total_vat_amount', 'total_discount_amount',
            'total_bill_amount', 'total_paid_amount', 'total_balance_due', 'status'
        ],
        skip_auto_calc=True
    )

    # Refresh all linked entitlement totals (primary + additional entitlements).
    entitlement_ids = set(invoice.get_all_entitlement_ids()) if hasattr(invoice, 'get_all_entitlement_ids') else set()
    if not entitlement_ids and invoice.customer_entitlement_master_id_id:
        entitlement_ids.add(invoice.customer_entitlement_master_id_id)
    if entitlement_ids:
        from apps.bills.models import CustomerEntitlementMaster
        for entitlement in CustomerEntitlementMaster.objects.filter(id__in=entitlement_ids):
            entitlement.calculate_total_bill()
