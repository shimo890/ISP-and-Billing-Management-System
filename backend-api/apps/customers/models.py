from django.db import models
from django.core.validators import RegexValidator, MinValueValidator
from django.utils import timezone
from django.conf import settings
from apps.customers.utils import generate_customer_number
import re




class KAMMaster(models.Model):
    id = models.AutoField(primary_key=True)
    kam_name = models.CharField(max_length=200)
    designation = models.CharField(max_length=200, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'kam_master'

    def __str__(self):
        return self.kam_name


class CustomerMaster(models.Model):
    
    # Customer Types Constants
    CUSTOMER_TYPE_BW = 'bw'
    CUSTOMER_TYPE_SOHO = 'soho'
    CUSTOMER_TYPE_CHOICES = [
        (CUSTOMER_TYPE_BW, 'Bandwidth'),
        (CUSTOMER_TYPE_SOHO, 'SOHO/SMB'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
    ]

    id = models.AutoField(primary_key=True)
    customer_name = models.CharField(max_length=200)
    nid = models.CharField(max_length=100, blank=True, null=True)
    company_name = models.CharField(max_length=200, blank=True, null=True, help_text="Company reference ")
    email = models.EmailField( blank=True, null=True)
    phone = models.CharField(
            max_length=20,
            blank=True,
            validators=[RegexValidator(r'^\+?[0-9\-\s]{7,20}$', 'Invalid phone number')]
        )
    address = models.TextField(blank=True, null=True)
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPE_CHOICES)
    kam_id = models.ForeignKey(KAMMaster, on_delete=models.SET_NULL, null=True, blank=True, related_name='customers')
    customer_number = models.CharField(max_length=50, unique=True, null=True, blank=True, help_text="Auto-generated")
    contact_person = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    last_bill_invoice_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_customers', help_text="Auto-set to current user")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_customers', help_text="Auto-set to current user")

    class Meta:
        db_table = 'customer_master'

    def __str__(self):
        return self.customer_name
    
    def get_cumulative_balance(self):
        """
        Calculate total outstanding balance across all invoices for this customer.
        Uses the same formula as the ledger: sum(total_bill_amount - payments) per invoice.
        Includes both entitlement-linked and direct customer_master_id invoices.
        """
        from django.db.models import Sum, Q
        from decimal import Decimal
        
        from apps.bills.models import InvoiceMaster
        from apps.payment.models import PaymentDetails
        
        # Same invoice filter as ledger (entitlement OR direct customer)
        inv_list = list(
            InvoiceMaster.objects.filter(
                Q(customer_entitlement_master_id__customer_master_id=self)
                | Q(customer_master_id_id=self.pk)
            ).values('id', 'total_bill_amount')
        )
        
        if not inv_list:
            return Decimal('0.00')
        
        inv_ids = [i['id'] for i in inv_list]
        inv_totals = {i['id']: Decimal(str(i['total_bill_amount'] or 0)) for i in inv_list}
        
        pay_totals = (
            PaymentDetails.objects.filter(
                payment_master_id__invoice_master_id__in=inv_ids,
                status='completed'
            )
            .values('payment_master_id__invoice_master_id')
            .annotate(s=Sum('pay_amount'))
        )
        pay_by_inv = {r['payment_master_id__invoice_master_id']: Decimal(str(r['s'] or 0)) for r in pay_totals}
        
        total_due = Decimal('0.00')
        for inv_id, inv_amt in inv_totals.items():
            pay_amt = pay_by_inv.get(inv_id, Decimal('0'))
            total_due += (inv_amt - pay_amt).quantize(Decimal('0.01'))
        
        return total_due.quantize(Decimal('0.01'))
    
    def get_total_received(self):
        """
        Calculate total payments received from this customer.
        
        Returns:
            Decimal: Total amount received across all invoices
        """
        from django.db.models import Sum
        from decimal import Decimal
        
        from apps.bills.models import InvoiceMaster
        
        total = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=self
        ).aggregate(
            total_paid=Sum('total_paid_amount')
        )['total_paid']
        
        return total if total is not None else Decimal('0.00')

    def get_credit_balance(self):
        """
        Calculate customer credit / advance balance from CustomerCreditTransaction.
        Balance = sum of all credit transaction amounts (positive = credit added, negative = transferred out).
        """
        from django.db.models import Sum
        from decimal import Decimal
        total = CustomerCreditTransaction.objects.filter(customer_id=self).aggregate(
            total=Sum('amount')
        )['total']
        return total if total is not None else Decimal('0.00')

    def save(self, *args, **kwargs):
        # Get the current user from the request context if available
        request = kwargs.pop('request', None)
        if request and request.user.is_authenticated:
            # Set created_by on first creation
            if not self.pk:
                self.created_by = request.user
            # Always update updated_by
            self.updated_by = request.user
        
        # First save to get the pk if it's a new record
        super().save(*args, **kwargs)
        
        # Generate customer number after first save (so we have pk)
        if not self.customer_number and self.pk:
            self.customer_number = generate_customer_number(self.customer_name, self.pk)
            # Save only the customer_number field without force_insert/update_fields conflicts
            if self.customer_number:
                # Use regular save without update_fields to avoid conflicts
                super().save()


class CustomerCreditTransaction(models.Model):
    """
    Customer credit / excess balance (e.g. overpayment).
    Positive amount = credit added; negative = transferred out.
    Balance per customer = Sum(amount).
    """
    TRANSACTION_TYPE_OVERPAYMENT = 'overpayment'
    TRANSACTION_TYPE_TRANSFER_IN = 'transfer_in'
    TRANSACTION_TYPE_TRANSFER_OUT = 'transfer_out'
    TRANSACTION_TYPE_ADJUSTMENT = 'adjustment'
    TRANSACTION_TYPE_CHOICES = [
        (TRANSACTION_TYPE_OVERPAYMENT, 'Overpayment'),
        (TRANSACTION_TYPE_TRANSFER_IN, 'Transfer In'),
        (TRANSACTION_TYPE_TRANSFER_OUT, 'Transfer Out'),
        (TRANSACTION_TYPE_ADJUSTMENT, 'Adjustment'),
    ]
    REFERENCE_TYPE_PAYMENT = 'payment'
    REFERENCE_TYPE_FUND_TRANSFER = 'fund_transfer'
    REFERENCE_TYPE_MANUAL = 'manual'
    REFERENCE_TYPE_CHOICES = [
        (REFERENCE_TYPE_PAYMENT, 'Payment'),
        (REFERENCE_TYPE_FUND_TRANSFER, 'Fund Transfer'),
        (REFERENCE_TYPE_MANUAL, 'Manual'),
    ]

    id = models.AutoField(primary_key=True)
    customer_id = models.ForeignKey(
        CustomerMaster,
        on_delete=models.CASCADE,
        db_column='customer_id',
        related_name='credit_transactions'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text='Positive=credit added, negative=transferred out')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    reference_type = models.CharField(max_length=20, choices=REFERENCE_TYPE_CHOICES, null=True, blank=True)
    reference_id = models.PositiveIntegerField(null=True, blank=True, help_text='e.g. PaymentDetails id or CustomerFundTransfer id')
    invoice_id = models.ForeignKey(
        'bills.InvoiceMaster',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='invoice_id',
        related_name='credit_transactions'
    )
    entry_date = models.DateField()
    remarks = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='created_by',
        related_name='created_customer_credit_transactions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customer_credit_transaction'
        ordering = ['-entry_date', '-id']
        indexes = [
            models.Index(fields=['customer_id']),
            models.Index(fields=['entry_date']),
        ]

    def __str__(self):
        return f"Credit {self.amount} for {self.customer_id.customer_name} ({self.transaction_type})"







class Prospect(models.Model):
    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(
        max_length=20,
        blank=True,
        validators=[RegexValidator(r'^\+?[0-9\-\s]{7,20}$', 'Invalid phone number')]
    )
    address = models.TextField(blank=True)
    potential_revenue = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    contact_person = models.CharField(max_length=255, blank=True)
    source = models.CharField(max_length=50, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=50, default='', db_index=True, blank=True, help_text='Status managed by frontend (e.g., new, contacted, qualified, lost)')
    kam = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='prospects', help_text='Key Account Manager (KAM) assigned to this prospect')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_prospects'
        ordering = ['-created_at']

    def __str__(self):
        return self.name



class ProspectStatusHistory(models.Model):
    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name='status_history')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'sales_prospect_status_history'
        ordering = ['-changed_at']


class ProspectFollowUp(models.Model):
    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name='follow_ups')
    follow_up_date = models.DateField()
    notes = models.TextField(blank=True)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sales_prospect_followups'
        ordering = ['-follow_up_date']


class ProspectAttachment(models.Model):
    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to='prospect_attachments/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'sales_prospect_attachments'


