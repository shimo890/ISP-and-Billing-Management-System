import re
from datetime import datetime, timedelta, date
from calendar import monthrange
from django.utils import timezone
from django.db import transaction, models
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
from apps.customers.models import CustomerMaster





def generate_bill_number(customer_name, bill_id, billing_date=None, prefix='KTL-BL'):
    """
    Generate unique bill number in format: KTL-BL-{3 chars customer name}-{bill_id}-{DD-Month-YYYY}
    
    Example: KTL-BL-Cyb-1-27-June-2025
    
    Args:
        customer_name: Customer name or company name
        bill_id: Bill record ID
        billing_date: Billing date (defaults to today)
    
    Returns:
        str: Generated bill number
    """
    # Use billing_date or today's date
    if billing_date is None:
        billing_date = timezone.now().date()
    
    # Clean customer name: remove special characters, take first 3 letters
    # Use company_name if available, otherwise use name
    clean_name = re.sub(r'[^a-zA-Z]', '', customer_name or 'CUST')
    clean_name = clean_name[:3] if len(clean_name) >= 3 else clean_name.ljust(3, 'X')
    # Capitalize first letter, keep rest lowercase for consistency
    clean_name = clean_name.capitalize()
    
    # Format date as DD-Month-YYYY (e.g., 27-June-2025)
    # Use day without leading zero to match format (e.g., 7 not 07)
    day = str(billing_date.day)
    month = billing_date.strftime('%B')  # Full month name (January, February, etc.)
    year = billing_date.strftime('%Y')
    date_str = f"{day}-{month}-{year}"
    
    # Generate bill number: {prefix}-{3 chars}-{bill_id}-{DD-Month-YYYY}
    bill_number = f"{prefix}-{clean_name}-{bill_id}-{date_str}"
    
    return bill_number


def calculate_pro_rated_amount(mbps, unit_price, start_date, end_date, billing_start_date, billing_end_date):
    """
    Calculate pro-rated amount for a given period.
    
    Args:
        mbps (Decimal): Bandwidth in Mbps
        unit_price (Decimal): Price per Mbps
        start_date (date): Service start date
        end_date (date): Service end date (can be None or future)
        billing_start_date (date): Billing period start
        billing_end_date (date): Billing period end
        
    Returns:
        Decimal: Pro-rated amount
    """
    from decimal import Decimal
    import calendar
    
    # If no end date or end date is future, cap at billing end date
    effective_end = end_date if end_date else billing_end_date
    if effective_end > billing_end_date:
        effective_end = billing_end_date
        
    # If start date is before billing start, cap at billing start
    effective_start = start_date
    if effective_start < billing_start_date:
        effective_start = billing_start_date
        
    # Check for valid overlap
    if effective_start > effective_end:
        return Decimal('0.00')
        
    # Calculate active days (inclusive)
    active_days = (effective_end - effective_start).days + 1
    
    # Calculate total days in the billing month
    # We assume billing is done monthly based on the billing_start_date's month
    _, days_in_month = calendar.monthrange(billing_start_date.year, billing_start_date.month)
    
    # Calculate daily rate
    monthly_total = mbps * unit_price
    daily_rate = monthly_total / Decimal(str(days_in_month))

    # Calculate and round to 2 decimal places
    result = daily_rate * Decimal(str(active_days))
    return result.quantize(Decimal('0.01'))


def calculate_period_cost(mbps, unit_price, start_date, end_date):
    """
    Calculate total cost for a specific period using simple day-wise calculation.

    For BW customers: total_bill = mbps * unit_price * days
    Where days = (end_date - start_date) + 1

    Args:
        mbps (Decimal): Bandwidth in Mbps
        unit_price (Decimal): Price per Mbps
        start_date (date): Start date
        end_date (date): End date (if None, returns 1 day cost)

    Returns:
        Decimal: Total calculated cost
    """
    from decimal import Decimal

    # If no end date, return 1 day cost
    if not end_date:
        return mbps * unit_price

    # Calculate number of days (inclusive)
    days = (end_date - start_date).days + 1

    # Simple calculation: mbps * unit_price * days
    result = mbps * unit_price * Decimal(str(days))
    return result.quantize(Decimal('0.01'))


# ==================== Invoice Generation Utilities ====================

def get_billing_start_date(customer, entitlement):
    """
    Determine billing start date using the specification logic:
    - If last_bill_invoice_date exists in customer_master or entitlement_master, use day after it
    - Otherwise, return None (billing will use each entitlement_detail's start_date)
    
    IMPORTANT: When last_bill_invoice_date is NULL/empty, do NOT use activation_date.
    Each entitlement detail's start_date will be used as the billing start date for that detail.
    
    Args:
        customer: CustomerMaster instance
        entitlement: CustomerEntitlementMaster instance
        
    Returns:
        date or None: Billing start date, or None if no last_bill_invoice_date exists
    """
    # Check entitlement's last_bill_invoice_date first
    if entitlement.last_bill_invoice_date:
        # Use day after last invoice date
        last_date = entitlement.last_bill_invoice_date
        if isinstance(last_date, datetime):
            last_date = last_date.date()
        return last_date + timedelta(days=1)
    
    # Check customer's last_bill_invoice_date
    if customer.last_bill_invoice_date:
        last_date = customer.last_bill_invoice_date
        if isinstance(last_date, datetime):
            last_date = last_date.date()
        return last_date + timedelta(days=1)
    
    # When last_bill_invoice_date is NULL/empty, return None
    # The billing calculation will use each entitlement_detail's start_date directly
    return None


def calculate_billing_period_days(start_date, end_date):
    """
    Calculate number of days in billing period (inclusive).
    
    Args:
        start_date (date): Billing period start
        end_date (date): Billing period end
        
    Returns:
        int: Number of days (inclusive)
    """
    if not start_date or not end_date:
        return 0
    
    if end_date < start_date:
        return 0
    
    return (end_date - start_date).days + 1


def has_unpaid_invoices_for_detail(entitlement_detail):
    """
    Check if an entitlement detail has any unpaid invoices.
    
    This function is used to determine if inactive entitlement details should be
    included in new invoice calculations. An inactive detail should be included if:
    1. It has never been invoiced (no invoice exists)
    2. It has invoices that are unpaid or partially paid
    
    Args:
        entitlement_detail: CustomerEntitlementDetails instance
        
    Returns:
        bool: True if there are unpaid/partial invoices or no invoices exist,
              False if all invoices are fully paid
    """
    from apps.bills.models import InvoiceDetails, InvoiceMaster
    from django.db.models import Q
    
    # Get all invoice details that reference this entitlement detail
    invoice_details = InvoiceDetails.objects.filter(
        entitlement_details_id=entitlement_detail
    ).select_related('invoice_master_id')
    
    if not invoice_details.exists():
        # Never been invoiced - should be included
        return True
    
    # Check if any related invoice has unpaid balance
    for inv_detail in invoice_details:
        invoice = inv_detail.invoice_master_id
        # Include if invoice is not fully paid (unpaid, partial, or issued status)
        # Also check total_balance_due to be safe
        if invoice.status in ['unpaid', 'partial', 'issued'] or (invoice.total_balance_due and invoice.total_balance_due > 0):
            return True
    
    # All invoices are paid
    return False


def calculate_bw_customer_bill(entitlement, target_date):
    """
    Calculate bill for Bandwidth (BW) customers.
    
    BW customers have multiple entitlement details representing different packages
    (IPT, CDN, NIX, GCC, BAISHAN) and package changes over time.
    
    Formula: Bill = (Number of Days) × (Mbps) × (Unit Price)
    
    Args:
        entitlement: CustomerEntitlementMaster instance
        target_date (date): Target invoice date (billing period end)
        
    Returns:
        dict: {
            'total_bill': Decimal,
            'billing_start_date': date,
            'billing_end_date': date,
            'details': List[dict] - breakdown by entitlement detail
        }
    """
    from apps.bills.models import CustomerEntitlementDetails
    
    customer = entitlement.customer_master_id
    
    # Get billing start date
    billing_start_date = get_billing_start_date(customer, entitlement)
    billing_end_date = target_date
    
    if isinstance(billing_end_date, str):
        billing_end_date = datetime.strptime(billing_end_date, '%Y-%m-%d').date()
    
    # Get all active entitlement details for this entitlement
    # Filter by start_date <= target_date (exclude future entitlements)
    active_details = CustomerEntitlementDetails.objects.filter(
        cust_entitlement_id=entitlement,
        type=CustomerMaster.CUSTOMER_TYPE_BW,
        is_active=True,
        status='active',
        start_date__lte=billing_end_date
    ).order_by('start_date')
    
    # Get inactive entitlement details with unpaid invoices
    # These should be included in billing to collect outstanding amounts
    inactive_details = CustomerEntitlementDetails.objects.filter(
        cust_entitlement_id=entitlement,
        type=CustomerMaster.CUSTOMER_TYPE_BW,
        is_active=False,
        start_date__lte=billing_end_date
    ).prefetch_related('invoice_details__invoice_master_id')
    
    # Filter inactive details to only include those with unpaid invoices
    unpaid_inactive = []
    for detail in inactive_details:
        if has_unpaid_invoices_for_detail(detail):
            unpaid_inactive.append(detail)
    
    # Combine active and unpaid inactive details, sort by start_date
    all_details = list(active_details) + unpaid_inactive
    all_details.sort(key=lambda x: x.start_date)
    
    # Use combined list for calculations
    details = all_details
    
    total_bill = Decimal('0.00')
    detail_breakdown = []
    
    for detail in details:
        # Determine effective start and end dates for this detail within billing period
        # If billing_start_date is None (no last_bill_invoice_date), use detail's start_date directly
        # Otherwise, use the later of detail.start_date and billing_start_date
        if billing_start_date is None:
            # No last_bill_invoice_date: use each detail's start_date as billing start date
            effective_start = detail.start_date
        else:
            # Use the later of detail.start_date and billing_start_date
            effective_start = max(detail.start_date, billing_start_date) if detail.start_date else billing_start_date
        
        # Use detail's end_date or billing_end_date, whichever is earlier
        if detail.end_date:
            effective_end = min(detail.end_date, billing_end_date)
        else:
            effective_end = billing_end_date
        
        # Skip if effective_start is None or effective_start > effective_end (detail is outside billing period)
        if not effective_start or effective_start > effective_end:
            continue
        
        # Calculate days for this detail
        days = calculate_billing_period_days(effective_start, effective_end)

        if days <= 0:
            continue

        # Calculate amount using prorated monthly billing
        # Formula: bill = days × (monthly_mbps × monthly_unit_price) / days_in_month
        # Explanation:
        # - mbps and unit_price are MONTHLY values (e.g., 20 Mbps, $10/month)
        # - Convert to daily: (20 × 10) / 30 = $6.67 per day
        # - Apply to billing period: $6.67 × days = total amount
        # 
        # IMPORTANT: Include ALL entitlement details, even if mbps=0 or unit_price=0
        # - Negative MBPS: Represents bandwidth reduction, results in negative amount (credit)
        # - Zero values: Must be shown in invoice for transparency
        if detail.mbps is not None and detail.unit_price is not None:
            from calendar import monthrange
            
            # Get days in the month being billed (use effective_end date's month)
            _, days_in_month = monthrange(effective_end.year, effective_end.month)
            
            # Calculate monthly bill amount
            # Negative MBPS will result in negative monthly_bill (credit/reduction)
            monthly_bill = detail.mbps * detail.unit_price
            
            # Calculate daily rate (prorate monthly to daily)
            daily_rate = monthly_bill / Decimal(str(days_in_month))
            
            # Calculate billing period amount
            # This maintains the sign: negative MBPS → negative amount
            amount = daily_rate * Decimal(str(days))
            amount = amount.quantize(Decimal('0.01'))  # Round to 2 decimal places
            total_bill += amount
            
            # Extract bandwidth type from Package Master table
            bandwidth_type = CustomerMaster.CUSTOMER_TYPE_BW
            if detail.package_master_id:
                bandwidth_type = detail.package_master_id.package_name
            
            detail_breakdown.append({
                'detail_id': detail.id,
                'package_name': bandwidth_type,
                'start_date': effective_start,
                'end_date': effective_end,
                'days': days,
                'mbps': float(detail.mbps),
                'unit_price': float(detail.unit_price),
                'days_in_month': days_in_month,
                'monthly_bill': float(monthly_bill),
                'daily_rate': float(daily_rate),
                'amount': float(amount),
                'remarks': detail.remarks or ''
            })
    
    # If billing_start_date is None, use the earliest detail's start_date for display purposes
    # (Each detail already uses its own start_date in the calculation)
    final_billing_start_date = billing_start_date
    if final_billing_start_date is None and detail_breakdown:
        # Find the earliest start_date from all details
        earliest_start = min(detail['start_date'] for detail in detail_breakdown if detail.get('start_date'))
        final_billing_start_date = earliest_start if earliest_start else None
    
    return {
        'total_bill': total_bill,
        'billing_start_date': final_billing_start_date,
        'billing_end_date': billing_end_date,
        'details': detail_breakdown,
        'customer_type': CustomerMaster.CUSTOMER_TYPE_BW
    }


def calculate_mac_customer_bill(entitlement, target_date):
    raise NotImplementedError('MAC/Channel Partner billing removed. Use BW or SOHO only.')


def _unused_mac_customer_bill(entitlement, target_date):
    """
    Calculate bill for MAC/Channel Partner customers.
    
    MAC customers have usage-based billing with percentage share.
    Each usage is an independent billable record under the same entitlement.
    
    Formula: Bill = (Number of Days) × (Mbps) × (Unit Price) × (Percentage Share %)
    
    Percentage share comes from:
    - custom_mac_percentage_share in entitlement_details (if set)
    - OR default_percentage_share from customer_master
    
    Args:
        entitlement: CustomerEntitlementMaster instance
        target_date (date): Target invoice date (billing period end)
        
    Returns:
        dict: {
            'total_bill': Decimal,
            'billing_start_date': date,
            'billing_end_date': date,
            'details': List[dict] - breakdown by usage
        }
    """
    from apps.bills.models import CustomerEntitlementDetails
    
    customer = entitlement.customer_master_id
    
    # Get billing start date
    billing_start_date = get_billing_start_date(customer, entitlement)
    billing_end_date = target_date
    
    if isinstance(billing_end_date, str):
        billing_end_date = datetime.strptime(billing_end_date, '%Y-%m-%d').date()
    
    # Get all active entitlement details (usages) for this entitlement
    # Filter by start_date <= target_date (exclude future usages)
    active_details = CustomerEntitlementDetails.objects.filter(
        cust_entitlement_id=entitlement,
        type=CustomerMaster.CUSTOMER_TYPE_MAC,
        is_active=True,
        status='active',
        start_date__lte=billing_end_date
    ).order_by('start_date')
    
    # Get inactive entitlement details with unpaid invoices
    # These should be included in billing to collect outstanding amounts
    inactive_details = CustomerEntitlementDetails.objects.filter(
        cust_entitlement_id=entitlement,
        type=CustomerMaster.CUSTOMER_TYPE_MAC,
        is_active=False,
        start_date__lte=billing_end_date
    ).prefetch_related('invoice_details__invoice_master_id')
    
    # Filter inactive details to only include those with unpaid invoices
    unpaid_inactive = []
    for detail in inactive_details:
        if has_unpaid_invoices_for_detail(detail):
            unpaid_inactive.append(detail)
    
    # Combine active and unpaid inactive details, sort by start_date
    all_details = list(active_details) + unpaid_inactive
    all_details.sort(key=lambda x: x.start_date)
    
    # Use combined list for calculations
    details = all_details
    
    total_bill = Decimal('0.00')
    detail_breakdown = []
    
    for detail in details:
        # Determine effective start and end dates for this usage within billing period
        # If billing_start_date is None (no last_bill_invoice_date), use detail's start_date directly
        # Otherwise, use the later of detail.start_date and billing_start_date
        if billing_start_date is None:
            # No last_bill_invoice_date: use each detail's start_date as billing start date
            effective_start = detail.start_date
        else:
            # Use the later of detail.start_date and billing_start_date
            effective_start = max(detail.start_date, billing_start_date) if detail.start_date else billing_start_date
        
        # Use detail's end_date or billing_end_date, whichever is earlier
        if detail.end_date:
            effective_end = min(detail.end_date, billing_end_date)
        else:
            effective_end = billing_end_date
        
        # Skip if effective_start is None or effective_start > effective_end (usage is outside billing period)
        if not effective_start or effective_start > effective_end:
            continue
        
        # Calculate days for this usage
        days = calculate_billing_period_days(effective_start, effective_end)
        
        if days <= 0:
            continue
        
        # Get percentage share (custom or default)
        percentage_share = detail.custom_mac_percentage_share
        if percentage_share is None:
            percentage_share = customer.default_percentage_share
        
        if percentage_share is None:
            # Log warning or raise error for missing percentage
            raise ValueError(
                f"No percentage share found for MAC customer {customer.customer_name} "
                f"(Detail ID: {detail.id}). Set default_percentage_share on customer "
                f"or custom_mac_percentage_share on entitlement detail."
            )
        
        # Calculate amount: days × mbps × unit_price × (percentage / 100)
        # IMPORTANT: Include ALL entitlement details, even if mbps=0 or unit_price=0
        # - Negative MBPS: Represents bandwidth reduction, results in negative amount (credit)
        # - Zero values: Must be shown in invoice for transparency
        if detail.mbps is not None and detail.unit_price is not None:
            base_amount = Decimal(str(days)) * detail.mbps * detail.unit_price
            amount = base_amount * (percentage_share / Decimal('100'))
            amount = amount.quantize(Decimal('0.01'))  # Round to 2 decimal places
            total_bill += amount
            
            # Extract package name from package_master
            package_name = 'Unknown'
            if detail.package_master_id:
                package_name = detail.package_master_id.package_name
            
            detail_breakdown.append({
                'detail_id': detail.id,
                'usage_ref': f"Usage-{detail.id}",
                'package_name': package_name,
                'start_date': effective_start,
                'end_date': effective_end,
                'days': days,
                'mbps': float(detail.mbps),
                'unit_price': float(detail.unit_price),
                'percentage_share': float(percentage_share),
                'base_amount': float(base_amount),
                'amount': float(amount),
                'remarks': detail.remarks or ''
            })
    
    # If billing_start_date is None, use the earliest detail's start_date for display purposes
    # (Each detail already uses its own start_date in the calculation)
    final_billing_start_date = billing_start_date
    if final_billing_start_date is None and detail_breakdown:
        # Find the earliest start_date from all details
        earliest_start = min(detail['start_date'] for detail in detail_breakdown if detail.get('start_date'))
        final_billing_start_date = earliest_start if earliest_start else None
    
    return {
        'total_bill': total_bill,
        'billing_start_date': final_billing_start_date,
        'billing_end_date': billing_end_date,
        'details': detail_breakdown,
        'customer_type': CustomerMaster.CUSTOMER_TYPE_MAC
    }


def calculate_soho_customer_bill(entitlement, target_date):
    """
    Calculate bill for SOHO/Home customers with PRORATED monthly pricing.

    SOHO customers have fixed monthly pricing based on their package.
    Bill is prorated based on actual usage days within the month.

    Formula: 
    - Full Month: Package Price (rate)
    - Partial Month: (usage_days / days_in_month) × Package Price

    Args:
        entitlement: CustomerEntitlementMaster instance
        target_date (date): Target invoice date (billing period end)

    Returns:
        dict: {
            'total_bill': Decimal,
            'billing_start_date': date,
            'billing_end_date': date,
            'details': List[dict] - breakdown by package with prorated amounts
        }
    """
    from apps.bills.models import CustomerEntitlementDetails

    customer = entitlement.customer_master_id

    # Get billing start date
    billing_start_date = get_billing_start_date(customer, entitlement)
    billing_end_date = target_date

    if isinstance(billing_end_date, str):
        billing_end_date = datetime.strptime(billing_end_date, '%Y-%m-%d').date()

    # Get all active entitlement details for this entitlement
    active_details = CustomerEntitlementDetails.objects.filter(
        cust_entitlement_id=entitlement,
        is_active=True,
        status='active',
        start_date__lte=billing_end_date
    ).select_related('package_pricing_id', 'package_pricing_id__package_master_id')
    
    # Get inactive entitlement details with unpaid invoices
    # These should be included in billing to collect outstanding amounts
    inactive_details = CustomerEntitlementDetails.objects.filter(
        cust_entitlement_id=entitlement,
        is_active=False,
        start_date__lte=billing_end_date
    ).select_related('package_pricing_id', 'package_pricing_id__package_master_id').prefetch_related('invoice_details__invoice_master_id')
    
    # Filter inactive details to only include those with unpaid invoices
    unpaid_inactive = []
    for detail in inactive_details:
        if has_unpaid_invoices_for_detail(detail):
            unpaid_inactive.append(detail)
    
    # Combine active and unpaid inactive details, sort by start_date
    all_details = list(active_details) + unpaid_inactive
    all_details.sort(key=lambda x: x.start_date)
    
    # Use combined list for calculations
    details = all_details

    total_bill = Decimal('0.00')
    detail_breakdown = []

    for detail in details:
        # Determine effective start and end dates for this detail within billing period
        # If billing_start_date is None (no last_bill_invoice_date), use detail's start_date directly
        # Otherwise, use the later of detail.start_date and billing_start_date
        if billing_start_date is None:
            # No last_bill_invoice_date: use each detail's start_date as billing start date
            effective_start = detail.start_date
        else:
            # Use the later of detail.start_date and billing_start_date
            effective_start = max(detail.start_date, billing_start_date) if detail.start_date else billing_start_date

        # Use detail's end_date or billing_end_date, whichever is earlier
        if detail.end_date:
            effective_end = min(detail.end_date, billing_end_date)
        else:
            effective_end = billing_end_date

        # Skip if effective_start is None or effective_start > effective_end (detail is outside billing period)
        if not effective_start or effective_start > effective_end:
            continue

        # For SOHO, calculate prorated bill based on actual usage days
        # Formula: (usage_days / days_in_month) × monthly_rate
        # IMPORTANT: Include ALL entitlement details, even if rate=0
        # - Zero rate: Must be shown in invoice for transparency
        if detail.package_pricing_id and detail.package_pricing_id.rate is not None:
            from calendar import monthrange
            
            # Calculate usage days in billing period (inclusive)
            usage_days = (effective_end - effective_start).days + 1
            
            # Get days in the month of billing end date
            _, days_in_month = monthrange(effective_end.year, effective_end.month)
            
            monthly_rate = detail.package_pricing_id.rate
            
            # Prorate the monthly rate based on actual usage days
            prorated_amount = (Decimal(usage_days) / Decimal(days_in_month)) * monthly_rate
            prorated_amount = prorated_amount.quantize(Decimal('0.01'))  # Round to 2 decimal places
            total_bill += prorated_amount
            
            package_name = (
                detail.package_pricing_id.package_master_id.package_name 
                if detail.package_pricing_id.package_master_id 
                else 'Unknown'
            )
            
            detail_breakdown.append({
                'detail_id': detail.id,
                'package_name': package_name,
                'package_rate': float(monthly_rate),
                'usage_days': usage_days,
                'days_in_month': days_in_month,
                'amount': float(prorated_amount),
                'billing_type': 'Prorated Monthly',
                'start_date': effective_start,
                'end_date': effective_end,
                'mbps': float(detail.mbps) if detail.mbps else (
                    float(detail.package_pricing_id.mbps) if detail.package_pricing_id.mbps else None
                ),
                'unit_price': float(monthly_rate),
                'days': usage_days,
                'remarks': detail.remarks or ''
            })

    # If billing_start_date is None, use the earliest detail's start_date for display purposes
    # (Each detail already uses its own start_date in the calculation)
    final_billing_start_date = billing_start_date
    if final_billing_start_date is None and detail_breakdown:
        # Find the earliest start_date from all details
        earliest_start = min(detail['start_date'] for detail in detail_breakdown if detail.get('start_date'))
        final_billing_start_date = earliest_start if earliest_start else None

    return {
        'total_bill': total_bill,
        'billing_start_date': final_billing_start_date,
        'billing_end_date': billing_end_date,
        'details': detail_breakdown,
        'customer_type': CustomerMaster.CUSTOMER_TYPE_SOHO
    }


def generate_invoice_for_entitlement(entitlement, target_date, force=False, vat_rate=None, discount_rate=None):
    """
    Main function to generate invoice for a given entitlement.
    
    This function:
    1. Determines customer type
    2. Calls appropriate billing calculation function
    3. Creates InvoiceMaster and InvoiceDetails records
    4. Updates last_bill_invoice_date
    
    Args:
        entitlement: CustomerEntitlementMaster instance
        target_date (date or str): Target invoice date
        force (bool): If True, regenerate even if invoice exists
        vat_rate (Decimal or float): Optional VAT rate override
        discount_rate (Decimal or float): Optional discount % applied to each line (e.g. 10 for 10%)
        
    Returns:
        dict: {
            'success': bool,
            'invoice': InvoiceMaster instance or None,
            'message': str,
            'calculation': dict (billing calculation result)
        }
    """
    from apps.bills.models import InvoiceMaster, InvoiceDetails
    
    customer = entitlement.customer_master_id
    customer_type = customer.customer_type
    
    # Convert target_date to date object if string
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
    
    # Get billing dates - allow past billing for corrections/adjustments
    billing_start_date = get_billing_start_date(customer, entitlement)
    billing_end_date = target_date

    # For past billing, adjust the start date to not go before activation
    # Only do this if billing_start_date is not None (i.e., last_bill_invoice_date exists)
    # When billing_start_date is None, each detail's start_date will be used directly
    if billing_start_date is not None and billing_start_date > target_date:
        # Allow billing back to activation date for corrections
        # Note: This is only for cases where last_bill_invoice_date exists
        if entitlement.activation_date:
            billing_start_date = max(entitlement.activation_date, target_date.replace(day=1))  # Start of month
            if billing_start_date > target_date:
                billing_start_date = entitlement.activation_date

    # Check for existing invoice (duplicate prevention)
    if not force:
        existing_invoice = InvoiceMaster.objects.filter(
            customer_entitlement_master_id=entitlement,
            issue_date=target_date
        ).first()

        if existing_invoice:
            return {
                'success': False,
                'invoice': existing_invoice,
                'message': f'Invoice already exists for this entitlement and date: {existing_invoice.invoice_number}',
                'calculation': None
            }
    
    # Calculate bill based on customer type
    if customer_type == CustomerMaster.CUSTOMER_TYPE_BW:
        calculation = calculate_bw_customer_bill(entitlement, target_date)
    elif customer_type == CustomerMaster.CUSTOMER_TYPE_SOHO:
        calculation = calculate_soho_customer_bill(entitlement, target_date)
    else:
        return {
            'success': False,
            'invoice': None,
            'message': f'Unknown customer type: {customer_type}',
            'calculation': None
        }
    
    # Create invoice with transaction
    try:
        with transaction.atomic():
            # Get utility information (for VAT, etc.)
            from apps.utility.models import UtilityInformationMaster
            utility = UtilityInformationMaster.objects.filter(is_active=True).first()
            
            # Determine VAT rate
            final_vat_rate = Decimal('0')
            if vat_rate is not None:
                final_vat_rate = Decimal(str(vat_rate))
            elif utility and utility.vat_rate:
                final_vat_rate = utility.vat_rate
            
            # Determine discount rate (applied per line)
            final_discount_rate = Decimal('0')
            if discount_rate is not None:
                final_discount_rate = Decimal(str(discount_rate))

            # Calculate VAT amount
            total_vat_amount = calculation['total_bill'] * (final_vat_rate / Decimal('100'))
            total_vat_amount = total_vat_amount.quantize(Decimal('0.01'))  # Round to 2 decimal places

            # Total discount (sum of per-line discounts)
            total_discount_amount = Decimal('0')
            for detail_data in calculation['details']:
                amt = Decimal(str(detail_data['amount']))
                total_discount_amount += amt * (final_discount_rate / Decimal('100'))
            total_discount_amount = total_discount_amount.quantize(Decimal('0.01'))

            # Calculate total bill amount (total_bill + VAT - discount)
            total_bill_amount = calculation['total_bill'] + total_vat_amount - total_discount_amount
            total_bill_amount = total_bill_amount.quantize(Decimal('0.01'))  # Round to 2 decimal places
            
            # Create InvoiceMaster with target_date as issue_date
            # Note: We pass skip_auto_calc=True to prevent calculate_totals() from overwriting
            # our correctly calculated values before InvoiceDetails are created
            invoice = InvoiceMaster(
                customer_entitlement_master_id=entitlement,
                customer_master_id=customer,
                issue_date=target_date,  # Use the target_date parameter
                activation_date=entitlement.activation_date,
                bill_number=entitlement.bill_number,
                nttn_company=entitlement.nttn_company,
                nttn_capacity=entitlement.nttn_capacity,
                type_of_bw=entitlement.type_of_bw,
                type_of_connection=entitlement.type_of_connection,
                connected_pop=entitlement.connected_pop,
                total_bill=calculation['total_bill'].quantize(Decimal('0.01')),  # Round total_bill to 2 decimal places
                total_bill_amount=total_bill_amount,  # total_bill + VAT - discount
                total_vat_amount=total_vat_amount,  # Calculated VAT
                total_discount_amount=total_discount_amount,  # Total discount
                total_balance_due=total_bill_amount,  # Initially, full amount is due
                information_master_id=utility,
                status='draft',
                additional_entitlements=[],  # Empty list for single entitlement invoices
                remarks=f"Auto-generated invoice for period {calculation['billing_start_date'] or 'N/A'} to {calculation['billing_end_date']}"
            )
            invoice.save(skip_auto_calc=True)
            
            # Create InvoiceDetails for each detail in calculation
            for detail_data in calculation['details']:
                # Get the corresponding entitlement detail
                from apps.bills.models import CustomerEntitlementDetails
                entitlement_detail = CustomerEntitlementDetails.objects.filter(
                    id=detail_data['detail_id']
                ).first()
                
                # Calculate VAT for this detail
                detail_sub_total = Decimal(str(detail_data['amount'])).quantize(Decimal('0.01'))  # Round to 2 decimal places
                detail_vat_amount = detail_sub_total * (final_vat_rate / Decimal('100'))
                detail_vat_amount = detail_vat_amount.quantize(Decimal('0.01'))  # Round to 2 decimal places

                InvoiceDetails.objects.create(
                    invoice_master_id=invoice,
                    entitlement_details_id=entitlement_detail,
                    sub_total=detail_sub_total,
                    vat_rate=final_vat_rate,  # Set VAT rate from utility or override
                    sub_discount_rate=final_discount_rate,  # Discount % for this line
                    start_date=detail_data.get('start_date'),
                    end_date=detail_data.get('end_date'),
                    type=customer_type,
                    package_pricing_id=entitlement_detail.package_pricing_id if entitlement_detail else None,
                    package_master_id=entitlement_detail.package_master_id if entitlement_detail else None,
                    mbps=entitlement_detail.mbps if entitlement_detail else None,
                    unit_price=entitlement_detail.unit_price if entitlement_detail else None,
                    remarks=detail_data.get('remarks', '')
                )
                
                # Mark old details as expired if they have an end_date
                # (This indicates they were superseded by a newer detail)
                if entitlement_detail and entitlement_detail.end_date and entitlement_detail.end_date < target_date:
                    entitlement_detail.status = 'expired'
                    entitlement_detail.is_active = False
                    entitlement_detail.save(update_fields=['status', 'is_active'])
            
            # Update last_bill_invoice_date (convert date to datetime at end of day)
            billing_datetime = timezone.make_aware(datetime.combine(target_date, datetime.max.time()))
            entitlement.last_bill_invoice_date = billing_datetime
            entitlement.save(update_fields=['last_bill_invoice_date'])

            customer.last_bill_invoice_date = billing_datetime
            customer.save(update_fields=['last_bill_invoice_date'])
            
            # Note: No need to call calculate_totals() here since we already set all values correctly above
            # Calling it causes unnecessary recalculation and potential recursion
            
            calc_out = dict(calculation)
            calc_out['total_discount_amount'] = float(total_discount_amount)
            calc_out['total_bill_amount'] = float(total_bill_amount)
            return {
                'success': True,
                'invoice': invoice,
                'message': f'Invoice {invoice.invoice_number} generated successfully',
                'calculation': calc_out
            }
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return {
            'success': False,
            'invoice': None,
            'message': f'Error generating invoice: {str(e)}',
            'error_details': error_details,
            'calculation': calculation
        }


def preview_invoice_for_multiple_entitlements(entitlement_ids, target_date, vat_rate=None, discount_rate=None):
    """
    Preview invoice calculation for multiple entitlements.
    
    Returns aggregated calculation data without creating database records.
    
    Args:
        entitlement_ids: List of entitlement IDs
        target_date: Target date for billing (YYYY-MM-DD string or date object)
        vat_rate: Optional VAT rate override
        discount_rate: Optional discount % applied to subtotal (e.g. 10 for 10%)
    
    Returns:
        dict: Preview data with aggregated calculations
    """
    from apps.bills.models import CustomerEntitlementMaster
    from apps.utility.models import UtilityInformationMaster
    from decimal import Decimal
    
    # Convert target_date to date if string
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
    
    entitlements = CustomerEntitlementMaster.objects.filter(id__in=entitlement_ids).select_related('customer_master_id')
    
    if entitlements.count() != len(entitlement_ids):
        return {
            'success': False,
            'error': 'One or more entitlements not found'
        }
    
    # Validate all entitlements belong to same customer
    # Get customer IDs directly from entitlements
    customer_ids_set = set()
    for ent in entitlements:
        if ent.customer_master_id:
            customer_ids_set.add(ent.customer_master_id.id)
        else:
            return {
                'success': False,
                'error': f'Entitlement {ent.id} has no customer assigned'
            }
    
    if len(customer_ids_set) == 0:
        return {
            'success': False,
            'error': 'One or more entitlements have no customer assigned'
        }
    
    if len(customer_ids_set) > 1:
        # Get customer names for better error message
        from apps.customers.models import CustomerMaster
        customer_names = CustomerMaster.objects.filter(id__in=customer_ids_set).values_list('customer_name', flat=True)
        return {
            'success': False,
            'error': f'All entitlements must belong to the same customer. Found customers: {", ".join(customer_names)} (IDs: {", ".join(map(str, customer_ids_set))})'
        }
    
    customer = entitlements.first().customer_master_id
    customer_type = customer.customer_type
    
    # Get VAT rate
    final_vat_rate = Decimal('0')
    if vat_rate is not None:
        final_vat_rate = Decimal(str(vat_rate))
    else:
        utility = UtilityInformationMaster.objects.filter(is_active=True).first()
        if utility and utility.vat_rate:
            final_vat_rate = utility.vat_rate
    
    final_discount_rate = Decimal('0')
    if discount_rate is not None:
        final_discount_rate = Decimal(str(discount_rate))
    
    # Calculate for each entitlement
    all_details = []
    total_bill = Decimal('0')
    earliest_start = None
    latest_end = None
    
    entitlement_calculations = []
    
    for entitlement in entitlements:
        # Use existing calculation functions
        if customer_type == 'bw':
            calc = calculate_bw_customer_bill(entitlement, target_date)
        elif customer_type == 'soho':
            calc = calculate_soho_customer_bill(entitlement, target_date)
        else:
            continue
        
        entitlement_calculations.append({
            'entitlement_id': entitlement.id,
            'bill_number': entitlement.bill_number,
            'zone_name': entitlement.zone_name,
            'calculation': calc
        })
        
        total_bill += calc['total_bill']
        all_details.extend(calc['details'])
        
        if calc['billing_start_date']:
            if earliest_start is None or calc['billing_start_date'] < earliest_start:
                earliest_start = calc['billing_start_date']
        
        if calc['billing_end_date']:
            if latest_end is None or calc['billing_end_date'] > latest_end:
                latest_end = calc['billing_end_date']
    
    total_vat_amount = total_bill * (final_vat_rate / Decimal('100'))
    total_discount_amount = total_bill * (final_discount_rate / Decimal('100'))
    total_bill_amount = total_bill + total_vat_amount - total_discount_amount
    
    return {
        'success': True,
        'customer': {
            'id': customer.id,
            'name': customer.customer_name,
            'type': customer_type
        },
        'entitlements': entitlement_calculations,
        'aggregated': {
            'billing_start_date': earliest_start,
            'billing_end_date': latest_end,
            'total_bill': float(total_bill),
            'vat_rate': float(final_vat_rate),
            'total_vat_amount': float(total_vat_amount),
            'discount_rate': float(final_discount_rate),
            'total_discount_amount': float(total_discount_amount),
            'total_bill_amount': float(total_bill_amount),
            'details_count': len(all_details),
            'details': all_details
        }
    }


def generate_invoice_for_multiple_entitlements(entitlement_ids, target_date, force=False, vat_rate=None, discount_rate=None, user=None):
    """
    Generate invoice for multiple entitlements.
    
    Returns created invoice with all entitlements linked via JSONField.
    
    Args:
        entitlement_ids: List of entitlement IDs
        target_date: Target date for billing (YYYY-MM-DD string or date object)
        force: If True, allow generating invoice even if one exists
        vat_rate: Optional VAT rate override
        discount_rate: Optional discount % applied to each line (e.g. 10 for 10%)
        user: User creating the invoice
    
    Returns:
        dict: Result with created invoice and calculation data
    """
    from apps.bills.models import (
        InvoiceMaster, InvoiceDetails,
        CustomerEntitlementMaster
    )
    from apps.utility.models import UtilityInformationMaster
    from django.db import transaction
    from decimal import Decimal
    import calendar
    
    # Convert target_date to date if string
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
    
    entitlements = CustomerEntitlementMaster.objects.filter(id__in=entitlement_ids).select_related('customer_master_id')
    
    if entitlements.count() != len(entitlement_ids):
        return {
            'success': False,
            'error': 'One or more entitlements not found'
        }
    
    # Validate all entitlements belong to same customer
    # Get customer IDs directly from entitlements
    customer_ids_set = set()
    for ent in entitlements:
        if ent.customer_master_id:
            customer_ids_set.add(ent.customer_master_id.id)
        else:
            return {
                'success': False,
                'error': f'Entitlement {ent.id} has no customer assigned'
            }
    
    if len(customer_ids_set) == 0:
        return {
            'success': False,
            'error': 'One or more entitlements have no customer assigned'
        }
    
    if len(customer_ids_set) > 1:
        # Get customer names for better error message
        from apps.customers.models import CustomerMaster
        customer_names = CustomerMaster.objects.filter(id__in=customer_ids_set).values_list('customer_name', flat=True)
        return {
            'success': False,
            'error': f'All entitlements must belong to the same customer. Found customers: {", ".join(customer_names)} (IDs: {", ".join(map(str, customer_ids_set))})'
        }
    
    # Check if invoices already exist (unless force=True)
    if not force:
        existing = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__in=entitlement_ids
        ).exists()
        if existing:
            return {
                'success': False,
                'error': 'One or more entitlements already have invoices. Use force=true to override.'
            }
    
    customer = entitlements.first().customer_master_id
    primary_entitlement = entitlements.first()
    
    # Get utility info
    utility = UtilityInformationMaster.objects.filter(is_active=True).first()
    final_vat_rate = Decimal('0')
    if vat_rate is not None:
        final_vat_rate = Decimal(str(vat_rate))
    elif utility and utility.vat_rate:
        final_vat_rate = utility.vat_rate
    
    final_discount_rate = Decimal('0')
    if discount_rate is not None:
        final_discount_rate = Decimal(str(discount_rate))
    
    with transaction.atomic():
        # Prepare additional entitlements data for JSONField
        additional_entitlements = []
        for idx, entitlement in enumerate(entitlements):
            if idx > 0:  # Skip first (primary) entitlement
                additional_entitlements.append({
                    'id': entitlement.id,
                    'bill_number': entitlement.bill_number,
                    'zone_name': entitlement.zone_name
                })
        
        # Create invoice with primary entitlement
        issue_date = target_date
        
        invoice = InvoiceMaster.objects.create(
            customer_entitlement_master_id=primary_entitlement,
            customer_master_id=customer,
            issue_date=issue_date,
            information_master_id=utility,
            status='draft',
            created_by=user,
            additional_entitlements=additional_entitlements  # Store additional entitlements in JSONField
        )
        
        # Calculate and create invoice details for all entitlements
        total_subtotal = Decimal('0')
        total_vat = Decimal('0')
        total_discount = Decimal('0')
        
        billing_start = date(issue_date.year, issue_date.month, 1)
        _, last_day = calendar.monthrange(issue_date.year, issue_date.month)
        billing_end = date(issue_date.year, issue_date.month, last_day)
        
        from django.db.models import Q
        
        # Process all entitlements (primary + additional)
        for entitlement in entitlements:
            customer_type = entitlement.customer_master_id.customer_type
            
            details = entitlement.details.filter(
                Q(start_date__lte=billing_end) & 
                (Q(end_date__gte=billing_start) | Q(end_date__isnull=True))
            )
            
            for ent_detail in details:
                line_subtotal = Decimal('0')
                
                if customer_type == 'bw':
                    if ent_detail.mbps and ent_detail.unit_price:
                        line_subtotal = calculate_pro_rated_amount(
                            ent_detail.mbps, 
                            ent_detail.unit_price, 
                            ent_detail.start_date, 
                            ent_detail.end_date, 
                            billing_start, 
                            billing_end
                        )
                elif customer_type == 'soho':
                    if ent_detail.package_pricing_id and ent_detail.package_pricing_id.rate:
                        line_subtotal = ent_detail.package_pricing_id.rate
                
                total_subtotal += line_subtotal
                vat_amount = line_subtotal * (final_vat_rate / Decimal('100'))
                total_vat += vat_amount
                line_discount = line_subtotal * (final_discount_rate / Decimal('100'))
                total_discount += line_discount
                
                # Determine effective start/end within billing period for response + storage
                effective_start = ent_detail.start_date or billing_start
                if effective_start < billing_start:
                    effective_start = billing_start
                if ent_detail.end_date:
                    effective_end = min(ent_detail.end_date, billing_end)
                else:
                    effective_end = billing_end
                if effective_start and effective_end and effective_start > effective_end:
                    continue

                InvoiceDetails.objects.create(
                    invoice_master_id=invoice,
                    entitlement_details_id=ent_detail,
                    sub_total=line_subtotal,
                    vat_rate=final_vat_rate,
                    sub_discount_rate=final_discount_rate,
                    start_date=effective_start,
                    end_date=effective_end,
                    type=ent_detail.type or customer_type,
                    package_pricing_id=ent_detail.package_pricing_id,
                    package_master_id=ent_detail.package_master_id,
                    mbps=ent_detail.mbps,
                    unit_price=ent_detail.unit_price,
                    last_changes_updated_date=ent_detail.last_changes_updated_date,
                    remarks=(
                        f'Invoice detail for {ent_detail.type} - Zone: {entitlement.zone_name or "N/A"} '
                        f'({effective_start} to {effective_end})'
                    )
                )
        
        # Update invoice totals (with discount)
        total_discount = total_discount.quantize(Decimal('0.01'))
        invoice.total_bill_amount = (total_subtotal + total_vat - total_discount).quantize(Decimal('0.01'))
        invoice.total_vat_amount = total_vat.quantize(Decimal('0.01'))
        invoice.total_discount_amount = total_discount
        invoice.total_balance_due = invoice.total_bill_amount - invoice.total_paid_amount
        invoice.save()
        
        # Update customer's last_bill_invoice_date
        billing_datetime = timezone.make_aware(datetime.combine(target_date, datetime.max.time()))
        customer.last_bill_invoice_date = billing_datetime
        customer.save(update_fields=['last_bill_invoice_date'])
        
        # Update all entitlements' last_bill_invoice_date
        for entitlement in entitlements:
            entitlement.last_bill_invoice_date = billing_datetime
            entitlement.save(update_fields=['last_bill_invoice_date'])
        
        return {
            'success': True,
            'message': f'Invoice {invoice.invoice_number} generated successfully',
            'invoice': invoice,
            'calculation': {
                'billing_start_date': billing_start,
                'billing_end_date': billing_end,
                'total_bill': float(total_subtotal),
                'total_vat': float(total_vat),
                'total_discount_amount': float(total_discount),
                'total_bill_amount': float(invoice.total_bill_amount),
                'entitlements_count': len(entitlement_ids)
            }
        }