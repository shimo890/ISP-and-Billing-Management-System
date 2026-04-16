"""
REST API Views for Payment App
"""
from rest_framework import viewsets, permissions, filters, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum, Count
from django.utils import timezone
from datetime import datetime, date
from decimal import Decimal

from .models import PaymentMaster, PaymentDetails, CustomerFundTransfer
from apps.customers.models import CustomerCreditTransaction, CustomerMaster
from .serializers import (
    PaymentMasterSerializer,
    PaymentDetailsSerializer,
    PaymentDetailsCreateSerializer,
    PaymentCreateSerializer,
    FundTransferSerializer,
    FundTransferCreateSerializer,
)
from apps.authentication.permissions import RequirePermissions


class PaymentMasterViewSet(viewsets.ModelViewSet):
    """Full CRUD for Payment Master"""
    queryset = PaymentMaster.objects.select_related(
        'customer_entitlement_master_id__customer_master_id',
        'invoice_master_id',
        'received_by',
        'created_by'
    ).prefetch_related('details')
    serializer_class = PaymentMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['payments:read']
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'payment_method', 'invoice_master_id']
    # Search handled manually in get_queryset to avoid FieldError
    ordering_fields = ['created_at', 'payment_date']
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            self.required_permissions = ['payments:create']
        elif self.action == 'destroy':
            self.required_permissions = ['payments:delete']
        
        # Use PaymentCreateSerializer for creating payments
        if self.action == 'create':
            return PaymentCreateSerializer
        
        return PaymentMasterSerializer
    
    def get_queryset(self):
        qs = self.queryset
        customer_id = self.request.query_params.get('customer_id')
        company_name = self.request.query_params.get('company_name')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        search = self.request.query_params.get('search')
        
        if customer_id:
            qs = qs.filter(
                customer_entitlement_master_id__customer_master_id_id=customer_id
            )
        if company_name:
            qs = qs.filter(
                customer_entitlement_master_id__customer_master_id__company_name__icontains=company_name
            )
        if start_date:
            qs = qs.filter(payment_date__gte=start_date)
        if end_date:
            qs = qs.filter(payment_date__lte=end_date)
        if search:
            qs = qs.filter(
                Q(invoice_master_id__invoice_number__icontains=search)
                | Q(details__transaction_id__icontains=search)
                | Q(customer_entitlement_master_id__customer_master_id__customer_name__icontains=search)
                | Q(customer_entitlement_master_id__customer_master_id__company_name__icontains=search)
            )
        
        return qs
    
    def create(self, request, *args, **kwargs):
        """Override create to handle custom response for multiple payments"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment_master = self.perform_create(serializer)
        
        # Check if this was a multi-invoice payment
        if hasattr(payment_master, '_payment_summary'):
            summary = payment_master._payment_summary
            return Response({
                'success': True,
                'message': f"Successfully created {summary['total_payments_created']} payment(s)",
                'total_amount_applied': summary['total_amount_applied'],
                'remaining_amount': summary['remaining_amount'],
                'payments': summary['payments']
            }, status=status.HTTP_201_CREATED)
        else:
            # Single payment - return standard response
            headers = self.get_success_headers(serializer.data)
            response_serializer = PaymentMasterSerializer(payment_master)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_create(self, serializer):
        """Create payment and return the payment master object"""
        payment = serializer.save()
        return payment

    def perform_update(self, serializer):
        from django.db import transaction
        from apps.bills.recalculation_service import recalculate_invoice_totals
        with transaction.atomic():
            serializer.save()
            payment = serializer.instance
            if payment.invoice_master_id:
                invoice = payment.invoice_master_id
                invoice.refresh_from_db()
                recalculate_invoice_totals(invoice)

    def perform_destroy(self, instance):
        from django.db import transaction
        from apps.customers.models import CustomerCreditTransaction
        from apps.bills.recalculation_service import recalculate_invoice_totals

        invoice = instance.invoice_master_id
        payment_id = instance.id
        with transaction.atomic():
            instance.delete()
            CustomerCreditTransaction.objects.filter(
                reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                reference_id=payment_id
            ).delete()
            if invoice:
                recalculate_invoice_totals(invoice)
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get payment history with filters"""
        customer_id = request.query_params.get('customer_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        invoice_id = request.query_params.get('invoice_id')
        
        queryset = self.get_queryset()
        
        if customer_id:
            queryset = queryset.filter(
                customer_entitlement_master_id__customer_master_id_id=customer_id
            )
        if invoice_id:
            queryset = queryset.filter(invoice_master_id_id=invoice_id)
        if start_date:
            queryset = queryset.filter(payment_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(payment_date__lte=end_date)
        
        serializer = self.get_serializer(queryset.order_by('-payment_date'), many=True)
        
        # Calculate totals
        totals = queryset.aggregate(
            total_received=Sum('details__pay_amount')
        )
        
        return Response({
            'payments': serializer.data,
            'count': queryset.count(),
            'total_received': float(totals['total_received'] or Decimal('0'))
        })
    
    @action(detail=False, methods=['get'], url_path='customer-due-invoices')
    def customer_due_invoices(self, request):
        """
        Get all unpaid/partially paid invoices for a customer.
        Supports retrieving previous month invoices with outstanding due balances.
        
        Query Parameters:
        - customer_id (required): Customer ID
        - entitlement_id (optional): Filter by specific entitlement
        - include_zero_balance (optional, default=false): Include fully paid invoices
        
        Response includes:
        - List of invoices with due balances
        - Total due amount across all invoices
        - Payment history for each invoice
        """
        from apps.bills.models import InvoiceMaster
        from apps.customers.models import CustomerMaster
        
        customer_id = request.query_params.get('customer_id')
        entitlement_id = request.query_params.get('entitlement_id')
        include_zero_balance = request.query_params.get('include_zero_balance', 'false').lower() == 'true'
        
        if not customer_id:
            return Response(
                {'error': 'customer_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify customer exists
        try:
            customer = CustomerMaster.objects.get(id=customer_id)
        except CustomerMaster.DoesNotExist:
            return Response(
                {'error': f'Customer with ID {customer_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Build query
        invoices_query = InvoiceMaster.objects.filter(
            customer_master_id=customer
        ).select_related(
            'customer_entitlement_master_id',
            'customer_master_id'
        ).prefetch_related('payments', 'payments__details')
        
        # Filter by entitlement if provided
        if entitlement_id:
            invoices_query = invoices_query.filter(
                customer_entitlement_master_id_id=entitlement_id
            )
        
        # Exclude fully paid invoices unless requested
        if not include_zero_balance:
            invoices_query = invoices_query.exclude(
                status='paid'
            ).exclude(
                total_balance_due=0
            )
        
        # Order by issue date (oldest first)
        invoices = invoices_query.order_by('issue_date')
        
        # Build response data
        invoice_list = []
        total_due = Decimal('0')
        
        for invoice in invoices:
            # Get payment history for this invoice
            payments = invoice.payments.all().order_by('-payment_date')
            payment_history = [
                {
                    'payment_id': payment.id,
                    'payment_date': payment.payment_date.isoformat(),
                    'payment_method': payment.payment_method,
                    'amount_paid': float(payment.details.aggregate(
                        total=Sum('pay_amount')
                    )['total'] or Decimal('0')),
                    'transaction_id': payment.details.first().transaction_id if payment.details.exists() else ''
                }
                for payment in payments
            ]
            
            invoice_data = {
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'issue_date': invoice.issue_date.isoformat() if invoice.issue_date else None,
                'entitlement_id': invoice.customer_entitlement_master_id.id if invoice.customer_entitlement_master_id else None,
                'bill_number': invoice.bill_number,
                'total_bill_amount': float(invoice.total_bill_amount),
                'total_paid_amount': float(invoice.total_paid_amount),
                'total_balance_due': float(invoice.total_balance_due),
                'status': invoice.status,
                'payment_count': payments.count(),
                'payment_history': payment_history
            }
            
            invoice_list.append(invoice_data)
            total_due += invoice.total_balance_due
        
        return Response({
            'success': True,
            'customer_id': customer.id,
            'customer_name': customer.customer_name,
            'total_invoices': len(invoice_list),
            'total_due_amount': float(total_due),
            'invoices': invoice_list
        })
    
    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        """Get total received amount per customer"""
        customer_id = request.query_params.get('customer_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = self.get_queryset()
        
        if customer_id:
            queryset = queryset.filter(
                customer_entitlement_master_id__customer_master_id_id=customer_id
            )
        if start_date:
            queryset = queryset.filter(payment_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(payment_date__lte=end_date)
        
        # Group by customer and sum payments
        from apps.customers.models import CustomerMaster
        customers = CustomerMaster.objects.filter(
            id__in=queryset.values_list(
                'customer_entitlement_master_id__customer_master_id_id',
                flat=True
            ).distinct()
        )
        
        result = []
        for customer in customers:
            customer_payments = queryset.filter(
                customer_entitlement_master_id__customer_master_id=customer
            )
            total = customer_payments.aggregate(
                total=Sum('details__pay_amount')
            )['total'] or Decimal('0')
            
            result.append({
                'customer_id': customer.id,
                'customer_name': customer.customer_name,
                'total_received': float(total),
                'payment_count': customer_payments.count()
            })
        
        return Response(result)

    @action(detail=False, methods=['post'], url_path='bulk-pay')
    def bulk_pay(self, request):
        """
        Process bulk payment for multiple invoices under a specific entitlement.
        Supports Auto-Allocation (FIFO) and Manual Allocation.
        
        Auto Allocation (allocation_method='auto'):
        - Automatically distributes payment across unpaid invoices in FIFO order (oldest first)
        - No need to specify invoice_id - system automatically selects unpaid invoices
        - Payment is applied to oldest invoices first until payment amount is exhausted
        - Returns any remaining payment credit if payment exceeds total due
        
        Manual Allocation (allocation_method='manual'):
        - You manually specify which invoice(s) to pay and how much for each
        - Can pay a single invoice by passing one allocation object
        - Can pay multiple invoices by passing multiple allocation objects in the array
        - Total allocated amount must equal payment_amount
        - Each allocation requires: invoice_id and amount
        """
        from datetime import date
        from django.db import transaction
        from apps.bills.models import InvoiceMaster, CustomerEntitlementMaster
        from .serializers import BulkPaymentSerializer
        
        serializer = BulkPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        entitlements_master_id = data['entitlements_master_id']
        payment_amount = data['payment_amount']
        method = data['allocation_method']
        payment_method = data['payment_method']
        transaction_id = data.get('transaction_id', '')
        remarks = data.get('remarks', '')
        
        result = {
            'success': True,
            'message': '',
            'processed_invoices': [],
            'total_due': 0.0,
            'total_received': 0.0,
            'remaining_balance': 0.0
        }
        
        try:
            with transaction.atomic():
                # Verify entitlement exists
                try:
                    entitlement = CustomerEntitlementMaster.objects.get(id=entitlements_master_id)
                except CustomerEntitlementMaster.DoesNotExist:
                    return Response(
                        {"error": f"Customer Entitlement Master with ID {entitlements_master_id} not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                # Get unpaid status invoices for this entitlement
                invoices = InvoiceMaster.objects.filter(
                    customer_entitlement_master_id_id=entitlements_master_id,
                    status__in=['issued', 'partial', 'draft', 'unpaid']
                ).exclude(status='paid').order_by('issue_date')  # FIFO order
                
                # Calculate total due before payment
                total_due_before = sum(inv.total_balance_due for inv in invoices)
                result['total_due'] = float(total_due_before)
                
                processed_count = 0
                remaining_payment = payment_amount
                total_received_amount = Decimal('0')
                
                if method == 'auto':
                    # Auto Allocation (FIFO)
                    # Automatically pays oldest invoices first without needing invoice IDs
                    for invoice in invoices:
                        if remaining_payment <= 0:
                            break
                            
                        balance_due = invoice.total_balance_due
                        if balance_due <= 0:
                            continue
                            
                        # Calculate amount to pay for this invoice
                        pay_amount = min(remaining_payment, balance_due)
                        
                        # Create Payment Record
                        payment = PaymentMaster.objects.create(
                            payment_date=date.today(),
                            payment_method=payment_method,
                            customer_entitlement_master_id=entitlement,
                            invoice_master_id=invoice,
                            remarks=f"Bulk Payment (Auto-FIFO) - {remarks}",
                            status='completed',
                            received_by=request.user,
                            created_by=request.user
                        )
                        
                        # Create Payment Detail
                        PaymentDetails.objects.create(
                            payment_master_id=payment,
                            pay_amount=pay_amount,
                            transaction_id=transaction_id,
                            remarks=f"Auto allocation from total payment {payment_amount}",
                            status='completed',
                            received_by=request.user,
                            created_by=request.user
                        )
                        
                        # Update invoice status
                        invoice.update_payment_status()
                        
                        remaining_payment -= pay_amount
                        total_received_amount += pay_amount
                        processed_count += 1
                        result['processed_invoices'].append({
                            'payment_id': payment.id,
                            'invoice_id': invoice.id,
                            'invoice_number': invoice.invoice_number,
                            'paid_amount': float(pay_amount),
                            'previous_balance': float(balance_due),
                            'new_balance': float(invoice.total_balance_due),
                            'status': invoice.status
                        })

                    # If payment exceeded total due, store excess as customer credit
                    if remaining_payment > 0:
                        from apps.customers.models import CustomerCreditTransaction
                        CustomerCreditTransaction.objects.create(
                            customer_id=entitlement.customer_master_id,
                            amount=remaining_payment,
                            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
                            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                            reference_id=None,
                            invoice_id=None,
                            entry_date=date.today(),
                            remarks="Bulk payment (Auto-FIFO) - overpayment allocated to credit",
                            created_by=request.user,
                        )
                        
                elif method == 'manual':
                    # Manual Allocation
                    # You specify exactly which invoice(s) to pay and how much
                    
                    # Calculate total due before payment
                    total_due_before = sum(inv.total_balance_due for inv in invoices)
                    result['total_due'] = float(total_due_before)
                    
                    total_received_amount = Decimal('0')
                    allocations = data.get('allocations', [])
                    for alloc in allocations:
                        invoice_id = alloc.get('invoice_id')
                        amount = Decimal(str(alloc.get('amount')))
                        
                        if amount <= 0:
                            continue
                            
                        # Find specific invoice (ensure it belongs to this entitlement)
                        invoice = invoices.filter(pk=invoice_id).first()
                        if not invoice:
                            # Raise error for invalid invoice IDs
                            raise serializers.ValidationError(
                                f"Invoice ID {invoice_id} not found or not eligible for payment. "
                                f"Please verify the invoice belongs to entitlement ID {entitlements_master_id} "
                                f"and is not already paid."
                            )
                        
                        # Validate payment amount doesn't exceed invoice balance
                        if amount > invoice.total_balance_due:
                            raise serializers.ValidationError(
                                f"Payment amount ({amount}) exceeds balance due ({invoice.total_balance_due}) "
                                f"for invoice {invoice.invoice_number}"
                            )
                             
                        # Create Payment Record
                        payment = PaymentMaster.objects.create(
                            payment_date=date.today(),
                            payment_method=payment_method,
                            customer_entitlement_master_id=entitlement,
                            invoice_master_id=invoice,
                            remarks=f"Bulk Payment (Manual) - {remarks}",
                            status='completed',
                            received_by=request.user,
                            created_by=request.user
                        )
                        
                        # Create Payment Detail
                        PaymentDetails.objects.create(
                            payment_master_id=payment,
                            pay_amount=amount,
                            transaction_id=transaction_id,
                            remarks=f"Manual allocation - specified amount",
                            status='completed',
                            received_by=request.user,
                            created_by=request.user
                        )
                        
                        # Update invoice status
                        invoice.update_payment_status()
                        
                        total_received_amount += amount
                        processed_count += 1
                        result['processed_invoices'].append({
                            'payment_id': payment.id,
                            'invoice_id': invoice.id,
                            'invoice_number': invoice.invoice_number,
                            'paid_amount': float(amount),
                            'new_balance': float(invoice.total_balance_due),
                            'status': invoice.status
                        })
                
                result['message'] = f"Successfully processed payment for {processed_count} invoice(s)"
                result['total_received'] = float(total_received_amount)
                result['remaining_payment_credit'] = float(remaining_payment) if method == 'auto' else 0
                
        except Exception as e:
            return Response(
                {"error": f"Transaction failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
        return Response(result, status=status.HTTP_200_OK)

class PaymentDetailsViewSet(viewsets.ModelViewSet):
    """Full CRUD for Payment Details with invoice balance propagation"""
    queryset = PaymentDetails.objects.select_related(
        'payment_master_id', 'received_by', 'created_by'
    )
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['payment_details:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['payment_master_id', 'status']
    search_fields = ['transaction_id']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            self.required_permissions = ['payments:create']
        elif self.action == 'destroy':
            self.required_permissions = ['payments:delete']
        if self.action == 'create':
            return PaymentDetailsCreateSerializer
        return PaymentDetailsSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, received_by=self.request.user)
        # Invoice update handled by serializer

    def perform_update(self, serializer):
        from django.db import transaction
        from apps.bills.recalculation_service import recalculate_invoice_totals
        with transaction.atomic():
            detail = serializer.save()
            payment = detail.payment_master_id
            invoice = payment.invoice_master_id
            if invoice:
                invoice.refresh_from_db()
                recalculate_invoice_totals(invoice)

    def perform_destroy(self, instance):
        from django.db import transaction
        from apps.customers.models import CustomerCreditTransaction
        from apps.bills.recalculation_service import recalculate_invoice_totals

        payment = instance.payment_master_id
        invoice = payment.invoice_master_id
        payment_id = payment.id

        with transaction.atomic():
            instance.delete()
            # Reverse any overpayment credit created for this payment
            CustomerCreditTransaction.objects.filter(
                reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
                reference_id=payment_id
            ).delete()
            if invoice:
                recalculate_invoice_totals(invoice)


class FundTransferViewSet(viewsets.GenericViewSet):
    """List, create, and retrieve customer-to-customer fund transfers."""
    queryset = CustomerFundTransfer.objects.all().select_related(
        'created_by', 'source_payment_master_id', 'source_payment_master_id__invoice_master_id'
    ).prefetch_related('lines__customer_id')
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['payments:read']

    def get_serializer_class(self):
        if self.action == 'create':
            return FundTransferCreateSerializer
        return FundTransferSerializer

    def get_queryset(self):
        qs = self.queryset
        customer_search = self.request.query_params.get('customer_search', '').strip()
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if customer_search:
            qs = qs.filter(
                Q(lines__customer_id__customer_name__icontains=customer_search) |
                Q(lines__customer_id__company_name__icontains=customer_search)
            ).distinct()
        if from_date:
            qs = qs.filter(transfer_date__gte=from_date)
        if to_date:
            qs = qs.filter(transfer_date__lte=to_date)
        return qs.order_by('-transfer_date', '-id')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = FundTransferSerializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = FundTransferSerializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='credit-sources')
    def credit_sources(self, request):
        """
        List payments with overpayment credit available for fund transfer.
        Query param: customer_id (required).
        Returns same structure as GET /api/customers/{id}/payments-with-credit/
        """
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response(
                {'error': 'customer_id query parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            customer = CustomerMaster.objects.get(pk=customer_id)
        except CustomerMaster.DoesNotExist:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
        transactions = CustomerCreditTransaction.objects.filter(
            customer_id=customer,
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
            reference_id__isnull=False,
            amount__gt=0,
        ).select_related('invoice_id').order_by('-entry_date', '-id')
        payment_credits = {}
        for t in transactions:
            payment_id = t.reference_id
            if not payment_id:
                continue
            amt = Decimal(str(t.amount))
            if payment_id not in payment_credits:
                payment_credits[payment_id] = {'amount': amt, 'entry_date': t.entry_date, 'remarks': t.remarks}
            else:
                payment_credits[payment_id]['amount'] += amt
        result = []
        for payment_id, info in payment_credits.items():
            if info['amount'] <= 0:
                continue
            try:
                pm = PaymentMaster.objects.select_related(
                    'invoice_master_id', 'invoice_master_id__customer_entitlement_master_id'
                ).get(pk=payment_id)
            except PaymentMaster.DoesNotExist:
                continue
            invoice = pm.invoice_master_id
            result.append({
                'payment_master_id': pm.id,
                'payment_date': pm.payment_date.isoformat(),
                'payment_method': pm.payment_method,
                'invoice_id': invoice.id if invoice else None,
                'invoice_number': invoice.invoice_number if invoice else None,
                'credit_amount': float(info['amount']),
                'entry_date': info['entry_date'].isoformat(),
                'remarks': info['remarks'] or '',
            })
        result.sort(key=lambda x: (x['entry_date'], x['payment_master_id']), reverse=True)
        return Response({
            'customer_id': customer.id,
            'customer_name': customer.customer_name,
            'credit_balance': float(customer.get_credit_balance()),
            'payments_with_credit': result,
        })

    def create(self, request, *args, **kwargs):
        self.required_permissions = ['payments:create']
        serializer = FundTransferCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            transfer = serializer.save()
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        transfer.refresh_from_db()
        return Response(FundTransferSerializer(transfer).data, status=status.HTTP_201_CREATED)

