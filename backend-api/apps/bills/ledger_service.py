"""
Customer Payment & Invoice Ledger Report service.
Builds ledger data from Customer Master, Invoice Master, Payment Master, Payment Details.
"""
from decimal import Decimal
from datetime import date as date_type
from collections import defaultdict
from django.db.models import Sum, Q, F

from apps.customers.models import CustomerMaster
from apps.bills.models import InvoiceMaster
from apps.payment.models import PaymentMaster, PaymentDetails


def _decimal(val):
    if val is None:
        return Decimal('0.00')
    return Decimal(str(val)).quantize(Decimal('0.01'))


def _invoices_for_customer(customer_id):
    """All invoices for customer (via entitlement or direct customer_master_id)."""
    return InvoiceMaster.objects.filter(
        Q(customer_entitlement_master_id__customer_master_id_id=customer_id)
        | Q(customer_master_id_id=customer_id)
    ).distinct()


def get_customer_ledger(customer_id, from_date=None, to_date=None):
    """
    Build invoice and payment ledger for one customer with running balance.
    Returns: dict with customer_id, customer_name, from_date, to_date, opening_balance, ledger_entries, closing_balance.
    """
    try:
        customer = CustomerMaster.objects.get(pk=customer_id)
    except CustomerMaster.DoesNotExist:
        return None

    invoices_qs = _invoices_for_customer(customer_id).order_by('issue_date', 'id')

    # Opening balance: invoices before from_date minus payments before from_date (use invoice IDs to avoid double-count)
    opening = Decimal('0.00')
    if from_date:
        inv_ids_before = list(
            invoices_qs.filter(issue_date__lt=from_date).values_list('id', flat=True)
        )
        inv_before = invoices_qs.filter(issue_date__lt=from_date).aggregate(
            total=Sum('total_bill_amount')
        )['total']
        pay_before = PaymentDetails.objects.filter(
            payment_master_id__invoice_master_id__in=inv_ids_before,
            payment_master_id__payment_date__lt=from_date,
            status='completed'
        ).aggregate(total=Sum('pay_amount'))['total']
        opening = _decimal(inv_before or 0) - _decimal(pay_before or 0)
        if not inv_ids_before:
            opening = Decimal('0.00')

    # Invoice events in date range
    events = []
    inv_in_range = invoices_qs
    if from_date:
        inv_in_range = inv_in_range.filter(issue_date__gte=from_date)
    if to_date:
        inv_in_range = inv_in_range.filter(issue_date__lte=to_date)

    for inv in inv_in_range:
        events.append({
            'type': 'invoice',
            'invoice_id': inv.id,
            'invoice_number': inv.invoice_number or '',
            'invoice_date': inv.issue_date,
            'payment_method': None,
            'payment_remarks': None,
            'invoice_amount': _decimal(inv.total_bill_amount),
            'payment_received_amount': _decimal(0),
            'total_due_amount': None,
            'payment_date': None,
            'running_balance': None,
            # Sort: by invoice date, then invoice id, then invoice row (0) before payments (1), then payment date
            '_sort': (inv.issue_date, inv.id, 0, date_type.min),
        })

    # Payment events in date range (one row per PaymentMaster)
    pm_filter = Q(
        invoice_master_id__customer_entitlement_master_id__customer_master_id_id=customer_id
    ) | Q(invoice_master_id__customer_master_id_id=customer_id)
    pay_masters = PaymentMaster.objects.filter(pm_filter).select_related('invoice_master_id')
    if from_date:
        pay_masters = pay_masters.filter(payment_date__gte=from_date)
    if to_date:
        pay_masters = pay_masters.filter(payment_date__lte=to_date)
    pay_masters = list(pay_masters.distinct())

    # Batch fetch payment totals (avoid N+1)
    pm_ids = [pm.id for pm in pay_masters]
    pay_totals_qs = (
        PaymentDetails.objects.filter(
            payment_master_id__in=pm_ids,
            status='completed'
        )
        .values('payment_master_id')
        .annotate(total=Sum('pay_amount'))
    )
    pay_totals_by_pm = {r['payment_master_id']: _decimal(r['total']) for r in pay_totals_qs}

    for pm in pay_masters:
        total_pay = pay_totals_by_pm.get(pm.id, Decimal('0'))
        if total_pay <= 0:
            continue
        inv = pm.invoice_master_id
        events.append({
            'type': 'payment',
            'invoice_id': inv.id,
            'invoice_number': inv.invoice_number or '',
            'invoice_date': inv.issue_date,
            'payment_method': pm.payment_method or '',
            'payment_remarks': pm.remarks or '',
            'invoice_amount': _decimal(inv.total_bill_amount),
            'payment_received_amount': _decimal(total_pay),
            'total_due_amount': None,
            'payment_date': pm.payment_date,
            'running_balance': None,
            '_sort': (inv.issue_date, inv.id, 1, pm.payment_date if pm.payment_date else date_type.min),
        })

    # Order: invoice row first for each invoice, then its payments by payment date (so running balance is correct)
    events.sort(key=lambda e: e['_sort'])
    running = opening
    total_bill_amount = Decimal('0')
    total_received_amount = Decimal('0')
    for e in events:
        if e['type'] == 'invoice':
            running = running + e['invoice_amount']
            total_bill_amount += e['invoice_amount']
        else:
            running = running - e['payment_received_amount']
            total_received_amount += e['payment_received_amount']
        e['total_due_amount'] = float(running)
        e['running_balance'] = float(running)
        e['invoice_amount'] = float(e['invoice_amount'])
        e['payment_received_amount'] = float(e['payment_received_amount'])
        e['invoice_date'] = e['invoice_date'].isoformat() if hasattr(e['invoice_date'], 'isoformat') else str(e['invoice_date'])
        e['payment_date'] = e['payment_date'].isoformat() if e['payment_date'] and hasattr(e['payment_date'], 'isoformat') else (str(e['payment_date']) if e['payment_date'] else None)
        del e['_sort']

    return {
        'customer_id': customer.id,
        'customer_name': customer.customer_name,
        'company_name': customer.company_name or '',
        'from_date': from_date.isoformat() if from_date else None,
        'to_date': to_date.isoformat() if to_date else None,
        'opening_balance': float(opening),
        'total_bill_amount': float(total_bill_amount),
        'total_received_amount': float(total_received_amount),
        'total_invoice_due_amount': float(running),
        'ledger_entries': events,
        'closing_balance': float(running),
    }


def get_all_customers_ledger_summary(from_date=None, to_date=None, kam_id=None):
    """
    Combined ledger summary for all customers in the date period.
    Returns list of: customer_id, customer_name, company_name, kam_name, status,
    opening_balance (estimated), total_bill_amount, total_payment_received, total_due_balance.

    Optimized: uses bulk queries instead of O(n) per-customer queries.
    :param kam_id: optional KAM id to restrict customers assigned to that KAM.
    """
    qs = CustomerMaster.objects.filter(is_active=True)
    if kam_id:
        qs = qs.filter(kam_id_id=kam_id)
    customers = list(
        qs.order_by('customer_name')
        .values('id', 'customer_name', 'company_name', 'status', 'kam_id_id')
        .annotate(kam_name=F('kam_id__kam_name'))
    )
    if not customers:
        return []

    customer_ids = {c['id'] for c in customers}

    # Base invoice filter for these customers (entitlement or direct)
    inv_base_filter = (
        Q(customer_entitlement_master_id__customer_master_id_id__in=customer_ids)
        | Q(customer_master_id_id__in=customer_ids)
    )

    # 1. All invoices for these customers - with customer_id resolution
    inv_qs = (
        InvoiceMaster.objects.filter(inv_base_filter)
        .select_related('customer_entitlement_master_id', 'customer_master_id')
        .only(
            'id',
            'total_bill_amount',
            'issue_date',
            'customer_master_id_id',
            'customer_entitlement_master_id_id',
        )
    )
    inv_in_period = inv_qs
    if from_date:
        inv_in_period = inv_in_period.filter(issue_date__gte=from_date)
    if to_date:
        inv_in_period = inv_in_period.filter(issue_date__lte=to_date)

    # Maps: customer_id -> total_bill (in period), customer_id -> set(inv_ids)
    customer_bill = defaultdict(lambda: Decimal('0'))
    customer_inv_ids = defaultdict(set)

    for inv in inv_in_period:
        cid = inv.customer_master_id_id or (
            inv.customer_entitlement_master_id.customer_master_id_id
            if inv.customer_entitlement_master_id_id
            else None
        )
        if cid in customer_ids:
            customer_bill[cid] += _decimal(inv.total_bill_amount)
            customer_inv_ids[cid].add(inv.id)

    all_inv_ids = set()
    for ids in customer_inv_ids.values():
        all_inv_ids.update(ids)

    # 2. Payment totals (in period) - single query
    pay_filter = Q(
        status='completed',
        payment_master_id__invoice_master_id__in=all_inv_ids
        if all_inv_ids
        else [],
    )
    if from_date:
        pay_filter = pay_filter & Q(payment_master_id__payment_date__gte=from_date)
    if to_date:
        pay_filter = pay_filter & Q(payment_master_id__payment_date__lte=to_date)

    customer_payment = defaultdict(lambda: Decimal('0'))
    customer_total_due = defaultdict(lambda: Decimal('0'))

    if all_inv_ids:
        # Payments in period - aggregate by invoice, then map to customer
        pay_in_period = (
            PaymentDetails.objects.filter(pay_filter)
            .values('payment_master_id__invoice_master_id')
            .annotate(s=Sum('pay_amount'))
        )
        inv_to_customer = {}
        for cid, inv_ids in customer_inv_ids.items():
            for iid in inv_ids:
                inv_to_customer[iid] = cid
        for row in pay_in_period:
            inv_id = row['payment_master_id__invoice_master_id']
            cid = inv_to_customer.get(inv_id)
            if cid:
                customer_payment[cid] += _decimal(row['s'])

        # 3. Closing balance: all invoices to to_date - all payments to to_date
        inv_to_date = inv_qs
        if to_date:
            inv_to_date = inv_to_date.filter(issue_date__lte=to_date)
        inv_totals = {}
        for inv in inv_to_date.only('id', 'total_bill_amount', 'customer_master_id_id', 'customer_entitlement_master_id_id'):
            cid = inv.customer_master_id_id or (
                inv.customer_entitlement_master_id.customer_master_id_id
                if inv.customer_entitlement_master_id_id
                else None
            )
            if cid in customer_ids:
                inv_totals[inv.id] = (cid, _decimal(inv.total_bill_amount))

        pay_to_date_filter = Q(
            status='completed',
            payment_master_id__invoice_master_id__in=all_inv_ids,
        )
        if to_date:
            pay_to_date_filter = pay_to_date_filter & Q(
                payment_master_id__payment_date__lte=to_date
            )
        pay_to_date = (
            PaymentDetails.objects.filter(pay_to_date_filter)
            .values('payment_master_id__invoice_master_id')
            .annotate(s=Sum('pay_amount'))
        )
        pay_by_inv = {r['payment_master_id__invoice_master_id']: _decimal(r['s']) for r in pay_to_date}

        for inv_id, (cid, inv_amt) in inv_totals.items():
            pay_amt = pay_by_inv.get(inv_id, Decimal('0'))
            customer_total_due[cid] += inv_amt - pay_amt

    # Build result
    out = []
    for c in customers:
        cid = c['id']
        bill = _decimal(customer_bill[cid])
        rcvd = _decimal(customer_payment[cid])
        due = customer_total_due[cid]
        closing = float(due)
        # Estimated opening at start of period: closing AR − bill in period + collections in period
        opening = float(_decimal(due) - bill + rcvd)
        status = c.get('status') or 'active'
        status_display = 'Active' if status == 'active' else (
            'Discontinued' if status in ('inactive', 'suspended') else status.title()
        )
        out.append({
            'customer_id': cid,
            'customer_name': c['customer_name'],
            'company_name': (c.get('company_name') or '') or '',
            'kam_id': c.get('kam_id_id'),
            'kam_name': c.get('kam_name') or '',
            'status': status,
            'status_display': status_display,
            'opening_balance': opening,
            'total_bill_amount': float(bill),
            'total_payment_received': float(rcvd),
            'total_due_balance': closing,
        })
    return out
