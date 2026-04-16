"""
Serializers for Payment App
"""
from rest_framework import serializers
from django.db import models
from django.db.models import Sum
from decimal import Decimal
from .models import PaymentMaster, PaymentDetails, CustomerFundTransfer, CustomerFundTransferLine
from apps.bills.serializers import InvoiceMasterSerializer


__all__ = [
    'PaymentMasterSerializer',
    'PaymentDetailsSerializer',
    'PaymentDetailsCreateSerializer',
    'PaymentCreateSerializer',
    'BulkPaymentSerializer',
    'FundTransferSerializer',
    'FundTransferCreateSerializer',
]


class PaymentDetailsSerializer(serializers.ModelSerializer):
    payment_method = serializers.SerializerMethodField()
    payment_date = serializers.SerializerMethodField()
    
    class Meta:
        model = PaymentDetails
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_payment_method(self, obj):
        """Get payment method safely"""
        if obj.payment_master_id:
            return obj.payment_master_id.payment_method
        return None
    
    def get_payment_date(self, obj):
        """Get payment date safely"""
        if obj.payment_master_id and obj.payment_master_id.payment_date:
            return obj.payment_master_id.payment_date
        return None


class PaymentMasterSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    customer_id = serializers.SerializerMethodField()
    invoice_id = serializers.IntegerField(
        source='invoice_master_id.id',
        read_only=True
    )
    invoice_number = serializers.CharField(
        source='invoice_master_id.invoice_number',
        read_only=True
    )
    invoice_amount = serializers.DecimalField(
        source='invoice_master_id.total_bill_amount',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    invoice_balance = serializers.SerializerMethodField()
    invoice_master_id_details = serializers.SerializerMethodField()
    details = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    details_count = serializers.SerializerMethodField()

    class Meta:
        model = PaymentMaster
        fields = [
            'id', 'payment_date', 'payment_method', 'remarks',
            'status',
            'received_by', 'created_by', 'created_at', 'updated_at',
            'customer_name', 'customer_id', 'invoice_id', 'invoice_number', 'invoice_amount',
            'invoice_balance', 'invoice_master_id_details', 'details', 'total_paid', 'details_count'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_total_paid(self, obj):
        """Calculate total paid from all payment details"""
        total = obj.details.aggregate(total=Sum('pay_amount'))['total']
        return float(total) if total else 0.0
    
    def get_details_count(self, obj):
        return obj.details.count()

    def get_customer_name(self, obj):
        """Get customer name from related entitlement"""
        if obj.customer_entitlement_master_id and obj.customer_entitlement_master_id.customer_master_id:
            return obj.customer_entitlement_master_id.customer_master_id.customer_name
        return None

    def get_customer_id(self, obj):
        """Get customer ID from related entitlement"""
        if obj.customer_entitlement_master_id and obj.customer_entitlement_master_id.customer_master_id:
            return obj.customer_entitlement_master_id.customer_master_id.id
        return None

    def get_invoice_balance(self, obj):
        """
        Compute invoice balance same as ledger: total_bill_amount - sum(completed PaymentDetails).
        Ensures payment edit page and reload always show correct value, matching ledger.
        """
        if not obj.invoice_master_id:
            return Decimal('0.00')
        inv = obj.invoice_master_id
        total_bill = Decimal(str(inv.total_bill_amount or 0))
        total_paid_raw = PaymentDetails.objects.filter(
            payment_master_id__invoice_master_id=inv,
            status='completed'
        ).aggregate(total=Sum('pay_amount'))['total'] or Decimal('0')
        total_paid = min(Decimal(str(total_paid_raw)), total_bill).quantize(Decimal('0.01'))
        balance = (total_bill - total_paid).quantize(Decimal('0.01'))
        return float(balance)
    
    def get_invoice_master_id_details(self, obj):
        """Get invoice details safely; total_balance_due computed like ledger for consistency."""
        if obj.invoice_master_id:
            invoice = obj.invoice_master_id
            total_bill = Decimal(str(invoice.total_bill_amount or 0))
            total_paid_raw = PaymentDetails.objects.filter(
                payment_master_id__invoice_master_id=invoice,
                status='completed'
            ).aggregate(total=Sum('pay_amount'))['total'] or Decimal('0')
            total_paid = min(Decimal(str(total_paid_raw)), total_bill).quantize(Decimal('0.01'))
            total_balance_due = (total_bill - total_paid).quantize(Decimal('0.01'))
            return {
                'id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'total_bill_amount': float(invoice.total_bill_amount or 0),
                'total_balance_due': float(total_balance_due),
                'status': invoice.status,
                'issue_date': invoice.issue_date.isoformat() if invoice.issue_date else None
            }
        return None
    
    def get_details(self, obj):
        """Get payment details safely"""
        if hasattr(obj, 'details') and obj.details.exists():
            return [
                {
                    'id': detail.id,
                    'pay_amount': float(detail.pay_amount or 0),
                    'transaction_id': detail.transaction_id,
                    'status': detail.status,
                    'remarks': detail.remarks,
                    'created_at': detail.created_at.isoformat() if detail.created_at else None
                }
                for detail in obj.details.all()
            ]
        return []
    
    def validate(self, data):
        """Validate payment data"""
        if 'invoice_master_id' in data and 'customer_entitlement_master_id' in data:
            invoice = data['invoice_master_id']
            entitlement = data['customer_entitlement_master_id']
            
            # Verify invoice belongs to entitlement
            if invoice.customer_entitlement_master_id != entitlement:
                raise serializers.ValidationError(
                    "Invoice does not belong to the specified entitlement"
                )
        
        # Validate overpayment prevention
        # Note: Actual payment amount comes from PaymentDetails, so we check in PaymentDetailsCreateSerializer
        
        return data
    
    def create(self, validated_data):
        payment = PaymentMaster.objects.create(**validated_data)
        # Update invoice paid amount
        self._update_invoice_payment(payment)
        return payment
    
    def update(self, instance, validated_data):
        payment = super().update(instance, validated_data)
        # Update invoice paid amount
        self._update_invoice_payment(payment)
        return payment
    
    def _update_invoice_payment(self, payment):
        """Update invoice paid amount and status"""
        # Centralized logic in InvoiceMaster model
        payment.invoice_master_id.update_payment_status()


class PaymentDetailsCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating payment details. Allows overpayment; excess is stored as customer credit."""

    class Meta:
        model = PaymentDetails
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, data):
        """Allow overpayment; no longer reject pay_amount > balance_due."""
        return data

    def create(self, validated_data):
        from apps.customers.models import CustomerCreditTransaction
        from apps.payment.models import PaymentMaster

        payment_master = validated_data['payment_master_id']
        pay_amount = validated_data['pay_amount']
        invoice = payment_master.invoice_master_id
        balance_due_before = invoice.total_balance_due

        detail = PaymentDetails.objects.create(**validated_data)
        payment = detail.payment_master_id
        invoice.refresh_from_db()
        invoice.update_payment_status()

        # If this payment caused overpayment, create customer credit for the excess
        excess = max(Decimal('0'), pay_amount - balance_due_before)
        if excess > 0:
            customer = invoice.customer_entitlement_master_id.customer_master_id
            user = self.context.get('request').user if self.context.get('request') else None
            CustomerCreditTransaction.objects.create(
                customer_id=customer,
                amount=excess,
                transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
                reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                reference_id=payment.id,
                invoice_id=invoice,
                entry_date=payment.payment_date,
                remarks=f"Overpayment on invoice {invoice.invoice_number}",
                created_by=user,
            )
        return detail


class PaymentCreateSerializer(serializers.Serializer):
    """
    Enhanced Serializer for creating payment with support for:
    - Single or multiple invoices
    - Same entitlement or cross-entitlement (different entitlements, same customer)
    - Partial payments with due balance tracking
    - Transaction ID idempotency
    
    Creates PaymentMaster first, then PaymentDetails records.
    """
    payment_date = serializers.DateField()
    payment_method = serializers.CharField(max_length=50, help_text="e.g., Credit Card, Bank Transfer, Cash")
    customer_entitlement_master_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Customer Entitlement Master ID (optional if multiple invoices from different entitlements)"
    )
    pay_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'), help_text="Total received amount")
    adjustment_transfer_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal('0'),
        required=False, default=Decimal('0'),
        help_text="Optional: portion to transfer to customer's credit balance (deposit). Invoice payment = pay_amount - this."
    )
    transaction_id = serializers.CharField(
        max_length=200, required=False, allow_blank=True,
        help_text="Transaction ID for idempotency (optional when payment_method is Credit Balance)"
    )
    remarks = serializers.CharField(required=False, allow_blank=True)
    
    # Support both single invoice_master_id and multiple invoice_master_ids
    invoice_master_id = serializers.IntegerField(required=False, help_text="Single invoice ID")
    invoice_master_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Multiple invoice IDs (can be from different entitlements, but must be same customer)"
    )
    
    def to_representation(self, instance):
        """Serialize the PaymentMaster object using PaymentMasterSerializer"""
        try:
            if hasattr(instance, '_payment_summary'):
                # Handle multiple payments case
                serializer = PaymentMasterSerializer(instance)
                data = serializer.data
                data['_payment_summary'] = instance._payment_summary
                return data
            else:
                # Handle single payment case
                serializer = PaymentMasterSerializer(instance)
                return serializer.data
        except Exception as e:
            # Fallback serialization in case of issues
            # Get payment details safely
            payment_details = None
            try:
                # Try to get the first payment detail
                if hasattr(instance, 'details') and instance.details.exists():
                    payment_details = instance.details.first()
                elif hasattr(instance, 'details'):
                    payment_details = instance.details
            except:
                pass
            
            # Build safe response data
            response_data = {
                'id': instance.id,
                'payment_date': instance.payment_date.isoformat() if instance.payment_date else None,
                'payment_method': instance.payment_method,
                'pay_amount': 0.0,
                'transaction_id': '',
                'remarks': instance.remarks,
                'status': instance.status,
                'created_at': instance.created_at.isoformat() if instance.created_at else None,
                'message': 'Payment created successfully'
            }
            
            # Add payment details if available
            if payment_details:
                try:
                    response_data['pay_amount'] = float(payment_details.pay_amount) if payment_details.pay_amount else 0.0
                    response_data['transaction_id'] = payment_details.transaction_id or ''
                except:
                    pass
            
            return response_data
    
    def validate(self, data):
        """
        Enhanced validation for payment data:
        - Supports cross-entitlement payments (different entitlements, same customer)
        - Validates all invoices belong to same customer
        - Checks for transaction_id idempotency
        - Prevents overpayment
        """
        from apps.bills.models import InvoiceMaster, CustomerEntitlementMaster
        from apps.customers.models import CustomerMaster
        
        # Check that either invoice_master_id or invoice_master_ids is provided
        has_single = 'invoice_master_id' in data and data['invoice_master_id'] is not None
        has_multiple = 'invoice_master_ids' in data and data['invoice_master_ids']
        
        if not has_single and not has_multiple:
            raise serializers.ValidationError(
                "Either 'invoice_master_id' or 'invoice_master_ids' must be provided"
            )
        
        if has_single and has_multiple:
            raise serializers.ValidationError(
                "Cannot provide both 'invoice_master_id' and 'invoice_master_ids'. Use one or the other."
            )
        
        # Normalize to list format for processing
        if has_single:
            invoice_ids = [data['invoice_master_id']]
        else:
            invoice_ids = data['invoice_master_ids']
        
        # Transaction ID Idempotency Check
        transaction_id = data.get('transaction_id')
        if transaction_id:
            existing_payment = PaymentDetails.objects.filter(
                transaction_id=transaction_id
            ).first()
            
            if existing_payment:
                raise serializers.ValidationError({
                    'transaction_id': (
                        f"Transaction ID '{transaction_id}' already exists. "
                        f"Payment Detail ID: {existing_payment.id}. "
                        "Please use a unique transaction ID to avoid duplicate payments."
                    )
                })
        
        # Verify all invoices exist
        invoices = InvoiceMaster.objects.select_related(
            'customer_master_id',
            'customer_entitlement_master_id'
        ).filter(id__in=invoice_ids).order_by('issue_date')  # FIFO: oldest invoices first
        
        if invoices.count() != len(invoice_ids):
            found_ids = list(invoices.values_list('id', flat=True))
            missing_ids = [inv_id for inv_id in invoice_ids if inv_id not in found_ids]
            raise serializers.ValidationError(
                f"Invoice(s) with ID(s) {missing_ids} not found"
            )
        
        # **KEY VALIDATION**: All invoices must belong to the SAME CUSTOMER
        customer_ids = set()
        for invoice in invoices:
            # Try to get customer from invoice.customer_master_id first
            if invoice.customer_master_id:
                customer_ids.add(invoice.customer_master_id.id)
            elif invoice.customer_entitlement_master_id and invoice.customer_entitlement_master_id.customer_master_id:
                customer_ids.add(invoice.customer_entitlement_master_id.customer_master_id.id)
            else:
                raise serializers.ValidationError(
                    f"Invoice {invoice.invoice_number} (ID: {invoice.id}) has no associated customer"
                )
        
        if len(customer_ids) > 1:
            raise serializers.ValidationError(
                f"All invoices must belong to the same customer. Found invoices from {len(customer_ids)} different customers."
            )
        
        # Get the single customer
        customer_id = customer_ids.pop()
        customer = CustomerMaster.objects.get(id=customer_id)
        
        # If customer_entitlement_master_id is provided, validate it belongs to same customer
        entitlement = None
        if 'customer_entitlement_master_id' in data and data['customer_entitlement_master_id']:
            try:
                entitlement = CustomerEntitlementMaster.objects.select_related('customer_master_id').get(
                    id=data['customer_entitlement_master_id']
                )
                
                if entitlement.customer_master_id.id != customer_id:
                    raise serializers.ValidationError(
                        f"Customer Entitlement Master ID {entitlement.id} does not belong to the same customer as the invoices"
                    )
            except CustomerEntitlementMaster.DoesNotExist:
                raise serializers.ValidationError(
                    f"Customer Entitlement Master with ID {data['customer_entitlement_master_id']} not found"
                )
        
        # Calculate total balance due for all invoices (overpayment allowed; excess becomes customer credit)
        total_balance_due = sum(inv.total_balance_due for inv in invoices)
        
        # When payment_method is Credit Balance, validate customer has sufficient credit
        is_credit_balance = (data.get('payment_method') or '').startswith('Credit Balance')
        if is_credit_balance:
            credit_balance = customer.get_credit_balance()
            pay_amount = data.get('pay_amount') or Decimal('0')
            if credit_balance < pay_amount:
                raise serializers.ValidationError(
                    f"Customer has insufficient credit balance. Available: {credit_balance}, requested: {pay_amount}."
                )

        # Validate adjustment_transfer_amount: must be <= pay_amount
        pay_amount = data.get('pay_amount') or Decimal('0')
        adj_transfer = data.get('adjustment_transfer_amount') or Decimal('0')
        if adj_transfer > pay_amount:
            raise serializers.ValidationError(
                "Adjustment transfer amount must be less than or equal to the total received amount."
            )
        if adj_transfer < Decimal('0'):
            raise serializers.ValidationError(
                "Adjustment transfer amount cannot be negative."
            )

        # Store validated data for use in create()
        data['_invoices'] = list(invoices)
        data['_customer'] = customer
        data['_entitlement'] = entitlement  # May be None
        data['_invoice_ids'] = invoice_ids
        data['_total_balance_due'] = total_balance_due
        
        return data
    
    def create(self, validated_data):
        """
        Enhanced create method supporting:
        - Cross-entitlement payments (different entitlements, same customer)
        - Partial payments with accurate due balance tracking
        - Distributes payment across multiple invoices sequentially
        """
        from apps.bills.models import InvoiceMaster
        from django.db import transaction
        
        try:
            # Extract internal data
            invoices = validated_data.pop('_invoices')
            customer = validated_data.pop('_customer')
            entitlement = validated_data.pop('_entitlement', None)  # May be None
            invoice_ids = validated_data.pop('_invoice_ids')
            total_balance_due = validated_data.pop('_total_balance_due')
            
            # Extract payment data
            payment_date = validated_data['payment_date']
            payment_method = validated_data['payment_method']
            pay_amount = validated_data['pay_amount']
            adjustment_transfer = validated_data.get('adjustment_transfer_amount') or Decimal('0')
            amount_for_invoices = pay_amount - adjustment_transfer  # Portion applied to invoices
            transaction_id = (validated_data.get('transaction_id') or '').strip()
            if not transaction_id and (payment_method or '').startswith('Credit Balance'):
                import uuid
                transaction_id = f"CREDIT-{payment_date}-{uuid.uuid4().hex[:8]}"
            remarks = validated_data.get('remarks', '')

            # Get user from context
            user = self.context['request'].user

            created_payments = []
            remaining_amount = amount_for_invoices  # Apply this to invoices (completed)
            
            with transaction.atomic():
                # Process each invoice
                for invoice in invoices:
                    if remaining_amount <= 0:
                        break
                    
                    balance_due = invoice.total_balance_due
                    if balance_due <= 0:
                        continue
                    
                    # Calculate amount to apply to this invoice
                    amount_to_apply = min(remaining_amount, balance_due)
                    
                    # Use the invoice's entitlement for this specific payment
                    invoice_entitlement = invoice.customer_entitlement_master_id
                    
                    # Step 1: Create PaymentMaster record
                    payment_master = PaymentMaster.objects.create(
                        payment_date=payment_date,
                        payment_method=payment_method,
                        customer_entitlement_master_id=invoice_entitlement,  # Use invoice's entitlement
                        invoice_master_id=invoice,
                        remarks=remarks if len(invoices) == 1 else f"{remarks} - Payment for invoice {invoice.invoice_number}",
                        status='completed',
                        received_by=user,
                        created_by=user
                    )
                    
                    # Step 2: Create PaymentDetails record
                    payment_detail = PaymentDetails.objects.create(
                        payment_master_id=payment_master,
                        pay_amount=amount_to_apply,
                        transaction_id=transaction_id,
                        remarks=f"Payment of {amount_to_apply} for invoice {invoice.invoice_number}",
                        status='completed',
                        received_by=user,
                        created_by=user
                    )
                    
                    # Step 3: Update invoice payment status (recalculates balance_due)
                    invoice.update_payment_status()
                    
                    remaining_amount -= amount_to_apply
                    created_payments.append({
                        'payment_master': payment_master,
                        'payment_detail': payment_detail,
                        'invoice': invoice,
                        'amount': amount_to_apply,
                        'new_balance': invoice.total_balance_due  # Updated balance after payment
                    })

                # Record adjustment transfer (deposit) as a separate PaymentDetails line.
                # Important:
                # - We must record the received amount somewhere for reporting (Payment history sums PaymentDetails.pay_amount).
                # - But it must NOT change invoice paid status, so we mark it non-'completed'.
                # - This also supports the case where adjustment_transfer == pay_amount (no invoice payment).
                if adjustment_transfer > 0 and customer and not (payment_method or '').startswith('Credit Balance'):
                    # Anchor the deposit record to a PaymentMaster (required FK), using the first selected invoice.
                    if created_payments:
                        deposit_pm = created_payments[0]['payment_master']
                        deposit_invoice = created_payments[0]['invoice']
                    else:
                        # No invoice payment was applied (e.g., 100% deposit). Create a PaymentMaster for traceability.
                        deposit_invoice = invoices[0]
                        deposit_pm = PaymentMaster.objects.create(
                            payment_date=payment_date,
                            payment_method=payment_method,
                            customer_entitlement_master_id=deposit_invoice.customer_entitlement_master_id,
                            invoice_master_id=deposit_invoice,
                            remarks=remarks if len(invoices) == 1 else f"{remarks} - Deposit (no invoice payment)",
                            status='completed',
                            received_by=user,
                            created_by=user
                        )
                        created_payments.append({
                            'payment_master': deposit_pm,
                            'payment_detail': None,
                            'invoice': deposit_invoice,
                            'amount': Decimal('0'),
                            'new_balance': deposit_invoice.total_balance_due
                        })

                    PaymentDetails.objects.create(
                        payment_master_id=deposit_pm,
                        pay_amount=adjustment_transfer,
                        transaction_id=transaction_id,
                        remarks="Adjustment transfer to deposit",
                        status='deposit',
                        received_by=user,
                        created_by=user
                    )

                # If payment_method is Credit Balance, debit customer credit (for amount applied to invoices)
                if (payment_method or '').startswith('Credit Balance') and customer and created_payments:
                    from apps.customers.models import CustomerCreditTransaction
                    applied_total = amount_for_invoices - remaining_amount
                    if applied_total > 0:
                        CustomerCreditTransaction.objects.create(
                            customer_id=customer,
                            amount=-applied_total,
                            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_ADJUSTMENT,
                            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                            reference_id=created_payments[0]['payment_master'].id,
                            invoice_id=None,
                            entry_date=payment_date,
                            remarks=f"Credit applied to invoice(s) - Payment #{created_payments[0]['payment_master'].id}",
                            created_by=user,
                        )
                # Add to customer credit: 1) adjustment transfer (explicit), 2) overpayment (excess after invoices)
                # Only when receiving money (not when paying with Credit Balance)
                if (customer and (adjustment_transfer > 0 or remaining_amount > 0)
                    and not (payment_method or '').startswith('Credit Balance')):
                    from apps.customers.models import CustomerCreditTransaction
                    # Adjustment transfer: explicit portion to deposit
                    if adjustment_transfer > 0:
                        CustomerCreditTransaction.objects.create(
                            customer_id=customer,
                            amount=adjustment_transfer,
                            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
                            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                            reference_id=created_payments[0]['payment_master'].id if created_payments else None,
                            invoice_id=None,
                            entry_date=payment_date,
                            remarks="Adjustment transfer to deposit",
                            created_by=user,
                        )
                    # Overpayment: excess after applying to invoices
                    if remaining_amount > 0:
                        CustomerCreditTransaction.objects.create(
                            customer_id=customer,
                            amount=remaining_amount,
                            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
                            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                            reference_id=created_payments[0]['payment_master'].id if created_payments else None,
                            invoice_id=None,
                            entry_date=payment_date,
                            remarks="Overpayment - excess allocated to credit",
                            created_by=user,
                        )
            
            # Return the first payment master (or create a summary if multiple)
            if len(created_payments) == 1:
                return created_payments[0]['payment_master']
            else:
                # For multiple payments, return the first one but include summary in response
                first_payment = created_payments[0]['payment_master']
                first_payment._payment_summary = {
                    'total_payments_created': len(created_payments),
                    'total_amount_applied': float(amount_for_invoices - remaining_amount),
                    'adjustment_transfer': float(adjustment_transfer),
                    'remaining_amount': float(remaining_amount),
                    'total_balance_due_before': float(total_balance_due),
                    'payments': [
                        {
                            'payment_id': p['payment_master'].id,
                            'invoice_id': p['invoice'].id,
                            'invoice_number': p['invoice'].invoice_number,
                            'entitlement_id': p['invoice'].customer_entitlement_master_id.id,
                            'amount_paid': float(p['amount']),
                            'new_balance_due': float(p['new_balance'])
                        }
                        for p in created_payments
                    ]
                }
                return first_payment
                
        except Exception as e:
            # Re-raise with more context for debugging
            raise serializers.ValidationError(f"Payment creation failed: {str(e)}")


class BulkPaymentSerializer(serializers.Serializer):
    """Serializer for bulk payment allocation"""
    ALLOCATION_METHODS = [
        ('auto', 'Auto Allocation (FIFO)'),
        ('manual', 'Manual Allocation'),
    ]
    
    entitlements_master_id = serializers.IntegerField(help_text="Customer Entitlement Master ID - invoices are linked to this entitlement")
    payment_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    allocation_method = serializers.ChoiceField(choices=ALLOCATION_METHODS, default='auto')
    payment_method = serializers.CharField(max_length=50, default='Cash')
    transaction_id = serializers.CharField(max_length=200, required=False, allow_blank=True, help_text="Bank reference, cheque number, or payment gateway transaction ID")
    remarks = serializers.CharField(required=False, allow_blank=True)
    
    # For manual allocation
    allocations = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField() # accepts string or number for amount/id
        ),
        required=False
    )
    
    def validate(self, data):
        if data.get('allocation_method') == 'manual':
            if not data.get('allocations'):
                raise serializers.ValidationError("Allocations list is required for manual allocation")
            
            # Validate total allocation matches payment amount
            total_allocated = sum(Decimal(str(item.get('amount', 0))) for item in data['allocations'])
            if total_allocated != data['payment_amount']:
                raise serializers.ValidationError(
                    f"Total allocated amount ({total_allocated}) not equal to payment amount ({data['payment_amount']})"
                )
                
        return data


# --- Fund Transfer (Customer-to-Customer) ---

class FundTransferLineSerializer(serializers.Serializer):
    customer_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))


class FundTransferSerializer(serializers.ModelSerializer):
    """Read serializer for fund transfer with lines."""
    lines = serializers.SerializerMethodField()
    created_by_email = serializers.SerializerMethodField()
    source_payment = serializers.SerializerMethodField()

    class Meta:
        model = CustomerFundTransfer
        fields = [
            'id', 'reference_number', 'transfer_date', 'remarks',
            'created_by', 'created_by_email', 'created_at', 'lines',
            'source_payment_master_id', 'source_payment'
        ]
        read_only_fields = fields

    def get_source_payment(self, obj):
        """Return source payment and invoice details when linked."""
        pm = obj.source_payment_master_id
        if not pm:
            return None
        invoice = pm.invoice_master_id
        return {
            'payment_master_id': pm.id,
            'payment_date': pm.payment_date.isoformat() if pm.payment_date else None,
            'invoice_id': invoice.id if invoice else None,
            'invoice_number': invoice.invoice_number if invoice else None,
        }

    def get_lines(self, obj):
        return [
            {
                'customer_id': line.customer_id_id,
                'customer_name': line.customer_id.customer_name,
                'amount': float(line.amount),
                'side': 'debit' if line.amount < 0 else 'credit',
            }
            for line in obj.lines.select_related('customer_id').order_by('amount')
        ]

    def get_created_by_email(self, obj):
        return obj.created_by.email if obj.created_by else None


class FundTransferCreateSerializer(serializers.Serializer):
    """
    Create fund transfer.
    Supports single→single, single→multiple, multiple→single.
    Either use (source_customer_id, target_customer_id, amount) or (source_allocations, target_allocations).
    source_payment_master_id: optional - links transfer to the payment whose overpayment credit
    is being transferred (for traceability). Only valid when single source.
    """
    transfer_date = serializers.DateField()
    remarks = serializers.CharField(required=False, allow_blank=True, default='')

    # Optional: trace which payment's overpayment is being transferred
    source_payment_master_id = serializers.IntegerField(required=False, allow_null=True)

    # Optional: when True (default), apply to target's unpaid invoice if any; remainder to credit.
    # When False, always add full amount to target's credit balance (no invoice application).
    apply_to_target_invoice = serializers.BooleanField(required=False, default=True)
    target_invoice_id = serializers.IntegerField(required=False, allow_null=True)
    target_invoice_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True,
        help_text='Optional list of target invoice IDs to apply in order'
    )

    # Convenience: single source → single target
    source_customer_id = serializers.IntegerField(required=False, allow_null=True)
    target_customer_id = serializers.IntegerField(required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'), required=False, allow_null=True)

    # Full form: multiple sources and/or multiple targets
    source_allocations = serializers.ListField(
        child=FundTransferLineSerializer(),
        required=False,
        allow_null=True,
        help_text='List of { customer_id, amount } for debit (source)'
    )
    target_allocations = serializers.ListField(
        child=FundTransferLineSerializer(),
        required=False,
        allow_null=True,
        help_text='List of { customer_id, amount } for credit (target)'
    )

    def validate(self, data):
        use_simple = (
            data.get('source_customer_id') is not None
            and data.get('target_customer_id') is not None
            and data.get('amount') is not None
        )
        use_allocations = (
            data.get('source_allocations') and data.get('target_allocations')
        )
        if use_simple and use_allocations:
            raise serializers.ValidationError(
                "Use either (source_customer_id, target_customer_id, amount) or (source_allocations, target_allocations), not both."
            )
        if not use_simple and not use_allocations:
            raise serializers.ValidationError(
                "Provide either (source_customer_id, target_customer_id, amount) or (source_allocations, target_allocations)."
            )
        if use_simple:
            amount = data['amount']
            data['source_allocations'] = [{'customer_id': data['source_customer_id'], 'amount': amount}]
            data['target_allocations'] = [{'customer_id': data['target_customer_id'], 'amount': amount}]
        if data.get('target_invoice_id') and data.get('target_invoice_ids'):
            raise serializers.ValidationError(
                "Use either target_invoice_id or target_invoice_ids, not both."
            )
        # source_payment_master_id only valid when single source (fund adjustment flow)
        src_payment_id = data.get('source_payment_master_id')
        if src_payment_id and len(data.get('source_allocations', [])) != 1:
            raise serializers.ValidationError(
                "source_payment_master_id is only supported for single source transfers."
            )
        if src_payment_id:
            from .models import PaymentMaster
            from apps.customers.models import CustomerCreditTransaction
            from django.db.models import Sum

            try:
                pm = PaymentMaster.objects.select_related(
                    'customer_entitlement_master_id__customer_master_id'
                ).get(pk=src_payment_id)
            except PaymentMaster.DoesNotExist:
                raise serializers.ValidationError(
                    "source_payment_master_id: Payment not found."
                )
            src_customer_id = data['source_allocations'][0]['customer_id']
            if pm.customer_entitlement_master_id.customer_master_id_id != src_customer_id:
                raise serializers.ValidationError(
                    "source_payment_master_id: Payment must belong to the source customer."
                )
            # Fund adjustment: amount must come from that payment's overpayment
            overpayment = CustomerCreditTransaction.objects.filter(
                reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                reference_id=src_payment_id,
                amount__gt=0,
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
            amount = data['source_allocations'][0]['amount']
            if amount > overpayment:
                raise serializers.ValidationError(
                    f"Transfer amount ({amount}) exceeds overpayment from payment #{src_payment_id} "
                    f"({overpayment}). Fund adjustment must be based on source payment amount."
                )
        return data

    def create(self, validated_data):
        from .fund_transfer_service import create_fund_transfer
        transfer = create_fund_transfer(
            source_allocations=validated_data['source_allocations'],
            target_allocations=validated_data['target_allocations'],
            transfer_date=validated_data['transfer_date'],
            remarks=validated_data.get('remarks', ''),
            created_by=self.context['request'].user,
            source_payment_master_id=validated_data.get('source_payment_master_id'),
            apply_to_target_invoice=validated_data.get('apply_to_target_invoice', True),
            target_invoice_id=validated_data.get('target_invoice_id'),
            target_invoice_ids=validated_data.get('target_invoice_ids'),
        )
        return transfer
