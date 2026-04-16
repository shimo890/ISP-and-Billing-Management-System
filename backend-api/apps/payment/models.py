from django.db import models
from django.conf import settings


class PaymentMaster(models.Model):
    """Payment Master - Main payment record"""
    
   

    id = models.AutoField(primary_key=True)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=50, help_text="e.g., Credit Card, Bank Transfer, Cash")
    customer_entitlement_master_id = models.ForeignKey(
        'bills.CustomerEntitlementMaster',
        on_delete=models.CASCADE,
        db_column='customer_entitlement_master_id',
        related_name='payments'
    )
    invoice_master_id = models.ForeignKey(
        'bills.InvoiceMaster',
        on_delete=models.CASCADE,
        db_column='invoice_master_id',
        related_name='payments'
    )
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20,  default='pending')
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='received_by',
        related_name='received_payments'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        db_column='created_by',
        related_name='created_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_master'
        ordering = ['-payment_date']

    def __str__(self):
        return f"Payment #{self.id} - {self.payment_date} - {self.payment_method}"


class PaymentDetails(models.Model):
    """Payment Details - Individual payment transactions"""
 

    id = models.AutoField(primary_key=True)
    payment_master_id = models.ForeignKey(
        PaymentMaster,
        on_delete=models.CASCADE,
        db_column='payment_master_id',
        related_name='details'
    )
    pay_amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_id = models.CharField(max_length=200, blank=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20,   default='pending')
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='received_by',
        related_name='received_payment_details'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        db_column='created_by',
        related_name='created_payment_details'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_details'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment Detail #{self.id} - {self.pay_amount}"


class CustomerFundTransfer(models.Model):
    """
    Customer-to-customer fund transfer (debit source, credit target).
    Source/target and amounts are in CustomerFundTransferLine (negative=debit, positive=credit).
    source_payment_master_id: optional link to the PaymentMaster whose overpayment credit
    is being transferred (for traceability when single source).
    """
    id = models.AutoField(primary_key=True)
    reference_number = models.CharField(max_length=50, unique=True, blank=True)
    transfer_date = models.DateField()
    remarks = models.TextField(blank=True)
    source_payment_master_id = models.ForeignKey(
        PaymentMaster,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='source_payment_master_id',
        related_name='fund_transfers_sourced_from',
        help_text='Payment whose overpayment credit is being transferred (single source only)'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        db_column='created_by',
        related_name='created_fund_transfers'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customer_fund_transfer'
        ordering = ['-transfer_date', '-id']

    def __str__(self):
        return f"{self.reference_number} - {self.transfer_date}"

    def save(self, *args, **kwargs):
        if not self.reference_number:
            # Generate after we have id; will set in post_save or use sequence
            super().save(*args, **kwargs)
            if not self.reference_number:
                self.reference_number = f"TRF-{self.id:05d}"
                CustomerFundTransfer.objects.filter(pk=self.pk).update(reference_number=self.reference_number)
        else:
            super().save(*args, **kwargs)


class CustomerFundTransferLine(models.Model):
    """
    One line per customer in a transfer. Amount negative = debit (source), positive = credit (target).
    Sum of lines must be zero for a valid transfer.
    """
    id = models.AutoField(primary_key=True)
    transfer_id = models.ForeignKey(
        CustomerFundTransfer,
        on_delete=models.CASCADE,
        db_column='transfer_id',
        related_name='lines'
    )
    customer_id = models.ForeignKey(
        'customers.CustomerMaster',
        on_delete=models.CASCADE,
        db_column='customer_id',
        related_name='fund_transfer_lines'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Negative=debit (source), Positive=credit (target)'
    )

    class Meta:
        db_table = 'customer_fund_transfer_line'
        ordering = ['transfer_id', 'amount']

    def __str__(self):
        return f"Transfer {self.transfer_id_id} - {self.customer_id.customer_name}: {self.amount}"

