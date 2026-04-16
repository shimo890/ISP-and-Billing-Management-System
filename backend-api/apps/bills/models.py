from django.db import models
from django.db.models import Sum, DecimalField
from django.conf import settings
from datetime import date, timedelta
from decimal import Decimal
from apps.customers.models import CustomerMaster
from apps.bills.utils import generate_bill_number


class CustomerEntitlementMaster(models.Model):
    """Customer Entitlement Master - Main billing record for a customer"""
    id = models.AutoField(primary_key=True)
    customer_master_id = models.ForeignKey(
        CustomerMaster, 
        on_delete=models.CASCADE, 
        db_column='customer_master_id',
        related_name='entitlements'
    )
    bill_number = models.CharField(max_length=100, unique=True, blank=True, null=True)
    activation_date = models.DateField(null=True, blank=True)
    nttn_company = models.CharField(max_length=200, blank=True, null=True)
    nttn_capacity = models.CharField(max_length=100, blank=True, null=True)
    link_id = models.CharField(max_length=100, blank=True, null=True)
    nttn_uses = models.CharField(max_length=100, blank=True, null=True)
    total_bill = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    type_of_bw = models.CharField(max_length=50, blank=True, null=True, help_text="Home only")
    type_of_connection = models.CharField(max_length=50, blank=True, null=True, help_text="Home only")
    connected_pop = models.CharField(max_length=100, blank=True, null=True, help_text="Home only")
    last_bill_invoice_date = models.DateTimeField(null=True, blank=True)
    zone_name = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='Zone name for zone-based customer identification'
    )

    remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_entitlements'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_entitlements'
    )

    class Meta:
        db_table = 'customer_entitlement_master'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.bill_number} - {self.customer_master_id.customer_name}"
    

    def save(self, *args, **kwargs):
        # Generate bill_number only if not set and we have a pk (after first save)
        if not self.bill_number and self.pk:
            self.bill_number = generate_bill_number(self.customer_master_id.customer_name, self.pk)
        super().save(*args, **kwargs)
        # If still no bill_number after save (new instance), generate it now that we have pk
        if not self.bill_number:
            self.bill_number = generate_bill_number(self.customer_master_id.customer_name, self.pk)
            # Use update to avoid recursion
            CustomerEntitlementMaster.objects.filter(pk=self.pk).update(bill_number=self.bill_number)

    def calculate_total_bill(self):
        """
        Auto-calculate total bill based on active entitlement details.

        Logic:
        Calculate total bill from activation_date to today for all active details.
        This gives the total outstanding amount from all entitlements.
        Uses proper daily rate calculation for BW customers (same as invoice generation).
        """
        from apps.bills.utils import calculate_billing_period_days
        from calendar import monthrange

        total = Decimal('0')
        billing_end_date = date.today()

        # Use activation_date as start, or return if not set
        if not self.activation_date:
            return

        billing_start_date = self.activation_date

        # If activation_date is in future, total is 0
        if billing_start_date > billing_end_date:
            final_total = Decimal('0')
        else:
            # Get all active details
            details = self.details.filter(is_active=True, status='active')

            for detail in details:
                # 1. Determine effective detail end date (for open-ended details)
                # If detail has no end date, it continues indefinitely (effectively up to billing_end_date for this calc)
                detail_end = detail.end_date if detail.end_date else billing_end_date

                # 2. Calculate Intersection of [Billing Start, Billing End] And [Detail Start, Detail End]
                # Intersection Start = Max(BillingStart, DetailStart)
                # Intersection End   = Min(BillingEnd, DetailEnd)

                intersection_start = max(billing_start_date, detail.start_date)
                intersection_end = min(billing_end_date, detail_end)

                # 3. Calculate days
                # If Intersection Start > Intersection End, there is no overlap
                if intersection_start > intersection_end:
                    continue

                days = (intersection_end - intersection_start).days + 1

                if days <= 0:
                    continue

                # Check customer type from the master record
                customer_type = self.customer_master_id.customer_type

                if customer_type == CustomerMaster.CUSTOMER_TYPE_BW:
                    # Use per-month daily rate to avoid errors across month boundaries
                    if detail.mbps is not None and detail.unit_price is not None:
                        current = intersection_start
                        while current <= intersection_end:
                            month_end = date(
                                current.year,
                                current.month,
                                monthrange(current.year, current.month)[1]
                            )
                            period_end = min(intersection_end, month_end)
                            days_in_month = monthrange(current.year, current.month)[1]
                            days_in_period = (period_end - current).days + 1
                            monthly_bill = detail.mbps * detail.unit_price
                            daily_rate = monthly_bill / Decimal(str(days_in_month))
                            total += daily_rate * Decimal(str(days_in_period))
                            current = period_end + timedelta(days=1)

                elif customer_type == CustomerMaster.CUSTOMER_TYPE_SOHO:
                    # For SOHO, use package pricing rate (Monthly wise - flat rate)
                    if detail.package_pricing_id and detail.package_pricing_id.rate:
                        # Calculate number of calendar months touched by the intersection
                        # This ensures if the period spans multiple months (e.g. Nov and Dec), we charge for both.
                        months_count = (intersection_end.year - intersection_start.year) * 12 + \
                                       (intersection_end.month - intersection_start.month) + 1

                        if months_count > 0:
                            total += detail.package_pricing_id.rate * Decimal(months_count)
                else:
                    # Fallback
                    if detail.mbps and detail.unit_price:
                        total += detail.mbps * detail.unit_price * Decimal(str(days))
                    elif detail.package_pricing_id and detail.package_pricing_id.rate:
                        total += detail.package_pricing_id.rate

        # Subtract total payments made against all invoices for this entitlement
        total_paid = sum((invoice.total_paid_amount or Decimal('0')) for invoice in self.invoices.all())
        # Include invoices where this entitlement appears in additional_entitlements
        extra_total_paid = Decimal('0')
        try:
            extra_total_paid = InvoiceMaster.objects.filter(
                additional_entitlements__contains=[{'id': self.id}]
            ).aggregate(
                total=Sum('total_paid_amount', output_field=DecimalField())
            )['total'] or Decimal('0')
        except Exception:
            extra_invoices = InvoiceMaster.objects.exclude(
                additional_entitlements__isnull=True
            ).values('additional_entitlements', 'total_paid_amount')
            for inv in extra_invoices:
                ent_list = inv.get('additional_entitlements') or []
                if any(isinstance(ent, dict) and ent.get('id') == self.id for ent in ent_list):
                    extra_total_paid += inv.get('total_paid_amount') or Decimal('0')

        total_paid += extra_total_paid

        # Final total_bill = calculated amount - total paid
        final_total = max(Decimal('0'), total - total_paid)

        # Round to 2 decimal places as requested
        final_total = final_total.quantize(Decimal('0.01'))

        # Use QuerySet.update() to avoid triggering save signals and recursion
        CustomerEntitlementMaster.objects.filter(pk=self.pk).update(total_bill=final_total)
        self.total_bill = final_total  # Update the instance attribute


class CustomerEntitlementDetails(models.Model):
    """Customer Entitlement Details - Detailed entitlement information"""
    TYPE_CHOICES = [
        (CustomerMaster.CUSTOMER_TYPE_BW, 'Bandwidth'),
        (CustomerMaster.CUSTOMER_TYPE_SOHO, 'SOHO/Home'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('expired', 'Expired'),
    ]

    id = models.AutoField(primary_key=True)
    cust_entitlement_id = models.ForeignKey(
        CustomerEntitlementMaster,
        on_delete=models.CASCADE,
        db_column='cust_entitlement_id',
        related_name='details'
    )
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    package_pricing_id = models.ForeignKey(
        'package.PackagePricing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='package_pricing_id',
        related_name='entitlement_details'
    )
    package_master_id = models.ForeignKey(
        'package.PackageMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='package_master_id',
        related_name='entitlement_details'
    )
    mbps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Only BW")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Only BW - bandwidth prices (ipt,gcc,cdn,nix,baishan) stored here")
    last_changes_updated_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True, null=True, help_text="Additional remarks or notes (e.g., bandwidth type for BW customers)")
    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_entitlement_details')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_entitlement_details')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_entitlement_details'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.cust_entitlement_id.bill_number} - {self.type} ({self.start_date} to {self.end_date})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalculate parent total bill
        self.cust_entitlement_id.calculate_total_bill()

    def delete(self, *args, **kwargs):
        parent = self.cust_entitlement_id
        super().delete(*args, **kwargs)
        # Recalculate parent total bill
        parent.calculate_total_bill()




class InvoiceMaster(models.Model):
    """Invoice Master - 1:1 relationship with Customer Entitlement Master"""
 

    id = models.AutoField(primary_key=True)
    invoice_number = models.CharField(max_length=100, unique=True, blank=True, null=True)
    customer_entitlement_master_id = models.ForeignKey(
        CustomerEntitlementMaster,
        on_delete=models.CASCADE,
        db_column='customer_entitlement_master_id',
        related_name='invoices'
    )
    
    issue_date = models.DateField()
    total_bill_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Auto calculated")
    total_paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Auto calculated")
    total_balance_due = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Auto calculated")
    total_vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Auto calculated")
    total_discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Auto calculated")
    remarks = models.TextField(blank=True)
    information_master_id = models.ForeignKey(
        'utility.UtilityInformationMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='information_master_id',
        related_name='invoices'
    )
    status = models.CharField(max_length=20, blank=True, null=True, default='draft')
    customer_master_id = models.ForeignKey(
        CustomerMaster,
        on_delete=models.CASCADE,
        db_column='customer_master_id',
        related_name='invoices',
        null=True,
        blank=True
    )
    bill_number = models.CharField(max_length=100, blank=True, null=True)
    activation_date = models.DateField(null=True, blank=True)
    nttn_company = models.CharField(max_length=200, blank=True, null=True)
    nttn_capacity = models.CharField(max_length=100, blank=True, null=True)
    total_bill = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    type_of_bw = models.CharField(max_length=50, blank=True, null=True, help_text="Home only")
    type_of_connection = models.CharField(max_length=50, blank=True, null=True, help_text="Home only")
    connected_pop = models.CharField(max_length=100, blank=True, null=True, help_text="Home only")
    additional_entitlements = models.JSONField(
        default=list,
        null=True,
        blank=True,
        help_text='JSON array storing additional entitlement IDs and metadata for multi-entitlement invoices. Format: [{"id": 2, "bill_number": "BILL-00002", "zone_name": "Zone B"}, ...]'
    )

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_invoices')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_invoices')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Check if we should skip auto-calculation (for programmatic invoice generation)
        skip_auto_calc = kwargs.pop('skip_auto_calc', False)
        created = self.pk is None
        
        # Generate invoice_number only if not set and we have a pk (after first save)
        if not self.invoice_number and self.pk:
            self.invoice_number = generate_bill_number(
                self.customer_entitlement_master_id.customer_master_id.customer_name,
                self.pk,
                prefix='INV'
            )
        super().save(*args, **kwargs)
        # If still no invoice_number after save (new instance), generate it now that we have pk
        if not self.invoice_number:
            self.invoice_number = generate_bill_number(
                self.customer_entitlement_master_id.customer_master_id.customer_name,
                self.pk,
                prefix='INV'
            )
            # Use update to avoid recursion
            InvoiceMaster.objects.filter(pk=self.pk).update(invoice_number=self.invoice_number)

        # Update customer's last bill invoice date if this is a new invoice
        if created:
            customer = self.customer_entitlement_master_id.customer_master_id
            customer.last_bill_invoice_date = self.issue_date
            customer.save(update_fields=['last_bill_invoice_date'])

        # Calculate totals after save (skip if explicitly requested)
        if not skip_auto_calc:
            self.calculate_totals()

    def calculate_totals(self):
        """
        Calculate all total fields automatically using per-line VAT and discount.

        Delegates to centralized recalculation service for consistency with
        view-level recalculation. Uses per-line vat_rate and sub_discount_rate
        from InvoiceDetails.
        """
        from apps.bills.recalculation_service import recalculate_invoice_totals
        recalculate_invoice_totals(self)

    class Meta:
        db_table = 'invoice_master'
        ordering = ['-created_at']

    def update_payment_status(self):
        """
        Update invoice payment status and amounts based on all associated payments.
        Uses the same logic as the ledger report: sum only PaymentDetails with
        status='completed' so invoice total_due stays in sync with ledger total_due.
        """
        from django.db.models import Sum
        from apps.payment.models import PaymentDetails

        # Sum only completed payment details (matches ledger_report logic)
        total_paid_raw = PaymentDetails.objects.filter(
            payment_master_id__invoice_master_id=self,
            status='completed'
        ).aggregate(total=Sum('pay_amount'))['total'] or Decimal('0')
        # Cap at total_bill_amount so overpayment becomes customer credit, not negative balance
        total_bill = self.total_bill_amount or Decimal('0')
        total_paid = min(total_paid_raw, total_bill)

        self.total_paid_amount = total_paid.quantize(Decimal('0.01'))  # Round to 2 decimal places
        self.total_balance_due = total_bill - total_paid
        self.total_balance_due = self.total_balance_due.quantize(Decimal('0.01'))  # Round to 2 decimal places
        
        # Update status logic
        if self.total_balance_due <= 0 and self.total_bill_amount > 0:
            self.status = 'paid'
        elif self.total_balance_due == 0 and self.total_bill_amount == 0:
            # Handle 0 value invoices (e.g. 100% discount or free period)
            self.status = 'paid'
        elif total_paid > 0:
            self.status = 'partial'
        else:
            self.status = 'unpaid'
        
        self.save(update_fields=[
            'total_paid_amount', 'total_balance_due', 'status'
        ])
        
        # Update parent entitlement's total bill
        if self.customer_entitlement_master_id:
            self.customer_entitlement_master_id.calculate_total_bill()

    def get_all_entitlement_ids(self):
        """Get all entitlement IDs including primary and additional"""
        ids = [self.customer_entitlement_master_id.id] if self.customer_entitlement_master_id else []
        if self.additional_entitlements:
            ids.extend([ent.get('id') for ent in self.additional_entitlements if ent.get('id')])
        return ids
    
    def get_all_entitlements_data(self):
        """Get all entitlements data including primary"""
        entitlements = []
        
        # Add primary entitlement
        if self.customer_entitlement_master_id:
            entitlements.append({
                'id': self.customer_entitlement_master_id.id,
                'bill_number': self.customer_entitlement_master_id.bill_number,
                'zone_name': self.customer_entitlement_master_id.zone_name,
                'is_primary': True
            })
        
        # Add additional entitlements
        if self.additional_entitlements:
            entitlements.extend(self.additional_entitlements)
        
        return entitlements

    def __str__(self):
        return f"{self.invoice_number} - {self.customer_entitlement_master_id.customer_master_id.customer_name}"


class InvoiceDetails(models.Model):
    """Invoice Details - Line items for an invoice"""

    TYPE_CHOICES = [
        (CustomerMaster.CUSTOMER_TYPE_BW, 'Bandwidth'),
        (CustomerMaster.CUSTOMER_TYPE_SOHO, 'SOHO/Home'),
    ]

    id = models.AutoField(primary_key=True)
    invoice_master_id = models.ForeignKey(
        InvoiceMaster,
        on_delete=models.CASCADE,
        db_column='invoice_master_id',
        related_name='details'
    )
    entitlement_details_id = models.ForeignKey(
        CustomerEntitlementDetails,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='entitlement_details_id',
        related_name='invoice_details'
    )
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sub_discount_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=CustomerMaster.CUSTOMER_TYPE_BW)
    package_pricing_id = models.ForeignKey(
        'package.PackagePricing',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='package_pricing_id',
        related_name='invoice_details'
    )
    package_master_id = models.ForeignKey(
        'package.PackageMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='package_master_id',
        related_name='invoice_details'
    )
    mbps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Only BW")
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text="Only BW - bandwidth prices (ipt,gcc,cdn,nix,baishan) stored here")
    last_changes_updated_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True)
    class Meta:
        db_table = 'invoice_details'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.invoice_master_id.invoice_number} - Detail #{self.id}"


class InvoiceEmailSchedule(models.Model):
    """
    Schedule for automatically generating and emailing Service Name Invoice PDFs.
    Uses cron expression for timing. A system cron runs the management command
    every minute to check and execute due schedules.
    """
    SCHEDULE_TYPE_DAILY = 'daily'
    SCHEDULE_TYPE_WEEKLY = 'weekly'
    SCHEDULE_TYPE_MONTHLY = 'monthly'
    SCHEDULE_TYPE_CRON = 'cron'
    SCHEDULE_TYPE_CHOICES = [
        (SCHEDULE_TYPE_DAILY, 'Daily'),
        (SCHEDULE_TYPE_WEEKLY, 'Weekly'),
        (SCHEDULE_TYPE_MONTHLY, 'Monthly'),
        (SCHEDULE_TYPE_CRON, 'Custom Cron'),
    ]
    STATUS_FILTER_ALL = 'all'
    STATUS_FILTER_UNPAID = 'unpaid'
    STATUS_FILTER_PARTIAL = 'partial'
    STATUS_FILTER_CHOICES = [
        (STATUS_FILTER_ALL, 'All invoices'),
        (STATUS_FILTER_UNPAID, 'Unpaid only'),
        (STATUS_FILTER_PARTIAL, 'Unpaid and partial'),
    ]

    name = models.CharField(max_length=255, help_text='Display name for this schedule')
    enabled = models.BooleanField(default=True)

    # Schedule timing
    schedule_type = models.CharField(
        max_length=20,
        choices=SCHEDULE_TYPE_CHOICES,
        default=SCHEDULE_TYPE_DAILY,
    )
    run_at_hour = models.PositiveSmallIntegerField(default=9, help_text='Hour (0-23)')
    run_at_minute = models.PositiveSmallIntegerField(default=0, help_text='Minute (0-59)')
    weekly_day = models.PositiveSmallIntegerField(
        default=0,
        null=True,
        blank=True,
        help_text='Day of week for weekly: 0=Monday, 6=Sunday',
    )
    monthly_day = models.PositiveSmallIntegerField(
        default=1,
        null=True,
        blank=True,
        help_text='Day of month for monthly (1-31)',
    )
    cron_expression = models.CharField(
        max_length=100,
        blank=True,
        help_text='Custom cron: min hour day month dow (e.g. "0 9 * * *" for 9am daily)',
    )

    # Invoice selection
    target_customer = models.ForeignKey(
        CustomerMaster,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='invoice_email_schedules',
        help_text='If set, send only this customer\'s invoices. If null, send for all customers.',
    )
    generate_invoices_before_send = models.BooleanField(
        default=True,
        help_text='Run invoice generation for target date before sending',
    )
    invoice_status_filter = models.CharField(
        max_length=20,
        choices=STATUS_FILTER_CHOICES,
        default=STATUS_FILTER_UNPAID,
    )
    days_lookback = models.PositiveIntegerField(
        default=7,
        help_text='Only send invoices from the last N days',
    )

    last_run_at = models.DateTimeField(null=True, blank=True)
    next_run_at = models.DateTimeField(null=True, blank=True)  # Computed on save; updated after each run
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='invoice_email_schedules',
    )

    class Meta:
        db_table = 'invoice_email_schedule'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({'enabled' if self.enabled else 'disabled'})"

