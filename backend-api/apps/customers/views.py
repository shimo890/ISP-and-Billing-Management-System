from rest_framework import generics, permissions, filters, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import StreamingHttpResponse, HttpResponse
from django.db import models
from django.utils import timezone
from rest_framework.exceptions import NotFound
import csv
from django.db.models import Q, Sum, Count
from io import BytesIO
from django_filters.rest_framework import DjangoFilterBackend
from .models import Prospect, CustomerMaster, ProspectStatusHistory, KAMMaster, CustomerCreditTransaction
from apps.bills.models import CustomerEntitlementMaster, CustomerEntitlementDetails
from .serializers import (
    ProspectSerializer,
    CustomerMasterSerializer,
    CustomerMasterListSerializer,
    KAMMasterSerializer,
)
from .utils import convert_prospect_to_customer
from .email_service import send_prospect_confirmation_email, send_customer_lost_email
from apps.authentication.permissions import RequirePermissions
from apps.users.models import User

try:
    import pandas as pd
except ImportError:  # pragma: no cover - optional for CSV/Excel prospect tooling
    pd = None


class KAMMasterListView(generics.ListAPIView):
    """GET only - List all KAM Masters"""
    queryset = KAMMaster.objects.filter(is_active=True)
    serializer_class = KAMMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['customers:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['kam_name', 'email', 'phone']
    ordering_fields = ['kam_name', 'created_at']


class KAMMasterDetailView(generics.RetrieveAPIView):
    """GET only - Retrieve single KAM Master"""
    queryset = KAMMaster.objects.all()
    serializer_class = KAMMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['customers:read']


class KAMMasterViewSet(viewsets.ModelViewSet):
    """KAM management (list/create/update/delete)."""
    queryset = KAMMaster.objects.all().order_by('kam_name')
    serializer_class = KAMMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['customers:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['kam_name', 'designation', 'email', 'phone']
    ordering_fields = ['kam_name', 'created_at', 'updated_at']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.required_permissions = ['customers:update']
        else:
            self.required_permissions = ['customers:read']
        return KAMMasterSerializer


# ==================== Customer Master Views ====================

class CustomerMasterViewSet(viewsets.ModelViewSet):
    """Full CRUD for Customer Master. Uses limit/offset pagination (?limit=&offset=)."""
    queryset = CustomerMaster.objects.all()
    serializer_class = CustomerMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['customers:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer_type', 'status', 'is_active', 'kam_id']
    search_fields = ['customer_name', 'email', 'phone', 'customer_number', 'company_name', 'nid']
    ordering_fields = ['customer_name', 'created_at', 'last_bill_invoice_date']
    
    def get_queryset(self):
        use_minimal = self.action == 'list' and self.request.query_params.get('minimal') == '1'
        
        if use_minimal:
            qs = CustomerMaster.objects.all()
        else:
            qs = CustomerMaster.objects.select_related('kam_id', 'created_by').prefetch_related('entitlements')
        
        # Skip role checking during schema generation
        if getattr(self, 'swagger_fake_view', False):
            return qs
        
        user = self.request.user
        
        # Filter by KAM if user is sales_person
        if user.is_authenticated and hasattr(user, 'role') and user.role and user.role.name == 'sales_person':
            qs = qs.filter(kam_id__kam_name=user.username)
        
        # Minimal mode: annotated count in single query, no prefetch
        if use_minimal:
            qs = qs.annotate(
                active_entitlements_count=Count(
                    'entitlements',
                    filter=Q(
                        entitlements__details__is_active=True,
                        entitlements__details__status='active',
                    ),
                    distinct=True,
                )
            ).order_by('customer_name')
        
        return qs
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            self.required_permissions = ['customers:update']
        elif self.action == 'destroy':
            self.required_permissions = ['customers:update']
        if self.action == 'list' and self.request.query_params.get('minimal') == '1':
            return CustomerMasterListSerializer
        return CustomerMasterSerializer
    
    def perform_create(self, serializer):
        """Create customer and auto-set created_by and updated_by"""
        serializer.save(created_by=self.request.user, updated_by=self.request.user)
    
    def perform_update(self, serializer):
        """Update customer and auto-set updated_by"""
        serializer.save(updated_by=self.request.user)
    
    @action(detail=True, methods=['get'])
    def entitlements(self, request, pk=None):
        """Get all entitlements for a customer"""
        from apps.bills.serializers import CustomerEntitlementMasterSerializer
        customer = self.get_object()
        entitlements = CustomerEntitlementMaster.objects.filter(
            customer_master_id=customer
        ).prefetch_related('details')
        serializer = CustomerEntitlementMasterSerializer(entitlements, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='credit-balances')
    def credit_balances_list(self, request):
        """
        List all customers with non-zero credit balance.
        Returns customer_id, customer_name, customer_number, credit_balance.
        Uses a single aggregation query instead of N per-customer queries.
        """
        from decimal import Decimal
        from django.db.models import Sum

        user = request.user
        # Base queryset for credit transactions (respects sales_person KAM filter)
        txn_qs = CustomerCreditTransaction.objects.all()
        if user.is_authenticated and hasattr(user, 'role') and user.role and user.role.name == 'sales_person':
            txn_qs = txn_qs.filter(customer_id__kam_id__kam_name=user.username)

        # Single aggregation: credit balance per customer
        credit_rows = list(
            txn_qs.values('customer_id')
            .annotate(credit_balance=Sum('amount'))
            .filter(credit_balance__gt=Decimal('0'))
            .order_by('-credit_balance')
        )

        if not credit_rows:
            return Response([])

        ids_ordered = [row['customer_id'] for row in credit_rows]
        balance_map = {row['customer_id']: float(row['credit_balance']) for row in credit_rows}

        # Single query for customer names/numbers
        customers = CustomerMaster.objects.filter(id__in=ids_ordered).in_bulk()

        result = [
            {
                'customer_id': cid,
                'customer_name': customers[cid].customer_name,
                'company_name': customers[cid].company_name or '',
                'customer_number': customers[cid].customer_number or '',
                'credit_balance': balance_map[cid],
            }
            for cid in ids_ordered
            if cid in customers
        ]
        return Response(result)

    @action(detail=True, methods=['get'], url_path='credit-balance')
    def credit_balance(self, request, pk=None):
        """
        Get customer credit / advance balance (overpayment, transfer in/out).
        Returns current balance and list of credit transactions.
        """
        customer = self.get_object()
        balance = customer.get_credit_balance()
        transactions = CustomerCreditTransaction.objects.filter(
            customer_id=customer
        ).select_related('invoice_id').order_by('-entry_date', '-id')[:100]
        return Response({
            'customer_id': customer.id,
            'customer_name': customer.customer_name,
            'customer_number': customer.customer_number,
            'credit_balance': float(balance),
            'transactions': [
                {
                    'id': t.id,
                    'amount': float(t.amount),
                    'transaction_type': t.transaction_type,
                    'reference_type': t.reference_type,
                    'reference_id': t.reference_id,
                    'entry_date': t.entry_date.isoformat(),
                    'remarks': t.remarks or '',
                    'invoice_id': t.invoice_id_id,
                    'invoice_number': t.invoice_id.invoice_number if t.invoice_id else None,
                    'created_at': t.created_at.isoformat(),
                }
                for t in transactions
            ],
        })

    @action(detail=True, methods=['get'], url_path='payments-with-credit')
    def payments_with_credit(self, request, pk=None):
        """
        Get payments that have overpayment credit available for fund transfer.
        Returns CustomerCreditTransaction records where reference_type=payment (overpayment)
        with PaymentMaster and Invoice details for use when creating fund transfers.
        Use payment_master_id as source_payment_master_id in POST /api/payments/fund-transfers/
        """
        from apps.payment.models import PaymentMaster

        customer = self.get_object()
        transactions = CustomerCreditTransaction.objects.filter(
            customer_id=customer,
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
            reference_id__isnull=False,
            amount__gt=0,
        ).select_related('invoice_id').order_by('-entry_date', '-id')

        from decimal import Decimal
        # Aggregate credit by payment_master_id (in case multiple txns reference same payment)
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

    @action(detail=True, methods=['get'], url_path='cumulative-balance')
    def cumulative_balance(self, request, pk=None):
        """
        Get customer's total outstanding balance across all invoices.
        
        Returns cumulative balance, total received, and list of unpaid/partial invoices.
        
        Response:
        {
            "customer_id": 1,
            "customer_name": "Example Customer",
            "cumulative_balance": 5000.00,
            "total_received": 3000.00,
            "unpaid_invoice_count": 3,
            "invoices": [...]
        }
        """
        from apps.bills.models import InvoiceMaster
        from decimal import Decimal
        
        customer = self.get_object()
        
        # Get all unpaid/partial invoices
        invoices = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        ).exclude(status='paid').select_related(
            'customer_entitlement_master_id'
        ).order_by('-issue_date')
        
        # Calculate cumulative balance using model method
        cumulative_balance = customer.get_cumulative_balance()
        
        # Calculate total received using model method
        total_received = customer.get_total_received()
        
        # Calculate total billed
        total_billed = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        ).aggregate(
            total=Sum('total_bill_amount')
        )['total'] or Decimal('0.00')
        
        return Response({
            'customer_id': customer.id,
            'customer_name': customer.customer_name,
            'customer_number': customer.customer_number,
            'customer_type': customer.customer_type,
            'cumulative_balance': float(cumulative_balance),
            'total_received': float(total_received),
            'total_billed': float(total_billed),
            'unpaid_invoice_count': invoices.count(),
            'invoices': [
                {
                    'invoice_id': inv.id,
                    'invoice_number': inv.invoice_number,
                    'issue_date': inv.issue_date,
                    'total_amount': float(inv.total_bill_amount),
                    'paid_amount': float(inv.total_paid_amount),
                    'balance_due': float(inv.total_balance_due),
                    'status': inv.status,
                    'entitlement_id': inv.customer_entitlement_master_id.id,
                    'bill_number': inv.customer_entitlement_master_id.bill_number
                }
                for inv in invoices
            ]
        })
    
    @action(detail=True, methods=['get'])
    def invoices(self, request, pk=None):
        """Get all invoices for a customer"""
        from apps.bills.models import InvoiceMaster
        customer = self.get_object()
        invoices = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        )
        from apps.bills.serializers import InvoiceMasterSerializer
        serializer = InvoiceMasterSerializer(invoices, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        """Get all payments for a customer"""
        from apps.payment.models import PaymentMaster
        customer = self.get_object()
        payments = PaymentMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        )
        from apps.payment.serializers import PaymentMasterSerializer
        serializer = PaymentMasterSerializer(payments, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def payment_history(self, request, pk=None):
        """Get payment history with date range filter"""
        from apps.payment.models import PaymentMaster
        customer = self.get_object()
        
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        payments = PaymentMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        )
        
        if start_date:
            payments = payments.filter(payment_date__gte=start_date)
        if end_date:
            payments = payments.filter(payment_date__lte=end_date)
        
        from apps.payment.serializers import PaymentMasterSerializer
        serializer = PaymentMasterSerializer(payments.order_by('-payment_date'), many=True)
        
        # Calculate totals
        total_received = payments.aggregate(
            total=Sum('details__pay_amount')
        )['total'] or Decimal('0')
        
        return Response({
            'payments': serializer.data,
            'total_received': float(total_received),
            'count': payments.count()
        })
    
    @action(detail=True, methods=['get'])
    def bill_history(self, request, pk=None):
        """Get bill/invoice history with date range filter"""
        from apps.bills.models import InvoiceMaster
        customer = self.get_object()
        
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        period = request.query_params.get('period')  # 'monthly', 'weekly', etc.
        
        invoices = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        )
        
        if start_date:
            invoices = invoices.filter(issue_date__gte=start_date)
        if end_date:
            invoices = invoices.filter(issue_date__lte=end_date)
        
        from apps.bills.serializers import InvoiceMasterSerializer
        serializer = InvoiceMasterSerializer(invoices.order_by('-issue_date'), many=True)
        
        return Response({
            'invoices': serializer.data,
            'count': invoices.count(),
            'total_billed': float(invoices.aggregate(total=Sum('total_bill_amount'))['total'] or Decimal('0'))
        })
    
    @action(detail=True, methods=['get'])
    def last_bill(self, request, pk=None):
        """Get last bill/invoice for customer"""
        from apps.bills.models import InvoiceMaster
        customer = self.get_object()
        last_invoice = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        ).order_by('-issue_date').first()
        
        if last_invoice:
            from apps.bills.serializers import InvoiceMasterSerializer
            serializer = InvoiceMasterSerializer(last_invoice)
            return Response(serializer.data)
        return Response({'detail': 'No bills found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'])
    def previous_bill(self, request, pk=None):
        """Get previous bill (second to last)"""
        from apps.bills.models import InvoiceMaster
        customer = self.get_object()
        invoices = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer
        ).order_by('-issue_date')[:2]
        
        if len(invoices) > 1:
            from apps.bills.serializers import InvoiceMasterSerializer
            serializer = InvoiceMasterSerializer(invoices[1])
            return Response(serializer.data)
        return Response({'detail': 'No previous bill found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Export customers to CSV, Excel, or PDF format
        Query parameters:
        - format: 'csv', 'excel' (default: 'csv')
        - customer_type: Filter by customer type
        - status: Filter by status
        - is_active: Filter by active status (true/false)
        """
        queryset = self.filter_queryset(self.get_queryset())
        export_format = request.query_params.get('format', 'csv').lower()
        
        try:
            if export_format == 'excel':
                return CustomerExporter.export_to_excel(queryset)
            elif export_format == 'csv':
                return CustomerExporter.export_to_csv(queryset)
            else:
                return Response(
                    {'error': 'Invalid format. Choose from: csv, excel'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], parser_classes=(MultiPartParser, FormParser))
    def import_customers(self, request):
        """
        Import customers from CSV or Excel file
        Request body:
        - file: The file to import (multipart/form-data)
        - file_format: 'csv' or 'excel' (auto-detect from filename if not provided)
        """
        self.required_permissions = ['customers:create']
        
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = request.FILES['file']
        file_format = request.data.get('file_format', '').lower()
        
        # Auto-detect format from filename if not provided
        if not file_format:
            if uploaded_file.name.endswith('.xlsx'):
                file_format = 'excel'
            elif uploaded_file.name.endswith('.csv'):
                file_format = 'csv'
            else:
                return Response(
                    {'error': 'Unable to determine file format. Please specify file_format parameter.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            file_content = uploaded_file.read()
            
            if file_format == 'excel':
                success_count, error_messages, created_customers = CustomerImporter.import_from_excel(file_content)
            elif file_format == 'csv':
                success_count, error_messages, created_customers = CustomerImporter.import_from_csv(file_content)
            else:
                return Response(
                    {'error': 'Invalid file format. Choose from: csv, excel'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response({
                'success': True,
                'message': f'Successfully imported {success_count} customers',
                'success_count': success_count,
                'error_count': len(error_messages),
                'created_customers': created_customers,
                'errors': error_messages if error_messages else []
            }, status=status.HTTP_201_CREATED if success_count > 0 else status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return Response(
                {'error': f'Import failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def export_template(self, request):
        """
        Export a template file for importing customers
        Query parameters:
        - format: 'csv', 'excel' (default: 'csv')
        """
        export_format = request.query_params.get('format', 'csv').lower()
        
        template_data = [{
            'Customer ID': '',
            'Customer Name': 'Example Corp',
            'NID': '',
            'Company Name': 'Example Company',
            'Email': 'contact@example.com',
            'Phone': '+1234567890',
            'Address': '123 Business St, City',
            'Customer Type': 'bw',
            'KAM Name': 'John Doe',
            'KAM Designation': 'Senior KAM',
            'Customer Number': '',
            'Total Clients': 10,
            'Total Active Clients': 8,
            'Free Giveaway Clients': 0,
            'Default % Share': 20.5,
            'Contact Person': 'Jane Smith',
            'Status': 'active',
            'Last Bill Date': '',
            'Is Active': 'Yes',
            'Created At': '',
            'Updated At': '',
        }]
        
        try:
            if export_format == 'excel':
                df = pd.DataFrame(template_data)
                output = BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    df.to_excel(writer, sheet_name='Template', index=False)
                output.seek(0)
                response = HttpResponse(
                    output.read(),
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
                response['Content-Disposition'] = 'attachment; filename="customers_template.xlsx"'
                return response
            elif export_format == 'csv':
                output = BytesIO()
                df = pd.DataFrame(template_data)
                df.to_csv(output, index=False)
                output.seek(0)
                response = HttpResponse(output.getvalue(), content_type='text/csv')
                response['Content-Disposition'] = 'attachment; filename="customers_template.csv"'
                return response
            else:
                return Response(
                    {'error': 'Invalid format. Choose from: csv, excel'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'error': f'Template generation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )






class ProspectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProspectSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['prospects:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'source', 'follow_up_date__month', 'follow_up_date__year', 'follow_up_date__gte', 'follow_up_date__lte']
    search_fields = ['name', 'company_name', 'email', 'phone']
    ordering_fields = ['created_at', 'potential_revenue']

    def get_queryset(self):
        qs = Prospect.objects.all()
        user = self.request.user
        if user.role and user.role.name == 'sales_person':
            qs = qs.filter(kam=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(kam=self.request.user)


class ProspectDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Prospect.objects.all()
    serializer_class = ProspectSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['prospects:update']
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        old_status = instance.status
        
        # Call parent update
        response = super().update(request, *args, **kwargs)
        
        # Track status change in history
        instance.refresh_from_db()
        if old_status != instance.status:
            ProspectStatusHistory.objects.create(
                prospect=instance,
                from_status=old_status,
                to_status=instance.status,
                changed_by=request.user,
                notes=request.data.get('notes', f"Status changed from {old_status} to {instance.status}")
            )
        
        return response


class ProspectExportView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['prospects:export']

    def get(self, request):
        queryset = Prospect.objects.select_related('kam').all()
        user = request.user
        if user.role and user.role.name == 'sales_person':
            queryset = queryset.filter(kam=user)
        
        export_format = request.query_params.get('format', 'csv').lower()

        if export_format == 'excel':
            # Export as Excel
            data = []
            for p in queryset:
                kam = p.kam.id if p.kam else ''
                data.append({
                    'id': p.id,
                    'name': p.name,
                    'company_name': p.company_name or '',
                    'email': p.email or '',
                    'phone': p.phone or '',
                    'address': p.address or '',
                    'potential_revenue': float(p.potential_revenue),
                    'contact_person': p.contact_person or '',
                    'source': p.source or '',
                    'follow_up_date': p.follow_up_date.strftime('%Y-%m-%d') if p.follow_up_date else '',
                    'notes': p.notes or '',
                    'status': p.status,
                    'kam': kam,
                    'created_at': p.created_at.strftime('%Y-%m-%d %H:%M:%S') if p.created_at else '',
                    'updated_at': p.updated_at.strftime('%Y-%m-%d %H:%M:%S') if p.updated_at else '',
                })

            df = pd.DataFrame(data)
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='Prospects', index=False)
            buffer.seek(0)

            response = HttpResponse(
                buffer.getvalue(),
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="prospects.xlsx"'
            return response

        else:
            # Export as CSV (default)
            def row_iter():
                header = ['id', 'name', 'company_name', 'email', 'phone', 'address', 'potential_revenue', 'contact_person', 'source', 'follow_up_date', 'notes', 'status', 'kam', 'created_at', 'updated_at']
                yield ','.join(header) + '\n'
                for p in queryset.iterator():
                    kam = str(p.kam.id) if p.kam else ''
                    row = [
                        str(p.id), 
                        p.name, 
                        p.company_name or '', 
                        p.email or '', 
                        p.phone or '',
                        p.address or '', 
                        str(p.potential_revenue),
                        p.contact_person or '',
                        p.source or '',
                        p.follow_up_date.strftime('%Y-%m-%d') if p.follow_up_date else '',
                        (p.notes or '').replace('\n', ' ').replace(',', ' '),
                        p.status,
                        kam,
                        p.created_at.strftime('%Y-%m-%d %H:%M:%S') if p.created_at else '',
                        p.updated_at.strftime('%Y-%m-%d %H:%M:%S') if p.updated_at else ''
                    ]
                    yield ','.join(row) + '\n'

            response = StreamingHttpResponse(row_iter(), content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="prospects.csv"'
            return response


class ProspectImportView(APIView):
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['prospects:import']
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.data.get('file')
        if not file:
            return Response({'detail': 'File is required'}, status=400)

        file_name = file.name.lower()
        if file_name.endswith('.xlsx') or file_name.endswith('.xls'):
            return self._import_excel(file, request.user)
        elif file_name.endswith('.csv'):
            return self._import_csv(file, request.user)
        else:
            return Response({'detail': 'Unsupported file format. Please upload Excel (.xlsx, .xls) or CSV files.'}, status=400)

    def _import_excel(self, file, user):
        try:
            df = pd.read_excel(file)
            return self._process_dataframe(df, user)
        except Exception as e:
            return Response({'detail': f'Error reading Excel file: {str(e)}'}, status=400)

    def _import_csv(self, file, user):
        try:
            df = pd.read_csv(file)
            return self._process_dataframe(df, user)
        except Exception as e:
            return Response({'detail': f'Error reading CSV file: {str(e)}'}, status=400)

    def _process_dataframe(self, df, user):
        required_columns = ['name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return Response({
                'detail': f'Missing required columns: {", ".join(missing_columns)}'
            }, status=400)

        processed = 0
        errors = []
        created = 0
        updated = 0

        for index, row in df.iterrows():
            try:
                # Clean and validate data
                prospect_data = {
                    'name': str(row.get('name', '')).strip(),
                    'company_name': str(row.get('company_name', '')).strip() or None,
                    'email': str(row.get('email', '')).strip().lower() or None,
                    'phone': str(row.get('phone', '')).strip() or None,
                    'address': str(row.get('address', '')).strip() or None,
                    'potential_revenue': float(row.get('potential_revenue', 0) or 0),
                    'contact_person': str(row.get('contact_person', '')).strip() or None,
                    'source': str(row.get('source', '')).strip() or None,
                    'notes': str(row.get('notes', '')).strip() or None,
                    'status': str(row.get('status', 'new')).strip() or 'new',
                }

                # Validate required fields
                if not prospect_data['name']:
                    errors.append(f'Row {index + 2}: Name is required')
                    continue

                # Parse follow_up_date if provided
                follow_up_date = None
                if row.get('follow_up_date'):
                    try:
                        follow_up_date = pd.to_datetime(row.get('follow_up_date')).date()
                    except:
                        pass

                # Parse kam if provided (by ID, username or email)
                kam = user  # Default to current user
                if row.get('kam'):
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    kam_identifier = str(row.get('kam', '')).strip()
                    # Try to find by ID first
                    try:
                        kam_id = int(kam_identifier)
                        found_user = User.objects.filter(id=kam_id).first()
                        if found_user:
                            kam = found_user
                        else:
                            errors.append(f'Row {index + 2}: KAM with ID {kam_id} not found')
                            continue
                    except (ValueError, TypeError):
                        # If not a number, try username or email
                        found_user = User.objects.filter(
                            models.Q(username=kam_identifier) | 
                            models.Q(email=kam_identifier)
                        ).first()
                        if found_user:
                            kam = found_user
                        else:
                            errors.append(f'Row {index + 2}: KAM with identifier "{kam_identifier}" not found')
                            continue

                # Check if prospect exists (by email if provided, otherwise by name+phone)
                prospect = None
                if prospect_data['email']:
                    # Try to find by email first
                    prospect = Prospect.objects.filter(email=prospect_data['email']).first()
                
                if not prospect and prospect_data['phone']:
                    # Try to find by name and phone
                    prospect = Prospect.objects.filter(
                        name=prospect_data['name'],
                        phone=prospect_data['phone']
                    ).first()

                if prospect:
                    # Update existing prospect
                    for key, value in prospect_data.items():
                        setattr(prospect, key, value)
                    if follow_up_date:
                        prospect.follow_up_date = follow_up_date
                    prospect.kam = kam
                    prospect.save()
                    updated += 1
                else:
                    # Create new prospect
                    prospect_data['kam'] = kam
                    if follow_up_date:
                        prospect_data['follow_up_date'] = follow_up_date
                    Prospect.objects.create(**prospect_data)
                    created += 1

                processed += 1

            except Exception as e:
                errors.append(f'Row {index + 2}: {str(e)}')

        return Response({
            'success': len(errors) == 0,
            'processed': processed,
            'created': created,
            'updated': updated,
            'errors': errors
        })


# class ProspectConvertToCustomerView(APIView):
#     """
#     Convert a prospect to a customer when they take service
#     POST /api/customers/prospects/<prospect_id>/convert/
#     Body: {
#         "confirmed": true/false,  # Whether customer confirmed service
#         "link_id": "optional_link_id"
#     }
#     """
#     permission_classes = [permissions.IsAuthenticated, RequirePermissions]
#     required_permissions = ['prospects:update', 'customers:create']
    
#     def post(self, request, prospect_id):
#         try:
#             prospect = Prospect.objects.get(pk=prospect_id)
#         except Prospect.DoesNotExist:
#             return Response(
#                 {'detail': 'Prospect not found'},
#                 status=status.HTTP_404_NOT_FOUND
#             )
        
#         # Get confirmation status and link_id from request
#         confirmed = request.data.get('confirmed', True)  # Default to True
#         link_id = request.data.get('link_id', None)
        
#         # Convert prospect to customer
#         customer = convert_prospect_to_customer(prospect, link_id=link_id)
        
#         if customer:
#             # Update prospect status to qualified and add note
#             old_status = prospect.status
#             if prospect.status != 'qualified':
#                 prospect.status = 'qualified'
#                 prospect.notes = (prospect.notes or '') + f'\n[Converted to Customer on {customer.created_at}]'
#                 prospect.save()
                
#                 # Track status change
#                 ProspectStatusHistory.objects.create(
#                     prospect=prospect,
#                     from_status=old_status,
#                     to_status='qualified',
#                     changed_by=request.user,
#                     notes=f"Converted to customer. Confirmed: {confirmed}"
#                 )
            
#             # Send email notification about confirmation
#             send_prospect_confirmation_email(prospect, confirmed=confirmed, link_id=link_id)
            
#             # Return customer data
#             customer_serializer = CustomerSerializer(customer)
#             return Response({
#                 'success': True,
#                 'message': 'Prospect successfully converted to customer',
#                 'customer': customer_serializer.data,
#                 'prospect_id': prospect.id,
#                 'confirmed': confirmed
#             }, status=status.HTTP_201_CREATED)
#         else:
#             return Response(
#                 {'detail': 'Failed to convert prospect to customer'},
#                 status=status.HTTP_400_BAD_REQUEST
#             )


# class RevenueCalculationView(APIView):
#     permission_classes = [permissions.IsAuthenticated, RequirePermissions]
#     required_permissions = ['reports:read']

#     def get(self, request):
#         # Simple aggregation example; can be extended to weekly/yearly
#         monthly_total = BillRecord.objects.aggregate(total=models.Sum('total_bill'))['total'] or 0
#         weekly_total = monthly_total / 4
#         yearly_total = monthly_total * 12
#         return Response({
#             'monthly': float(monthly_total),
#             'weekly': float(weekly_total),
#             'yearly': float(yearly_total),
#         })



