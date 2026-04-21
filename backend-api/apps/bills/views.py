
from rest_framework import viewsets, generics, permissions, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum, Count, Max, Prefetch
from django.utils import timezone
from django.db import transaction
from datetime import datetime, date, timedelta
from decimal import Decimal

from apps.bills.recalculation_service import recalculate_invoice_totals, compute_invoice_detail_sub_total

from .models import (
    InvoiceMaster,
    InvoiceDetails,
    CustomerEntitlementMaster,
    CustomerEntitlementDetails,
    InvoiceEmailSchedule,
)
from apps.customers.models import CustomerMaster
from apps.package.models import PackageMaster
from .serializers import (
    InvoiceMasterSerializer,
    InvoiceMasterListSerializer,
    InvoiceMasterCreateSerializer,
    InvoiceDetailsSerializer,
    CustomerEntitlementMasterSerializer,
    CustomerEntitlementMasterListSerializer,
    CustomerEntitlementDetailsSerializer,
    BulkEntitlementDetailsCreateSerializer,
    BandwidthEntitlementDetailSerializer,
    ChannelPartnerEntitlementDetailSerializer,
    InvoiceEmailScheduleSerializer,
)
from .dashboard_serializers import DashboardAnalyticsSerializer
from .dashboard_service import DashboardAnalyticsService
from .sales_analytics_service import (
    get_date_range,
    SalesAnalyticsService,
)
from .ledger_service import get_customer_ledger, get_all_customers_ledger_summary
from apps.authentication.permissions import RequirePermissions


class InvoiceMasterViewSet(viewsets.ModelViewSet):
    """Full CRUD for Invoice Master with auto-calculation. Uses limit/offset pagination."""
    queryset = InvoiceMaster.objects.select_related(
        'customer_entitlement_master_id__customer_master_id',
        'information_master_id',
        'created_by'
    ).prefetch_related(
        Prefetch(
            'details',
            queryset=InvoiceDetails.objects.select_related(
                'entitlement_details_id',
                'entitlement_details_id__cust_entitlement_id',
                'entitlement_details_id__package_master_id',
                'entitlement_details_id__package_pricing_id',
                'entitlement_details_id__package_pricing_id__package_master_id',
                'package_master_id',
                'package_pricing_id',
                'package_pricing_id__package_master_id',
            )
        )
    )
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['invoices:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer_entitlement_master_id__customer_master_id']
    search_fields = [
        'invoice_number',
        'customer_entitlement_master_id__bill_number',
        'customer_entitlement_master_id__customer_master_id__customer_name',
        'customer_entitlement_master_id__customer_master_id__company_name',
    ]
    ordering_fields = ['created_at', 'issue_date', 'total_bill_amount']
    
    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action == 'create':
            self.required_permissions = ['invoices:create']
        elif action in ['update', 'partial_update', 'add_details', 'recalculate', 'apply_discount', 'send_email']:
            self.required_permissions = ['invoices:update']
        elif action == 'destroy':
            self.required_permissions = ['invoices:delete']
        elif action in ['auto_generate', 'preview_invoice']:
            self.required_permissions = ['invoices:create']
        else:
            self.required_permissions = ['invoices:read']
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceMasterCreateSerializer
        if self.action == 'list':
            return InvoiceMasterListSerializer
        return InvoiceMasterSerializer
    
    def get_queryset(self):
        qs = self.queryset
        action = getattr(self, 'action', None)
        # Use lighter queryset for list (no prefetch details)
        if action == 'list':
            qs = InvoiceMaster.objects.select_related(
                'customer_entitlement_master_id__customer_master_id',
                'customer_master_id',
            ).order_by('-issue_date', '-id')
        
        customer_id = self.request.query_params.get('customer_id')
        entitlement_id = self.request.query_params.get(
            'entitlement_id'
        ) or self.request.query_params.get('customer_entitlement_master_id')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        customer_name = self.request.query_params.get('customer_name', '').strip()
        company_name = self.request.query_params.get('company_name', '').strip()
        
        if customer_id:
            qs = qs.filter(
                customer_entitlement_master_id__customer_master_id_id=customer_id
            )
        if entitlement_id:
            qs = qs.filter(customer_entitlement_master_id_id=entitlement_id)
        if start_date:
            qs = qs.filter(issue_date__gte=start_date)
        if end_date:
            qs = qs.filter(issue_date__lte=end_date)
        if customer_name:
            qs = qs.filter(
                Q(customer_entitlement_master_id__customer_master_id__customer_name__icontains=customer_name)
                | Q(customer_master_id__customer_name__icontains=customer_name)
            )
        if company_name:
            qs = qs.filter(
                Q(customer_entitlement_master_id__customer_master_id__company_name__icontains=company_name)
                | Q(customer_master_id__company_name__icontains=company_name)
            )
        
        return qs
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def perform_update(self, serializer):
        with transaction.atomic():
            invoice = serializer.save(updated_by=self.request.user)
            recalculate_invoice_totals(invoice)
        # Note: last_bill_invoice_date is only updated when NEW invoices are generated (auto-generate),
        # NOT when updating existing invoices. See generate_invoice_for_entitlement() in utils.py

    def perform_destroy(self, instance):
        """On invoice delete: refresh entitlement; ledger/customer totals recompute from DB."""
        entitlement_ids = set(instance.get_all_entitlement_ids()) if hasattr(instance, 'get_all_entitlement_ids') else set()
        if not entitlement_ids and instance.customer_entitlement_master_id_id:
            entitlement_ids.add(instance.customer_entitlement_master_id_id)
        with transaction.atomic():
            instance.delete()
        if entitlement_ids:
            for entitlement in CustomerEntitlementMaster.objects.filter(id__in=entitlement_ids):
                entitlement.calculate_total_bill()
    
    @action(detail=False, methods=['post'], url_path='auto-generate')
    def auto_generate(self, request):
        """
        Auto-generate invoice from entitlement(s) using the new invoice generation system.
        Supports both single and multiple entitlements.
        
        Request body (single entitlement - backward compatible):
        {
            "entitlement_id": <int>,
            "target_date": "YYYY-MM-DD" (optional, defaults to today),
            "force": <bool> (optional, defaults to false),
            "vat_rate": <float/decimal> (optional),
            "discount_rate": <float/decimal> (optional, e.g. 10 for 10%)
        }
        
        Request body (multiple entitlements):
        {
            "entitlement_ids": [<int>, <int>, ...],
            "target_date": "YYYY-MM-DD" (optional, defaults to today),
            "force": <bool> (optional, defaults to false),
            "vat_rate": <float/decimal> (optional),
            "discount_rate": <float/decimal> (optional, e.g. 10 for 10%)
        }
        """
        from apps.bills.utils import (
            generate_invoice_for_entitlement,
            generate_invoice_for_multiple_entitlements
        )
        
        # Support both old and new parameters
        entitlement_ids = request.data.get('entitlement_ids', [])
        entitlement_id = request.data.get('entitlement_id')
        target_date = request.data.get('target_date', date.today().strftime('%Y-%m-%d'))
        force = request.data.get('force', False)
        vat_rate = request.data.get('vat_rate')
        discount_rate = request.data.get('discount_rate')
        
        # Backward compatibility
        if not entitlement_ids and entitlement_id:
            entitlement_ids = [entitlement_id]
        
        if not entitlement_ids:
            return Response(
                {"error": "entitlement_id or entitlement_ids is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Multiple entitlements
        if len(entitlement_ids) > 1:
            result = generate_invoice_for_multiple_entitlements(
                entitlement_ids=entitlement_ids,
                target_date=target_date,
                force=force,
                vat_rate=vat_rate,
                discount_rate=discount_rate,
                user=request.user
            )
            
            if result.get('success'):
                invoice = result['invoice']
                serializer = InvoiceMasterSerializer(invoice)
                return Response({
                    'success': True,
                    'message': result['message'],
                    'invoice': serializer.data,
                    'calculation': result['calculation']
                }, status=status.HTTP_201_CREATED)
            else:
                return Response(
                    {"error": result.get('error', 'Invoice generation failed')}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Single entitlement (existing logic - backward compatibility)
        try:
            entitlement = CustomerEntitlementMaster.objects.get(pk=entitlement_ids[0])
            
            # Generate invoice using utility function
            result = generate_invoice_for_entitlement(
                entitlement=entitlement,
                target_date=target_date,
                force=force,
                vat_rate=vat_rate,
                discount_rate=discount_rate
            )
            
            if result['success']:
                # Serialize and return the generated invoice
                invoice = result['invoice']
                calculation = result['calculation']
                
                serializer = InvoiceMasterSerializer(invoice)
                
                return Response({
                    'success': True,
                    'message': result['message'],
                    'invoice': serializer.data,
                    'calculation': {
                        'billing_start_date': str(calculation['billing_start_date']),
                        'billing_end_date': str(calculation['billing_end_date']),
                        'total_bill': float(calculation['total_bill']),
                        'total_discount_amount': float(calculation.get('total_discount_amount', 0)),
                        'total_bill_amount': float(calculation.get('total_bill_amount', calculation['total_bill'])),
                        'customer_type': calculation['customer_type'],
                        'details_count': len(calculation['details']),
                        'details': calculation['details']
                    }
                }, status=status.HTTP_201_CREATED)
            else:
                # Invoice generation was skipped or failed
                return Response({
                    'success': False,
                    'message': result['message'],
                    'invoice': InvoiceMasterSerializer(result['invoice']).data if result['invoice'] else None
                }, status=status.HTTP_400_BAD_REQUEST)

        except CustomerEntitlementMaster.DoesNotExist:
            return Response(
                {"error": "Entitlement not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Error generating invoice: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['post'], url_path='preview')
    def preview_invoice(self, request):
        """
        Preview invoice calculation without creating database records.
        Supports both single and multiple entitlements.
        
        Request body (single entitlement - backward compatible):
        {
            "entitlement_id": <int>,
            "target_date": "YYYY-MM-DD" (optional, defaults to today),
            "vat_rate": <float/decimal> (optional),
            "discount_rate": <float/decimal> (optional, e.g. 10 for 10%)
        }
        
        Request body (multiple entitlements):
        {
            "entitlement_ids": [<int>, <int>, ...],
            "target_date": "YYYY-MM-DD" (optional, defaults to today),
            "vat_rate": <float/decimal> (optional),
            "discount_rate": <float/decimal> (optional, e.g. 10 for 10%)
        }
        """
        from apps.bills.utils import (
            calculate_bw_customer_bill,
            calculate_mac_customer_bill,
            get_billing_start_date,
            preview_invoice_for_multiple_entitlements
        )
        from apps.utility.models import UtilityInformationMaster
        
        # Support both old and new parameters
        entitlement_ids = request.data.get('entitlement_ids', [])
        entitlement_id = request.data.get('entitlement_id')
        target_date = request.data.get('target_date', date.today().strftime('%Y-%m-%d'))
        vat_rate_param = request.data.get('vat_rate')
        discount_rate_param = request.data.get('discount_rate')
        
        # Backward compatibility: convert single entitlement_id to array
        if not entitlement_ids and entitlement_id:
            entitlement_ids = [entitlement_id]
        
        if not entitlement_ids:
            return Response(
                {"error": "entitlement_id or entitlement_ids is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Multiple entitlements
        if len(entitlement_ids) > 1:
            result = preview_invoice_for_multiple_entitlements(
                entitlement_ids, 
                target_date, 
                vat_rate_param
            )
            if result.get('success'):
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(
                    {"error": result.get('error', 'Preview calculation failed')}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Single entitlement (existing logic - backward compatibility)
        try:
            entitlement = CustomerEntitlementMaster.objects.get(pk=entitlement_ids[0])
            customer = entitlement.customer_master_id
            customer_type = customer.customer_type
            
            # Calculate bill based on customer type (without creating invoice)
            if customer_type == 'bw':
                calculation = calculate_bw_customer_bill(entitlement, target_date)
            elif customer_type == 'channel_partner':
                calculation = calculate_mac_customer_bill(entitlement, target_date)
            else:
                return Response(
                    {"error": f"Unknown customer type: {customer_type}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Determine VAT rate
            final_vat_rate = Decimal('0')
            if vat_rate_param is not None:
                final_vat_rate = Decimal(str(vat_rate_param))
            else:
                # Try fetch from utility
                utility = UtilityInformationMaster.objects.filter(is_active=True).first()
                if utility and utility.vat_rate:
                    final_vat_rate = utility.vat_rate
            
            total_bill = calculation['total_bill']
            total_vat_amount = total_bill * (final_vat_rate / Decimal('100'))
            final_discount_rate = Decimal(str(discount_rate_param)) if discount_rate_param is not None else Decimal('0')
            total_discount_amount = total_bill * (final_discount_rate / Decimal('100'))
            total_bill_amount = total_bill + total_vat_amount - total_discount_amount
            
            # Return preview data
            return Response({
                'success': True,
                'message': 'Invoice preview calculated successfully',
                'customer': {
                    'id': customer.id,
                    'name': customer.customer_name,
                    'type': customer_type
                },
                'entitlement': CustomerEntitlementMasterSerializer(entitlement).data,
                'calculation': {
                    'billing_start_date': str(calculation['billing_start_date']),
                    'billing_end_date': str(calculation['billing_end_date']),
                    'total_bill': float(total_bill),
                    'vat_rate': float(final_vat_rate),
                    'total_vat_amount': float(total_vat_amount),
                    'discount_rate': float(final_discount_rate),
                    'total_discount_amount': float(total_discount_amount),
                    'total_bill_amount': float(total_bill_amount),
                    'customer_type': calculation['customer_type'],
                    'details_count': len(calculation['details']),
                    'details': calculation['details']
                }
            }, status=status.HTTP_200_OK)

        except CustomerEntitlementMaster.DoesNotExist:
            return Response(
                {"error": "Entitlement not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Error calculating preview: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='add-details')
    def add_details(self, request, pk=None):
        """
        Add new entitlement/bill lines to an existing invoice.

        Request body:
        {
            "entitlement_detail_ids": [1, 2, 3],  # IDs of CustomerEntitlementDetails to add
            "vat_rate": 15,                         # Optional, uses invoice default if not provided
            "discount_rate": 0                      # Optional per-line discount %
        }

        Or add manual lines (not linked to entitlement):
        {
            "lines": [{
                "start_date": "2025-02-01",
                "end_date": "2025-02-28",
                "type": "bw",
                "mbps": 100,
                "unit_price": 10,
                "vat_rate": 15,
                "discount_rate": 0,
                "remarks": "Manual line"
            }]
        }

        Newly added lines are automatically linked and included in recalculation.
        """
        invoice = self.get_object()
        entitlement_detail_ids = request.data.get('entitlement_detail_ids', []) or []
        lines = request.data.get('lines', []) or []
        if not entitlement_detail_ids and not lines:
            return Response(
                {'error': 'Provide entitlement_detail_ids or lines to add'},
                status=status.HTTP_400_BAD_REQUEST
            )
        vat_rate = request.data.get('vat_rate')
        discount_rate = request.data.get('discount_rate', 0)

        from apps.utility.models import UtilityInformationMaster
        utility = invoice.information_master_id
        default_vat = Decimal(str(vat_rate)) if vat_rate is not None else (utility.vat_rate if utility else Decimal('0'))
        default_discount = Decimal(str(discount_rate)) if discount_rate is not None else Decimal('0')

        try:
            with transaction.atomic():
                created_details = []
                entitlement = invoice.customer_entitlement_master_id
                customer_type = entitlement.customer_master_id.customer_type

                for ent_detail_id in entitlement_detail_ids:
                    try:
                        ent_detail = CustomerEntitlementDetails.objects.select_related(
                            'package_pricing_id', 'package_master_id'
                        ).get(id=ent_detail_id)
                    except CustomerEntitlementDetails.DoesNotExist:
                        return Response(
                            {'error': f'Entitlement detail {ent_detail_id} not found'},
                            status=status.HTTP_404_NOT_FOUND
                        )
                    if ent_detail.cust_entitlement_id != entitlement:
                        return Response(
                            {'error': f'Entitlement detail {ent_detail_id} does not belong to this invoice'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    sub_total = compute_invoice_detail_sub_total(ent_detail, invoice)
                    detail = InvoiceDetails.objects.create(
                        invoice_master_id=invoice,
                        entitlement_details_id=ent_detail,
                        sub_total=sub_total,
                        vat_rate=default_vat,
                        sub_discount_rate=default_discount,
                        start_date=ent_detail.start_date,
                        end_date=ent_detail.end_date,
                        type=ent_detail.type,
                        package_pricing_id=ent_detail.package_pricing_id,
                        package_master_id=ent_detail.package_master_id,
                        mbps=ent_detail.mbps,
                        unit_price=ent_detail.unit_price,
                        custom_mac_percentage_share=ent_detail.custom_mac_percentage_share,
                        remarks=ent_detail.remarks or ''
                    )
                    created_details.append(detail)

                for line_data in lines:
                    if not line_data.get('start_date'):
                        return Response(
                            {'error': 'Each manual line requires start_date'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    line_vat = Decimal(str(line_data.get('vat_rate', default_vat)))
                    line_discount = Decimal(str(line_data.get('discount_rate', default_discount)))
                    line_type = line_data.get('type', customer_type)
                    start_d = line_data.get('start_date')
                    end_d = line_data.get('end_date')
                    if isinstance(start_d, str):
                        start_d = datetime.strptime(start_d, '%Y-%m-%d').date()
                    if end_d and isinstance(end_d, str):
                        end_d = datetime.strptime(end_d, '%Y-%m-%d').date()
                    pkg_master = None
                    pkg_id = line_data.get('package_master_id')
                    if pkg_id is not None:
                        try:
                            pkg_master = PackageMaster.objects.get(pk=int(pkg_id))
                        except (PackageMaster.DoesNotExist, ValueError, TypeError):
                            return Response(
                                {'error': f'Invalid or missing package_master_id: {pkg_id}'},
                                status=status.HTTP_400_BAD_REQUEST
                            )
                    validated = {
                        'invoice_master_id': invoice,
                        'start_date': start_d,
                        'end_date': end_d,
                        'type': line_type,
                        'mbps': Decimal(str(line_data['mbps'])) if line_data.get('mbps') is not None else None,
                        'unit_price': Decimal(str(line_data['unit_price'])) if line_data.get('unit_price') is not None else None,
                        'vat_rate': line_vat,
                        'sub_discount_rate': line_discount,
                        'remarks': line_data.get('remarks', ''),
                        'package_pricing_id': line_data.get('package_pricing_id'),
                        'package_master_id': pkg_master,
                        'custom_mac_percentage_share': Decimal(str(line_data['custom_mac_percentage_share'])) if line_data.get('custom_mac_percentage_share') is not None else None,
                    }
                    sub_total = compute_invoice_detail_sub_total(validated, invoice)
                    validated['sub_total'] = sub_total
                    create_kw = {k: v for k, v in validated.items() if v is not None or k in ('remarks', 'sub_discount_rate')}
                    detail = InvoiceDetails.objects.create(**create_kw)
                    created_details.append(detail)

                recalculate_invoice_totals(invoice)
                serializer = InvoiceDetailsSerializer(created_details, many=True)
                return Response({
                    'success': True,
                    'message': f'Added {len(created_details)} line(s) to invoice',
                    'details': serializer.data,
                    'invoice': InvoiceMasterSerializer(invoice).data
                }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'], url_path='recalculate')
    def recalculate(self, request, pk=None):
        """Manually trigger full recalculation of invoice totals."""
        invoice = self.get_object()
        with transaction.atomic():
            recalculate_invoice_totals(invoice)
        return Response({
            'success': True,
            'message': 'Invoice recalculated',
            'invoice': InvoiceMasterSerializer(invoice).data
        })

    @action(detail=True, methods=['post'], url_path='apply-discount')
    def apply_discount(self, request, pk=None):
        """Apply a fixed discount amount across all invoice details."""
        invoice = self.get_object()
        try:
            discount_amount = Decimal(str(request.data.get('discount_amount', 0)))
        except Exception:
            return Response({'error': 'Invalid discount_amount'}, status=status.HTTP_400_BAD_REQUEST)

        if discount_amount < 0:
            return Response({'error': 'discount_amount must be >= 0'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            details = InvoiceDetails.objects.filter(invoice_master_id=invoice)
            subtotal = details.aggregate(total=Sum('sub_total'))['total'] or Decimal('0')
            if subtotal <= 0:
                return Response({'error': 'Invoice subtotal is 0, cannot apply discount.'}, status=status.HTTP_400_BAD_REQUEST)

            discount_rate = (discount_amount / subtotal) * Decimal('100')
            if discount_rate > 100:
                discount_rate = Decimal('100')

            details.update(sub_discount_rate=discount_rate)
            recalculate_invoice_totals(invoice)
            invoice.refresh_from_db()

        return Response({
            'success': True,
            'invoice': InvoiceMasterSerializer(invoice).data,
        })

    @action(detail=True, methods=['post'], url_path='send-email')
    def send_email(self, request, pk=None):
        """Send invoice as PDF attachment via email."""
        invoice = self.get_object()
        email_addr = request.data.get('email', '').strip()
        pdf_base64 = request.data.get('pdf_base64', '')
        filename = request.data.get('filename', '').strip()

        if not email_addr or '@' not in email_addr:
            return Response(
                {'error': 'Valid recipient email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not pdf_base64:
            return Response(
                {'error': 'PDF content (pdf_base64) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.customers.email_service import send_invoice_email

        customer = (
            invoice.customer_entitlement_master_id.customer_master_id
            if invoice.customer_entitlement_master_id
            else invoice.customer_master_id
        )
        customer_name = customer.customer_name if customer else None

        if send_invoice_email(email_addr, invoice.invoice_number or f'INV-{invoice.id}', pdf_base64, customer_name, filename=filename or None):
            return Response({
                'success': True,
                'message': f'Invoice sent to {email_addr}',
            })
        return Response(
            {'error': 'Failed to send email. Please check server email configuration.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get invoice history with filters"""
        customer_id = request.query_params.get('customer_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        period = request.query_params.get('period')  # 'monthly', 'weekly', etc.
        
        queryset = self.get_queryset()
        
        if customer_id:
            queryset = queryset.filter(
                customer_entitlement_master_id__customer_master_id_id=customer_id
            )
        
        if period == 'monthly':
            # Get current month
            today = date.today()
            start_date = date(today.year, today.month, 1)
            end_date = today
        elif period == 'weekly':
            # Get current week
            today = date.today()
            start_date = today - timedelta(days=today.weekday())
            end_date = today
        
        if start_date:
            queryset = queryset.filter(issue_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(issue_date__lte=end_date)
        
        serializer = self.get_serializer(queryset.order_by('-issue_date'), many=True)
        
        # Calculate totals
        totals = queryset.aggregate(
            total_billed=Sum('total_bill_amount'),
            total_paid=Sum('total_paid_amount'),
            total_due=Sum('total_balance_due')
        )
        
        return Response({
            'invoices': serializer.data,
            'count': queryset.count(),
            'totals': {
                'total_billed': float(totals['total_billed'] or Decimal('0')),
                'total_paid': float(totals['total_paid'] or Decimal('0')),
                'total_due': float(totals['total_due'] or Decimal('0')),
            }
        })
    
    @action(detail=False, methods=['get'])
    def billing_period_history(self, request):
        """
        Get detailed billing period history for a customer.
        Shows each invoice with its billing period, package details, and amounts.
        Particularly useful for BW/MAC customers with date-wise billing.
        """
        customer_id = request.query_params.get('customer_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not customer_id:
            return Response(
                {'error': 'customer_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all invoices for the customer
        queryset = self.get_queryset().filter(
            customer_entitlement_master_id__customer_master_id_id=customer_id
        )
        
        if start_date:
            queryset = queryset.filter(issue_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(issue_date__lte=end_date)
        
        queryset = queryset.order_by('-issue_date')
        
        # Build detailed history
        billing_history = []
        
        for invoice in queryset:
            # Get entitlement details for this invoice
            invoice_details = invoice.details.all().select_related(
                'entitlement_details_id',
                'entitlement_details_id__package_pricing_id',
                'entitlement_details_id__package_pricing_id__package_master_id'
            )
            
            # Collect billing periods from entitlement details
            periods = []
            for detail in invoice_details:
                ent_detail = detail.entitlement_details_id
                if ent_detail:
                    period_info = {
                        'billing_period_start': ent_detail.start_date,
                        'billing_period_end': ent_detail.end_date,
                        'type': ent_detail.type,
                        'package_name': ent_detail.package_master_id.package_name if ent_detail.package_master_id.package_name else None,
                        'mbps': float(ent_detail.mbps) if ent_detail.mbps else None,
                        'unit_price': float(ent_detail.unit_price) if ent_detail.unit_price else None,
                        'line_total': float(detail.sub_total),
                        'vat_rate': float(detail.vat_rate),
                        'discount_rate': float(detail.sub_discount_rate),
                    }
                    
                    # Add package name if available
                    if ent_detail.package_pricing_id:
                        period_info['package_name'] = ent_detail.package_pricing_id.package_master_id.package_name
                        period_info['package_rate'] = float(ent_detail.package_pricing_id.rate) if ent_detail.package_pricing_id.rate else None
                    
                    # Add bandwidth type for BW customers
                    if ent_detail.type == 'bw' and ent_detail.remarks:
                        for bw_type in ['IPT', 'GCC', 'CDN', 'NIX', 'BAISHAN']:
                            if ent_detail.remarks.upper().startswith(bw_type):
                                period_info['bandwidth_type'] = bw_type.lower()
                                break
                    
                    periods.append(period_info)
            
            # Get earliest start and latest end from all periods
            earliest_start = min([p['billing_period_start'] for p in periods]) if periods else None
            latest_end = max([p['billing_period_end'] for p in periods]) if periods else None
            
            billing_history.append({
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'issue_date': invoice.issue_date,
                'overall_billing_period': {
                    'start': earliest_start,
                    'end': latest_end
                },
                'periods': periods,
                'total_bill_amount': float(invoice.total_bill_amount),
                'total_paid_amount': float(invoice.total_paid_amount),
                'total_balance_due': float(invoice.total_balance_due),
                'total_vat_amount': float(invoice.total_vat_amount),
                'total_discount_amount': float(invoice.total_discount_amount),
                'status': invoice.status,
            })
        
        # Calculate summary
        total_invoices = queryset.count()
        totals = queryset.aggregate(
            total_billed=Sum('total_bill_amount'),
            total_paid=Sum('total_paid_amount'),
            total_due=Sum('total_balance_due')
        )
        
        return Response({
            'billing_history': billing_history,
            'summary': {
                'customer_id': int(customer_id),
                'total_invoices': total_invoices,
                'total_billed': float(totals['total_billed'] or Decimal('0')),
                'total_paid': float(totals['total_paid'] or Decimal('0')),
                'total_due': float(totals['total_due'] or Decimal('0')),
                'date_range': {
                    'start': start_date,
                    'end': end_date
                }
            }
        })


class InvoiceDetailsViewSet(viewsets.ModelViewSet):
    """Full CRUD for Invoice Details"""
    queryset = InvoiceDetails.objects.select_related(
        'invoice_master_id', 'entitlement_details_id'
    )
    serializer_class = InvoiceDetailsSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['invoices:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['invoice_master_id']
    
    def get_serializer_class(self):
        if self.action == 'create':
            self.required_permissions = ['invoices:create']
        elif self.action in ['update', 'partial_update']:
            self.required_permissions = ['invoices:update']
        elif self.action == 'destroy':
            self.required_permissions = ['invoices:delete']
        return InvoiceDetailsSerializer
    
    def perform_create(self, serializer):
        with transaction.atomic():
            detail = serializer.save()
            recalculate_invoice_totals(detail.invoice_master_id)

    def perform_update(self, serializer):
        with transaction.atomic():
            detail = serializer.save()
            recalculate_invoice_totals(detail.invoice_master_id)

    def perform_destroy(self, instance):
        invoice = instance.invoice_master_id
        with transaction.atomic():
            instance.delete()
            recalculate_invoice_totals(invoice)


# ==================== Customer Entitlement Master Views ====================

class CustomerEntitlementMasterViewSet(viewsets.ModelViewSet):
    """Full CRUD for Customer Entitlement Master. Uses limit/offset pagination."""
    queryset = CustomerEntitlementMaster.objects.select_related(
        'customer_master_id', 'created_by'
    ).prefetch_related(
        Prefetch(
            'details',
            queryset=CustomerEntitlementDetails.objects.select_related(
                'package_master_id', 'package_pricing_id',
                'package_pricing_id__package_master_id',
            ).order_by('start_date')
        )
    )
    serializer_class = CustomerEntitlementMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['entitlements:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer_master_id', 'activation_date', 'customer_master_id__customer_type']
    search_fields = [
        'bill_number',
        'customer_master_id__customer_name',
        'customer_master_id__company_name',
    ]
    ordering_fields = ['created_at', 'activation_date', 'bill_number']
    
    def get_queryset(self):
        qs = self.queryset
        if self.action == 'list' and self.request.query_params.get('minimal') == '1':
            qs = CustomerEntitlementMaster.objects.select_related(
                'customer_master_id'
            ).order_by('bill_number')
        # Server-side filters for entitlements list
        status = self.request.query_params.get('status')
        customer_type = self.request.query_params.get('customer_type')
        month = self.request.query_params.get('month')
        exclude_invoiced = self.request.query_params.get('exclude_invoiced')

        if customer_type:
            qs = qs.filter(customer_master_id__customer_type=customer_type)

        if status:
            qs = qs.filter(details__status__iexact=status).distinct()

        if month:
            try:
                month_num = int(month)
                if 1 <= month_num <= 12:
                    qs = qs.filter(activation_date__month=month_num)
            except ValueError:
                pass
        if exclude_invoiced in ['1', 'true', 'True']:
            qs = qs.filter(invoices__isnull=True).distinct()
        return qs
    
    def get_serializer_class(self):
        if self.action == 'create':
            self.required_permissions = ['entitlements:create']
        elif self.action in ['update', 'partial_update']:
            self.required_permissions = ['entitlements:update']
        elif self.action == 'destroy':
            self.required_permissions = ['entitlements:delete']
        if self.action == 'list' and self.request.query_params.get('minimal') == '1':
            return CustomerEntitlementMasterListSerializer
        return CustomerEntitlementMasterSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
        # Note: last_bill_invoice_date is only updated when invoices are auto-generated,
        # NOT when updating entitlements. See generate_invoice_for_entitlement() in utils.py
    
    @action(detail=True, methods=['get', 'post'])
    def details(self, request, pk=None):
        """Get or create entitlement details"""
        entitlement = self.get_object()
        
        if request.method == 'GET':
            details = entitlement.details.all()
            serializer = CustomerEntitlementDetailsSerializer(details, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Handle bulk creation of details
            serializer = BulkEntitlementDetailsCreateSerializer(data=request.data)
            if serializer.is_valid():
                entitlement_id = serializer.validated_data['entitlement_master_id']
                entitlement = CustomerEntitlementMaster.objects.get(id=entitlement_id)
                customer = entitlement.customer_master_id
                created_details = []
                
                # Create bandwidth details
                if 'bandwidth_details' in serializer.validated_data:
                    for detail_data in serializer.validated_data['bandwidth_details']:
                        bandwidth_type = detail_data.get('bandwidth_type', 'ipt')
                        remarks = f"{bandwidth_type.upper()} - {detail_data.get('remarks', '')}".strip()
                        
                        detail = CustomerEntitlementDetails.objects.create(
                            cust_entitlement_id=entitlement,
                            type='bw',  # Customer type is 'bw' for bandwidth
                            mbps=detail_data['mbps'],
                            unit_price=detail_data['unit_price'],
                            start_date=detail_data['start_date'],
                            end_date=detail_data['end_date'],
                            package_master_id_id=detail_data.get('package_master_id'),
                            is_active=detail_data.get('is_active', True),
                            status=detail_data.get('status', 'active'),
                            remarks=remarks,  # Store bandwidth type (ipt, gcc, etc.) in remarks
                            created_by=request.user
                        )
                        created_details.append(detail)
                
                # Create channel partner details
                if 'channel_partner_details' in serializer.validated_data:
                    for detail_data in serializer.validated_data['channel_partner_details']:
                        detail = CustomerEntitlementDetails.objects.create(
                            cust_entitlement_id=entitlement,
                            type='channel_partner',
                            mbps=detail_data['mbps'],
                            unit_price=detail_data['unit_price'],
                            custom_mac_percentage_share=detail_data['custom_mac_percentage_share'],
                            start_date=detail_data['start_date'],
                            end_date=detail_data['end_date'],
                            package_master_id_id=detail_data.get('package_master_id'),
                            is_active=detail_data.get('is_active', True),
                            status=detail_data.get('status', 'active'),
                            created_by=request.user
                        )
                        created_details.append(detail)
                
                result_serializer = CustomerEntitlementDetailsSerializer(created_details, many=True)
                return Response(result_serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ==================== Customer Entitlement Details Views ====================

class CustomerEntitlementDetailsViewSet(viewsets.ModelViewSet):
    """Full CRUD for Customer Entitlement Details"""
    queryset = CustomerEntitlementDetails.objects.select_related(
        'cust_entitlement_id', 'package_pricing_id', 'package_master_id', 'created_by'
    )
    serializer_class = CustomerEntitlementDetailsSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['entitlement_details:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['cust_entitlement_id', 'type', 'status', 'is_active']
    search_fields = ['cust_entitlement_id__bill_number']
    ordering_fields = ['created_at', 'start_date', 'end_date']
    
    def get_serializer_class(self):
        if self.action == 'create':
            self.required_permissions = ['entitlement_details:create']
        elif self.action in ['update', 'partial_update']:
            self.required_permissions = ['entitlement_details:update']
        elif self.action == 'destroy':
            self.required_permissions = ['entitlement_details:delete']
        return CustomerEntitlementDetailsSerializer
    
    def perform_create(self, serializer):
        """
        Create new entitlement detail.
        If mbps value is different from the latest active detail for the same entitlement,
        automatically close the previous detail by setting its end_date.
        """
        from datetime import timedelta
        
        # Get the entitlement and new detail data
        entitlement = serializer.validated_data.get('cust_entitlement_id')
        detail_type = serializer.validated_data.get('type')
        new_mbps = serializer.validated_data.get('mbps')
        new_start_date = serializer.validated_data.get('start_date')
        new_package_master = serializer.validated_data.get('package_master_id')
        new_package_pricing = serializer.validated_data.get('package_pricing_id')
        
        if entitlement and new_start_date and new_mbps is not None:
            # Get the latest active detail for the same package type
            # Compare by package_master_id
            filter_kwargs = {
                'cust_entitlement_id': entitlement,
                'is_active': True,
                'status': 'active',
                'end_date__isnull': True  # Only open-ended details
            }
            
            filter_kwargs['package_master_id'] = new_package_master
            
            latest_detail = CustomerEntitlementDetails.objects.filter(**filter_kwargs).order_by('-start_date').first()
            
            # If there's a previous detail with different mbps, close it
            if latest_detail and latest_detail.mbps != new_mbps:
                # Set end_date to day before new start_date to avoid overlap
                if new_start_date > latest_detail.start_date:
                    latest_detail.end_date = new_start_date - timedelta(days=1)
                    latest_detail.last_changes_updated_date = date.today()
                    latest_detail.save(update_fields=['end_date', 'last_changes_updated_date'])
        
        # Save the new detail
        detail = serializer.save(created_by=self.request.user)
        detail.last_changes_updated_date = date.today()
        detail.save(update_fields=['last_changes_updated_date'])
        
        # Note: total_bill will be calculated during invoice generation
        # Calling calculate_total_bill() here causes recursion issues
    
    def perform_update(self, serializer):
        """
        Update entitlement detail.
        If updating the current active record (end_date is null) with significant changes,
        create a new record and close the old one.
        If updating an inactive record or making minor changes, just update the existing record.

        Key behaviors:
        - Only closes and creates new record if the detail being updated is currently active (end_date=null)
        - Preserves complete package change history
        - Does NOT expire status if customer has unpaid amounts
        - Updates last_changes_updated_date field
        
        Significant changes that trigger new record creation:
        - start_date changes
        - mbps changes
        - unit_price changes
        - package_master_id changes (BW/MAC customers)
        - custom_mac_percentage_share changes (Channel Partners)
        """
        old_detail = self.get_object()

        # Check if this is a significant change (package or pricing change)
        is_package_change = False

        # Check for package_master_id changes (for BW/MAC customers)
        if 'package_master_id' in serializer.validated_data:
            if old_detail.package_master_id != serializer.validated_data.get('package_master_id'):
                is_package_change = True

        # Check for mbps or unit_price changes (for BW/MAC customers)
        if 'mbps' in serializer.validated_data or 'unit_price' in serializer.validated_data:
            if (old_detail.mbps != serializer.validated_data.get('mbps', old_detail.mbps) or
                old_detail.unit_price != serializer.validated_data.get('unit_price', old_detail.unit_price)):
                is_package_change = True

        # Check for custom_mac_percentage_share changes (for Channel Partners)
        if 'custom_mac_percentage_share' in serializer.validated_data:
            if old_detail.custom_mac_percentage_share != serializer.validated_data.get('custom_mac_percentage_share', old_detail.custom_mac_percentage_share):
                is_package_change = True

        # Check for start_date changes - this should trigger a new record creation
        if 'start_date' in serializer.validated_data:
            if old_detail.start_date != serializer.validated_data.get('start_date'):
                is_package_change = True

        # Only create new record if this is the current active detail and there are significant changes
        if is_package_change and old_detail.end_date is None:
            from datetime import timedelta

            # Get start_date from request, or default to today
            new_start_date = serializer.validated_data.get('start_date', date.today())

            # Calculate end_date for old record: day before new start_date
            old_end_date = new_start_date - timedelta(days=1)

            # Close the current active record
            old_detail.end_date = old_end_date
            old_detail.last_changes_updated_date = date.today()
            old_detail.save(update_fields=['end_date', 'last_changes_updated_date'])

            # Create new record with updated data
            new_data = serializer.validated_data.copy()
            new_data['cust_entitlement_id'] = old_detail.cust_entitlement_id
            new_data['type'] = old_detail.type
            new_data['start_date'] = new_start_date

            if 'end_date' not in new_data:
                # When upgrading/changing package, default to open-ended (None)
                # unless a specific end_date is provided in the request.
                new_data['end_date'] = None

            new_data['is_active'] = True
            new_data['status'] = 'active'
            new_data['created_by'] = self.request.user
            new_data['last_changes_updated_date'] = date.today()

            # Add change tracking in remarks
            old_package_info = ""
            if old_detail.package_master_id:
                old_package_info = f"Package: {old_detail.package_master_id.package_name}"
            else:
                # Fallback if neither exists
                old_package_info = f"Mbps: {old_detail.mbps}, Price: {old_detail.unit_price}"

            change_note = f"Changed from {old_package_info} on {new_start_date}"
            if 'remarks' in new_data:
                new_data['remarks'] = f"{change_note}. {new_data['remarks']}"
            else:
                new_data['remarks'] = change_note

            # Create new entitlement detail
            new_detail = CustomerEntitlementDetails.objects.create(**new_data)

            # Update serializer instance to the new record
            serializer._instance = new_detail
        else:
            # Minor update or updating an inactive record, just update the existing record
            serializer.save(updated_by=self.request.user)
            detail = serializer.instance
            detail.last_changes_updated_date = date.today()
            detail.save(update_fields=['last_changes_updated_date', 'updated_at'])
    
    @action(detail=False, methods=['get'])
    def bandwidth_types(self, request):
        """Get all bandwidth entitlement details grouped by bandwidth type (ipt, gcc, cdn, nix, baishan)"""
        customer_id = request.query_params.get('customer_id')
        queryset = self.get_queryset().filter(
            type='bw',
            is_active=True
        )
        
        if customer_id:
            queryset = queryset.filter(
                cust_entitlement_id__customer_master_id_id=customer_id
            )
        
        # Group by bandwidth type extracted from remarks
        result = {
            'ipt': [],
            'gcc': [],
            'cdn': [],
            'nix': [],
            'baishan': [],
            'other': []
        }
        
        for detail in queryset:
            serializer = CustomerEntitlementDetailsSerializer(detail)
            data = serializer.data
            bw_type = data.get('bandwidth_type', 'other')
            if bw_type in result:
                result[bw_type].append(data)
            else:
                result['other'].append(data)
        
        return Response(result)
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get entitlement details history with date range"""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        customer_id = request.query_params.get('customer_id')
        
        queryset = self.get_queryset()
        
        if customer_id:
            queryset = queryset.filter(
                cust_entitlement_id__customer_master_id_id=customer_id
            )
        
        if start_date:
            queryset = queryset.filter(start_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(end_date__lte=end_date)
        
        serializer = self.get_serializer(queryset.order_by('-created_at'), many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def package_change_history(self, request):
        """
        Get complete package/service change history for a customer.
        Shows timeline of all package changes including expired entitlements.
        """
        customer_id = request.query_params.get('customer_id')
        entitlement_id = request.query_params.get('entitlement_id')
        
        if not customer_id and not entitlement_id:
            return Response(
                {'error': 'Either customer_id or entitlement_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        queryset = self.get_queryset()
        
        if customer_id:
            queryset = queryset.filter(
                cust_entitlement_id__customer_master_id_id=customer_id
            )
        
        if entitlement_id:
            queryset = queryset.filter(cust_entitlement_id_id=entitlement_id)
        
        # Order by start_date to show timeline
        queryset = queryset.order_by('start_date', 'created_at')
        
        # Group by type for better organization
        history_by_type = {
            'bw': [],
            'channel_partner': [],
        }
        
        for detail in queryset:
            serializer = CustomerEntitlementDetailsSerializer(detail)
            data = serializer.data
            
            # Add additional context
            data['is_current'] = detail.is_active and detail.status == 'active'
            data['change_type'] = 'expired' if detail.status == 'expired' else 'active'
            
            if detail.type in history_by_type:
                history_by_type[detail.type].append(data)
        
        # Calculate summary statistics
        total_changes = queryset.count()
        active_count = queryset.filter(is_active=True, status='active').count()
        expired_count = queryset.filter(status='expired').count()
        
        return Response({
            'history': history_by_type,
            'summary': {
                'total_records': total_changes,
                'active': active_count,
                'expired': expired_count,
                'customer_id': customer_id,
                'entitlement_id': entitlement_id
            }
        })


# ==================== Add Entitlement Detail View ====================

class AddEntitlementDetailView(generics.CreateAPIView):
    """
    Custom API endpoint to add/create OR update a single entitlement detail.
    
    POST /api/add/entitlements/details
    
    CREATE Mode (when 'id' is NOT provided):
    - Creates a new entitlement detail
    - All required fields must be provided
    
    UPDATE Mode (when 'id' IS provided):
    - Updates an existing entitlement detail
    - Only provide fields you want to update
    - Useful for correcting wrong input values
    
    Features:
    - Accepts negative mbps values (for quantity reductions)
    - Accepts zero mbps and unit_price
    - Each entry is independent - does NOT automatically close previous records
    - End dates should only be set during invoice generation
    - Validates customer type matches entitlement
    - Creates historical records for cumulative Mbps tracking
    
    CREATE - Required Fields:
    - start_date: Start date for this detail
    - type: Customer type (bw, channel_partner, soho)
    - cust_entitlement_id: Entitlement master ID
    - mbps: Bandwidth in Mbps (can be negative or zero)
    - unit_price: Price per unit (can be zero)
    
    UPDATE - Required Fields:
    - id: Entitlement detail ID to update
    
    Optional Fields (for both CREATE and UPDATE):
    - package_master_id: Package master reference (for BW/MAC)
    - package_pricing_id: Package pricing reference
    - status: Status (active, inactive, expired)
    - is_active: Active flag
    - end_date: End date
    - custom_mac_percentage_share: For channel_partner type
    - remarks: Additional notes
    
    Example CREATE Request:
    {
        "start_date": "2025-12-01",
        "type": "bw",
        "cust_entitlement_id": 383,
        "mbps": 10,
        "unit_price": 10,
        "is_active": true,
        "status": "active",
        "package_master_id": 28
    }
    
    Example UPDATE Request (Fix wrong mbps value):
    {
        "id": 123,
        "mbps": 20,
        "unit_price": 15,
        "start_date": "2025-12-02"
    }
    
    Example Response:
    {
        "success": true,
        "message": "Entitlement detail created successfully",
        "data": {
            "id": 123,
            "cust_entitlement_id": 383,
            "mbps": "10.00",
            "unit_price": "10.00",
            ...
        }
    }
    """
    from apps.bills.serializers import AddEntitlementDetailSerializer
    
    serializer_class = AddEntitlementDetailSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['entitlement_details:create']

    def get_permissions(self):
        if self.request.method == 'POST' and self.request.data.get('id'):
            self.required_permissions = ['entitlement_details:update']
        else:
            self.required_permissions = ['entitlement_details:create']
        return super().get_permissions()
    
    def post(self, request, *args, **kwargs):
        """Handle POST request to add or update entitlement detail"""
        serializer = self.get_serializer(data=request.data)
        
        if serializer.is_valid():
            detail = serializer.save()
            
            # Determine if this was create or update
            is_update = 'id' in request.data and request.data['id'] is not None
            action = "updated" if is_update else "created"
            
            # Return the created/updated detail using CustomerEntitlementDetailsSerializer for consistency
            from apps.bills.serializers import CustomerEntitlementDetailsSerializer
            response_serializer = CustomerEntitlementDetailsSerializer(detail)
            
            return Response({
                'success': True,
                'message': f'Entitlement detail {action} successfully',
                'data': response_serializer.data
            }, status=status.HTTP_201_CREATED if not is_update else status.HTTP_200_OK)
        
        return Response({
            'success': False,
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class DashboardAnalyticsView(generics.GenericAPIView):
    """
    Comprehensive Dashboard Analytics API
    Returns all sales analytics metrics in a single response
    
    Query Parameters:
    - custom_start_date: Custom date range start (YYYY-MM-DD)
    - custom_end_date: Custom date range end (YYYY-MM-DD)
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DashboardAnalyticsSerializer
    
    def get_serializer(self, *args, **kwargs):
        if getattr(self, 'swagger_fake_view', False):
            # Short-circuit for schema generation
            return None
        return super().get_serializer(*args, **kwargs)
    
    def get(self, request):
        """Get complete dashboard analytics"""
        # Get custom date range from query params if provided
        custom_start = request.query_params.get('custom_start_date')
        custom_end = request.query_params.get('custom_end_date')
        
        # Parse custom dates if provided
        try:
            if custom_start:
                custom_start = datetime.strptime(custom_start, '%Y-%m-%d').date()
            if custom_end:
                custom_end = datetime.strptime(custom_end, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get analytics
        service = DashboardAnalyticsService(
            custom_start=custom_start,
            custom_end=custom_end
        )
        analytics_data = service.get_complete_dashboard_analytics()
        
        # Serialize response
        serializer = DashboardAnalyticsSerializer(analytics_data)
        
        return Response(serializer.data, status=status.HTTP_200_OK)


def _parse_sales_analytics_params(request):
    """Shared query parsing for sales analytics and export."""
    period = request.query_params.get('period', 'monthly')
    from_date_s = request.query_params.get('from_date')
    to_date_s = request.query_params.get('to_date')
    kam_id = request.query_params.get('kam_id')
    customer_id = request.query_params.get('customer_id')
    kam_drill = request.query_params.get('kam_drill')

    from_date, to_date = None, None
    if from_date_s:
        try:
            from_date = datetime.strptime(from_date_s, '%Y-%m-%d').date()
        except ValueError:
            return None, Response(
                {'error': 'from_date must be YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
    if to_date_s:
        try:
            to_date = datetime.strptime(to_date_s, '%Y-%m-%d').date()
        except ValueError:
            return None, Response(
                {'error': 'to_date must be YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

    start_date, end_date = get_date_range(period=period, from_date=from_date, to_date=to_date)
    if not start_date or not end_date:
        return None, Response(
            {
                'error': 'Invalid date range. Use period=weekly|biweekly|monthly|quarterly|yearly|custom. '
                'For custom, provide from_date and to_date (YYYY-MM-DD).'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    kam_id_int = None
    if kam_id:
        try:
            kam_id_int = int(kam_id)
        except (TypeError, ValueError):
            pass
    customer_id_int = None
    if customer_id:
        try:
            customer_id_int = int(customer_id)
        except (TypeError, ValueError):
            pass
    kam_drill_int = None
    if kam_drill:
        try:
            kam_drill_int = int(kam_drill)
        except (TypeError, ValueError):
            pass

    service = SalesAnalyticsService(
        start_date=start_date,
        end_date=end_date,
        kam_id=kam_id_int,
        customer_id=customer_id_int,
    )
    return {
        'period': period,
        'service': service,
        'kam_drill_int': kam_drill_int,
    }, None


class CustomerLedgerReportView(APIView):
    """
    Customer Invoice Ledger Report (individual customer).
    Returns invoice and payment ledger with running balance for a selected customer.
    Query params: from_date (YYYY-MM-DD), to_date (YYYY-MM-DD).
    """
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['invoices:read']

    def get(self, request, customer_id):
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        from_d = None
        to_d = None
        if from_date:
            try:
                from_d = datetime.strptime(from_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'from_date must be YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if to_date:
            try:
                to_d = datetime.strptime(to_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'to_date must be YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if from_d and to_d and from_d > to_d:
            return Response(
                {'error': 'from_date must be before or equal to to_date'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = get_customer_ledger(customer_id, from_date=from_d, to_date=to_d)
        if data is None:
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(data, status=status.HTTP_200_OK)


class AllCustomersLedgerSummaryView(APIView):
    """
    All Customers Ledger Summary.
    Returns combined ledger summary for all customers with total bill, total payment, total due.
    Query params: from_date (YYYY-MM-DD), to_date (YYYY-MM-DD).
    """
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['ledger:read']

    def get(self, request):
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        from_d = None
        to_d = None
        if from_date:
            try:
                from_d = datetime.strptime(from_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'from_date must be YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if to_date:
            try:
                to_d = datetime.strptime(to_date, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'to_date must be YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if from_d and to_d and from_d > to_d:
            return Response(
                {'error': 'from_date must be before or equal to to_date'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = get_all_customers_ledger_summary(from_date=from_d, to_date=to_d)
        return Response({'results': data, 'count': len(data)}, status=status.HTTP_200_OK)


class InvoiceEmailScheduleViewSet(viewsets.ModelViewSet):
    """CRUD for invoice email automation schedules."""
    queryset = InvoiceEmailSchedule.objects.select_related('target_customer').all().order_by('name')
    serializer_class = InvoiceEmailScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['invoices:read']
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name', 'created_at']

    def _handle_db_error(self, e):
        from django.db.utils import ProgrammingError, OperationalError
        return Response(
            {
                'error': 'Database setup required',
                'detail': 'The invoice email schedules table does not exist yet. Please run migrations.',
                'fix': 'Run: python manage.py migrate',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    def _is_db_setup_error(self, e):
        try:
            from django.db.utils import ProgrammingError, OperationalError
            if isinstance(e, (ProgrammingError, OperationalError)):
                return True
        except ImportError:
            pass
        msg = str(e).lower()
        return 'does not exist' in msg or ('relation' in msg and 'exist' in msg)

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            if self._is_db_setup_error(e):
                return self._handle_db_error(e)
            raise

    def retrieve(self, request, *args, **kwargs):
        try:
            return super().retrieve(request, *args, **kwargs)
        except Exception as e:
            if self._is_db_setup_error(e):
                return self._handle_db_error(e)
            raise

    def get_permissions(self):
        action_name = getattr(self, 'action', None)
        if action_name in ['create', 'update', 'partial_update', 'destroy', 'run_now']:
            self.required_permissions = ['invoices:update']
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='run-now')
    def run_now(self, request, pk=None):
        """Manually trigger this schedule (for testing)."""
        from apps.bills.management.commands.run_invoice_email_schedule import run_schedule

        schedule = self.get_object()
        result = run_schedule(schedule, dry_run=False)
        return Response({
            'success': True,
            'sent': result['sent'],
            'skipped': result['skipped'],
            'errors': result['errors'],
        })
