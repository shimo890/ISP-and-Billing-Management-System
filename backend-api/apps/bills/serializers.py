from rest_framework import serializers
from django.db import models
from django.utils import timezone
from decimal import Decimal
from datetime import date
from apps.customers.models import CustomerMaster
from .models import (
    CustomerEntitlementMaster,
    CustomerEntitlementDetails,
    InvoiceMaster,
    InvoiceDetails,
    InvoiceEmailSchedule,
)
from apps.customers.serializers import CustomerMasterSerializer


class InvoiceDetailsSerializer(serializers.ModelSerializer):
    entitlement_type = serializers.SerializerMethodField()
    entitlement_package = serializers.SerializerMethodField()
    entitlement_service_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    entitlement_mbps = serializers.SerializerMethodField()
    line_total = serializers.SerializerMethodField()
    zone_name = serializers.SerializerMethodField()
    entitlement_id = serializers.SerializerMethodField()

    # Fields that trigger sub_total recalculation when changed
    RECALC_FIELDS = {
        'mbps', 'unit_price', 'start_date', 'end_date', 'type',
        'package_pricing_id', 'package_master_id',
        'entitlement_details_id'
    }
    ENTITLEMENT_SYNC_FIELDS = {
        'start_date',
        'end_date',
        'type',
        'package_pricing_id',
        'package_master_id',
        'mbps',
        'unit_price',
        'remarks',
    }

    class Meta:
        model = InvoiceDetails
        fields = '__all__'
        read_only_fields = ['created_at']

    def _recompute_sub_total_if_needed(self, instance, validated_data):
        """Recompute sub_total when pricing/period fields change."""
        from apps.bills.recalculation_service import compute_invoice_detail_sub_total

        if not any(k in validated_data for k in self.RECALC_FIELDS):
            return
        # Merge validated data into instance for computation
        for k, v in validated_data.items():
            setattr(instance, k, v)
        new_sub = compute_invoice_detail_sub_total(instance, instance.invoice_master_id)
        instance.sub_total = new_sub
        validated_data['sub_total'] = new_sub

    def _validate_entitlement_link(self, invoice, entitlement_detail):
        """
        Prevent mismatched links between invoice and entitlement detail.
        """
        if not invoice or not entitlement_detail:
            return
        allowed_entitlement_ids = set(invoice.get_all_entitlement_ids())
        if entitlement_detail.cust_entitlement_id_id not in allowed_entitlement_ids:
            raise serializers.ValidationError({
                'entitlement_details_id': (
                    'The selected entitlement detail does not belong to this invoice entitlements.'
                )
            })

    def _sync_invoice_line_to_entitlement_detail(self, invoice_detail):
        """
        Mirror invoice detail edits to linked entitlement detail so both modules stay synchronized.
        """
        entitlement_detail = invoice_detail.entitlement_details_id
        if not entitlement_detail:
            return

        self._validate_entitlement_link(invoice_detail.invoice_master_id, entitlement_detail)

        update_fields = []
        for field in self.ENTITLEMENT_SYNC_FIELDS:
            invoice_value = getattr(invoice_detail, field, None)
            entitlement_value = getattr(entitlement_detail, field, None)
            if invoice_value != entitlement_value:
                setattr(entitlement_detail, field, invoice_value)
                update_fields.append(field)

        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and entitlement_detail.updated_by_id != user.id:
            entitlement_detail.updated_by = user
            update_fields.append('updated_by')

        # Keep change tracking fresh when sync is performed.
        today = date.today()
        if entitlement_detail.last_changes_updated_date != today:
            entitlement_detail.last_changes_updated_date = today
            update_fields.append('last_changes_updated_date')

        if update_fields:
            entitlement_detail.save(update_fields=list(set(update_fields)))

    def validate(self, data):
        data = super().validate(data)
        invoice = data.get('invoice_master_id') or getattr(self.instance, 'invoice_master_id', None)
        entitlement_detail = data.get('entitlement_details_id') or getattr(self.instance, 'entitlement_details_id', None)
        self._validate_entitlement_link(invoice, entitlement_detail)
        return data

    def create(self, validated_data):
        from apps.bills.recalculation_service import compute_invoice_detail_sub_total

        invoice = validated_data.get('invoice_master_id')
        if invoice:
            validated_data['sub_total'] = compute_invoice_detail_sub_total(validated_data, invoice)
        instance = super().create(validated_data)
        self._sync_invoice_line_to_entitlement_detail(instance)
        return instance

    def update(self, instance, validated_data):
        self._recompute_sub_total_if_needed(instance, validated_data)
        instance = super().update(instance, validated_data)
        self._sync_invoice_line_to_entitlement_detail(instance)
        return instance
    
    def get_line_total(self, obj):
        """Calculate line total with VAT and discount"""
        sub_total = obj.sub_total
        vat_amount = sub_total * (obj.vat_rate / Decimal('100'))
        discount_amount = sub_total * (obj.sub_discount_rate / Decimal('100'))
        line_total = sub_total + vat_amount - discount_amount
        return float(line_total.quantize(Decimal('0.01')))  # Round to 2 decimal places
    
    def _package_master_for_invoice_detail(self, obj):
        """
        Resolve PackageMaster for one invoice line (same logic for package vs service columns).
        Many BW lines store package only on entitlement.package_pricing_id or invoice.package_master_id;
        service_name must use the same package row as package_name.
        """
        if obj.entitlement_details_id:
            d = obj.entitlement_details_id
            if d.package_master_id_id:
                return d.package_master_id
            if d.package_pricing_id and d.package_pricing_id.package_master_id_id:
                return d.package_pricing_id.package_master_id
        if obj.package_master_id_id:
            return obj.package_master_id
        if obj.package_pricing_id and obj.package_pricing_id.package_master_id_id:
            return obj.package_pricing_id.package_master_id
        return None

    def get_entitlement_type(self, obj):
        """Get entitlement type as package name (IPT, CDN, etc.) or fallback to type."""
        pm = self._package_master_for_invoice_detail(obj)
        if pm:
            return pm.package_name
        if obj.entitlement_details_id:
            return obj.entitlement_details_id.type
        return obj.type

    def get_entitlement_package(self, obj):
        """Package name (NIX, CDN, …) from the same PackageMaster as service_name."""
        pm = self._package_master_for_invoice_detail(obj)
        return pm.package_name if pm else None

    def get_entitlement_service_name(self, obj):
        """Business service label from PackageMaster.service_name (same package row as package column)."""
        pm = self._package_master_for_invoice_detail(obj)
        if not pm:
            return None
        sn = (pm.service_name or '').strip()
        return sn if sn else None

    def get_service_name(self, obj):
        """Same as entitlement_service_name (for clients reading detail.service_name)."""
        return self.get_entitlement_service_name(obj)

    def get_entitlement_mbps(self, obj):
        """Get entitlement mbps based on customer type"""
        if obj.entitlement_details_id:
            detail = obj.entitlement_details_id
            # For SOHO customers, get mbps from package_pricing_id
            if detail.type == 'soho':
                if detail.package_pricing_id and detail.package_pricing_id.mbps:
                    return float(detail.package_pricing_id.mbps)
            # For BW and Channel Partner, get from the detail record itself
            elif detail.type == 'bw':
                if detail.mbps:
                    return float(detail.mbps)
        return None

    def get_zone_name(self, obj):
        """Get zone name from parent entitlement (for multi-zone invoice grouping)."""
        if obj.entitlement_details_id and obj.entitlement_details_id.cust_entitlement_id:
            return obj.entitlement_details_id.cust_entitlement_id.zone_name or None
        return None

    def get_entitlement_id(self, obj):
        """Get entitlement (CustomerEntitlementMaster) ID for grouping details by zone."""
        if obj.entitlement_details_id and obj.entitlement_details_id.cust_entitlement_id:
            return obj.entitlement_details_id.cust_entitlement_id.id
        return None


class InvoiceMasterListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for invoice list view - minimal fields, no nested details.
    Avoids N+1 queries and heavy payloads when listing many invoices.
    """
    customer_name = serializers.CharField(
        source='customer_entitlement_master_id.customer_master_id.customer_name',
        read_only=True
    )
    company_name = serializers.SerializerMethodField()
    customer_id = serializers.IntegerField(
        source='customer_entitlement_master_id.customer_master_id.id',
        read_only=True
    )
    customer_type = serializers.CharField(
        source='customer_entitlement_master_id.customer_master_id.customer_type',
        read_only=True
    )
    bill_number = serializers.CharField(
        source='customer_entitlement_master_id.bill_number',
        read_only=True
    )

    customer_total_due = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceMaster
        fields = [
            'id', 'invoice_number', 'bill_number', 'issue_date',
            'customer_id', 'customer_name', 'company_name', 'customer_type',
            'customer_entitlement_master_id', 'total_bill_amount', 'total_paid_amount', 'total_balance_due',
            'customer_total_due', 'status', 'created_at',
        ]

    def get_company_name(self, obj):
        cust = obj.customer_entitlement_master_id.customer_master_id if obj.customer_entitlement_master_id else None
        return cust.company_name if cust else (obj.customer_master_id.company_name if obj.customer_master_id else None)

    def get_customer_total_due(self, obj):
        """Cumulative outstanding balance: sum of all unpaid/partial invoices for this customer."""
        try:
            customer = (
                obj.customer_entitlement_master_id.customer_master_id
                if obj.customer_entitlement_master_id
                else obj.customer_master_id
            )
            if not customer:
                return float(obj.total_balance_due or 0)
            return float(customer.get_cumulative_balance())
        except Exception:
            return float(obj.total_balance_due or 0)


class InvoiceMasterSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(
        source='customer_entitlement_master_id.customer_master_id.customer_name',
        read_only=True
    )
    customer_id = serializers.IntegerField(
        source='customer_entitlement_master_id.customer_master_id.id',
        read_only=True
    )
    bill_number = serializers.CharField(
        source='customer_entitlement_master_id.bill_number',
        read_only=True
    )
    details = InvoiceDetailsSerializer(many=True, read_only=True)
    details_count = serializers.SerializerMethodField()
    utility_info = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    entitlement_details = serializers.SerializerMethodField()
    information_details = serializers.SerializerMethodField()
    created_by_details = serializers.SerializerMethodField()
    updated_by_details = serializers.SerializerMethodField()
    entitlements = serializers.SerializerMethodField()  # NEW: Multi-entitlement support
    entitlement_ids = serializers.SerializerMethodField()  # NEW: List of entitlement IDs
    zones = serializers.SerializerMethodField()  # NEW: Zone names
    customer_total_due = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceMaster
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'invoice_number',
            'total_bill_amount', 'total_paid_amount', 'total_balance_due',
            'total_vat_amount', 'total_discount_amount'
        ]
    
    def get_details_count(self, obj):
        return obj.details.count()
    
    def get_utility_info(self, obj):
        if obj.information_master_id:
            return {
                'id': obj.information_master_id.id,
                'vat_rate': float(obj.information_master_id.vat_rate),
                'terms_condition': obj.information_master_id.terms_condition,
            }
        return None
    
    def get_payment_status(self, obj):
        """Determine payment status based on amounts"""
        if obj.total_balance_due == 0:
            return 'paid'
        elif obj.total_paid_amount > 0:
            return 'partial'
        else:
            return 'unpaid'
    
    def get_entitlement_details(self, obj):
        return CustomerEntitlementMasterSerializer(obj.customer_entitlement_master_id).data
    
    def get_information_details(self, obj):
        if obj.information_master_id:
            return {
                'id': obj.information_master_id.id,
                'vat_rate': float(obj.information_master_id.vat_rate),
                'terms_condition': obj.information_master_id.terms_condition,
            }
        return None
    
    def get_customer_details(self, obj):
        return CustomerMasterSerializer(obj.customer_entitlement_master_id.customer_master_id).data
    
    def get_created_by_details(self, obj):
        if obj.created_by:
            return {
                'id': obj.created_by.id,
                'username': obj.created_by.username,
                'email': obj.created_by.email,
                'first_name': obj.created_by.first_name,
                'last_name': obj.created_by.last_name,
            }
        return None
    
    def get_updated_by_details(self, obj):
        if obj.updated_by:
            return {
                'id': obj.updated_by.id,
                'username': obj.updated_by.username,
                'email': obj.updated_by.email,
                'first_name': obj.updated_by.first_name,
                'last_name': obj.updated_by.last_name,
            }
        return None
    
    def get_customer_total_due(self, obj):
        """Cumulative outstanding balance: sum of all unpaid/partial invoices for this customer."""
        try:
            customer = (
                obj.customer_entitlement_master_id.customer_master_id
                if obj.customer_entitlement_master_id
                else obj.customer_master_id
            )
            if not customer:
                return float(obj.total_balance_due or 0)
            return float(customer.get_cumulative_balance())
        except Exception:
            return float(obj.total_balance_due or 0)

    def get_entitlements(self, obj):
        """Get all entitlements linked to this invoice"""
        entitlements = []
        
        # Add primary entitlement
        if obj.customer_entitlement_master_id:
            entitlements.append({
                'id': obj.customer_entitlement_master_id.id,
                'bill_number': obj.customer_entitlement_master_id.bill_number,
                'zone_name': obj.customer_entitlement_master_id.zone_name,
                'is_primary': True,
                'customer_name': obj.customer_entitlement_master_id.customer_master_id.customer_name,
            })
        
        # Add additional entitlements from JSONField
        if obj.additional_entitlements:
            # Fetch full entitlement data for additional entitlements
            from apps.bills.models import CustomerEntitlementMaster
            for ent_data in obj.additional_entitlements:
                ent_id = ent_data.get('id')
                if ent_id:
                    try:
                        ent = CustomerEntitlementMaster.objects.select_related('customer_master_id').get(id=ent_id)
                        entitlements.append({
                            'id': ent.id,
                            'bill_number': ent_data.get('bill_number') or ent.bill_number,
                            'zone_name': ent_data.get('zone_name') or ent.zone_name,
                            'is_primary': False,
                            'customer_name': ent.customer_master_id.customer_name,
                        })
                    except CustomerEntitlementMaster.DoesNotExist:
                        # Fallback to stored data if entitlement deleted
                        entitlements.append({
                            'id': ent_id,
                            'bill_number': ent_data.get('bill_number'),
                            'zone_name': ent_data.get('zone_name'),
                            'is_primary': False,
                            'customer_name': None,
                        })
        
        return entitlements
    
    def get_entitlement_ids(self, obj):
        """Get list of entitlement IDs"""
        return obj.get_all_entitlement_ids()
    
    def get_zones(self, obj):
        """Get unique zone names"""
        zones = set()
        
        # Add primary entitlement zone
        if obj.customer_entitlement_master_id and obj.customer_entitlement_master_id.zone_name:
            zones.add(obj.customer_entitlement_master_id.zone_name)
        
        # Add zones from additional entitlements
        if obj.additional_entitlements:
            for ent in obj.additional_entitlements:
                zone = ent.get('zone_name')
                if zone:
                    zones.add(zone)
        
        return list(zones)
    
    def validate(self, data):
        """Validate invoice data"""
        if 'customer_entitlement_master_id' in data:
            entitlement = data['customer_entitlement_master_id']
            # Check if invoice already exists for this entitlement (1:1 relationship)
            if self.instance is None:  # Creating new
                if InvoiceMaster.objects.filter(
                    customer_entitlement_master_id=entitlement
                ).exists():
                    raise serializers.ValidationError(
                        "Invoice already exists for this entitlement"
                    )
        return data


class InvoiceMasterCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoice with auto-calculation"""
    auto_calculate = serializers.BooleanField(default=True, write_only=True)
    
    class Meta:
        model = InvoiceMaster
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'invoice_number',
            'total_bill_amount', 'total_paid_amount', 'total_balance_due',
            'total_vat_amount', 'total_discount_amount'
        ]
    
    def create(self, validated_data):
        auto_calculate = validated_data.pop('auto_calculate', True)
        entitlement = validated_data['customer_entitlement_master_id']

        # Ensure additional_entitlements is set to empty list if not provided
        if 'additional_entitlements' not in validated_data:
            validated_data['additional_entitlements'] = []

        # Auto-generate invoice number
        if not validated_data.get('invoice_number'):
            last_invoice = InvoiceMaster.objects.order_by('-id').first()
            next_num = (last_invoice.id + 1) if last_invoice else 1
            validated_data['invoice_number'] = f'INV{timezone.now().year}{next_num:05d}'

        invoice = InvoiceMaster.objects.create(**validated_data)
        
        if auto_calculate:
            # Auto-calculate totals from entitlement details
            self._calculate_invoice_totals(invoice, entitlement)
        
        # Update customer's last_bill_invoice_date
        customer = entitlement.customer_master_id
        customer.last_bill_invoice_date = timezone.now()
        customer.save(update_fields=['last_bill_invoice_date'])
        
        return invoice
    
    def _calculate_invoice_totals(self, invoice, entitlement):
        """Calculate invoice totals from entitlement details"""
        from django.utils import timezone
        from datetime import date
        from django.db.models import Q
        from apps.bills.utils import calculate_pro_rated_amount
        import calendar
        
        # Determine billing period based on invoice issue date
        issue_date = invoice.issue_date
        billing_start = date(issue_date.year, issue_date.month, 1)
        _, last_day = calendar.monthrange(issue_date.year, issue_date.month)
        billing_end = date(issue_date.year, issue_date.month, last_day)
        
        # Get all details that overlap with billing period
        details = entitlement.details.filter(
            Q(start_date__lte=billing_end) & 
            (Q(end_date__gte=billing_start) | Q(end_date__isnull=True))
        )
        
        utility = invoice.information_master_id
        customer_type = entitlement.customer_master_id.customer_type
        
        total_subtotal = Decimal('0')
        total_vat = Decimal('0')
        total_discount = Decimal('0')
        
        # Create invoice details for each entitlement detail
        for ent_detail in details:
            line_subtotal = Decimal('0')
            
            if customer_type == CustomerMaster.CUSTOMER_TYPE_BW:
                # For BW and Channel Partner, use date-wise pro-rated calculation
                if ent_detail.mbps and ent_detail.unit_price:
                    line_subtotal = calculate_pro_rated_amount(
                        ent_detail.mbps, 
                        ent_detail.unit_price, 
                        ent_detail.start_date, 
                        ent_detail.end_date, 
                        billing_start, 
                        billing_end
                    )
            elif customer_type == CustomerMaster.CUSTOMER_TYPE_SOHO:
                # For SOHO, use package pricing rate (Monthly wise - flat rate)
                if ent_detail.package_pricing_id and ent_detail.package_pricing_id.rate:
                    line_subtotal = ent_detail.package_pricing_id.rate
            else:
                # Fallback
                if ent_detail.mbps and ent_detail.unit_price:
                    line_subtotal = calculate_pro_rated_amount(
                        ent_detail.mbps, 
                        ent_detail.unit_price, 
                        ent_detail.start_date, 
                        ent_detail.end_date, 
                        billing_start, 
                        billing_end
                    )
                elif ent_detail.package_pricing_id and ent_detail.package_pricing_id.rate:
                    line_subtotal = ent_detail.package_pricing_id.rate
            
            total_subtotal += line_subtotal
            
            # Get VAT rate from utility or default
            vat_rate = utility.vat_rate if utility else Decimal('0')
            vat_amount = line_subtotal * (vat_rate / Decimal('100'))
            total_vat += vat_amount
            
            # Discount (can be customized)
            discount_rate = Decimal('0')  # Default no discount
            discount_amount = line_subtotal * (discount_rate / Decimal('100'))
            total_discount += discount_amount
            
            # Create invoice detail
            InvoiceDetails.objects.create(
                invoice_master_id=invoice,
                entitlement_details_id=ent_detail,
                sub_total=line_subtotal,
                vat_rate=vat_rate,
                sub_discount_rate=discount_rate,
                remarks=f'Invoice detail for {ent_detail.type} ({billing_start} to {billing_end})'
            )
        
        # Update invoice totals
        invoice.total_bill_amount = total_subtotal + total_vat - total_discount
        invoice.total_vat_amount = total_vat
        invoice.total_discount_amount = total_discount
        invoice.total_balance_due = invoice.total_bill_amount - invoice.total_paid_amount
        invoice.save()


# ==================== Customer Entitlement Serializers ====================

class CustomerEntitlementMasterListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for entitlement/bill dropdowns.
    Use with ?minimal=1 for invoice/payment form bill loading.
    """
    class Meta:
        model = CustomerEntitlementMaster
        fields = [
            'id', 'bill_number', 'total_bill', 'activation_date',
            'last_bill_invoice_date', 'zone_name', 'customer_master_id',
        ]


class CustomerEntitlementDetailsSerializer(serializers.ModelSerializer):
    package_name = serializers.SerializerMethodField()
    service_name = serializers.SerializerMethodField()
    daily_rate = serializers.SerializerMethodField()
    cust_entitlement_master = serializers.SerializerMethodField()
    bandwidth_type = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerEntitlementDetails
        fields = '__all__'
        # Note: 'line_total' field has been renamed to 'daily_rate' for clarity
        read_only_fields = ['created_at', 'updated_at', 'timestamp', 'bandwidth_type', 'service_name']
        extra_kwargs = {
            'end_date': {'required': False},
            'package_master_id': {'required': False},
            'package_pricing_id': {'required': False},
        }
    
    def to_representation(self, instance):
        """Override to populate mbps and unit_price from package_pricing for SOHO customers"""
        ret = super().to_representation(instance)
        
        # For SOHO customers, if mbps or unit_price are null, get them from package_pricing
        if instance.type == 'soho' and instance.package_pricing_id:
            if ret.get('mbps') is None and instance.package_pricing_id.mbps:
                ret['mbps'] = instance.package_pricing_id.mbps
            if ret.get('unit_price') is None and instance.package_pricing_id.rate:
                ret['unit_price'] = float(instance.package_pricing_id.rate)
        
        return ret
    
    def get_package_name(self, obj):
        # For BW/MAC customers: package_master_id is set directly
        if obj.package_master_id:
            return obj.package_master_id.package_name
        # For SOHO customers: package comes from package_pricing_id
        if obj.package_pricing_id and obj.package_pricing_id.package_master_id:
            return obj.package_pricing_id.package_master_id.package_name
        return None
    
    def get_service_name(self, obj):
        """Get service name from package master based on customer type"""
        # For BW/MAC customers: package_master_id is set directly
        if obj.package_master_id:
            return obj.package_master_id.service_name
        # For SOHO customers: service_name comes from package_pricing_id -> package_master_id
        if obj.package_pricing_id and obj.package_pricing_id.package_master_id:
            return obj.package_pricing_id.package_master_id.service_name
        return None
    
    def get_daily_rate(self, obj):
        """Calculate daily rate: (mbps * unit_price) / days_in_month (for BW customers)"""
        if obj.mbps and obj.unit_price and obj.type == 'bw':
            from calendar import monthrange
            # Use current month for calculation, or the month of start_date if available
            calc_date = obj.start_date if obj.start_date else date.today()
            _, days_in_month = monthrange(calc_date.year, calc_date.month)
            monthly_bill = obj.mbps * obj.unit_price
            daily_rate = monthly_bill / Decimal(str(days_in_month))
            return float(daily_rate.quantize(Decimal('0.01')))  # Round to 2 decimal places
        elif obj.mbps and obj.unit_price:
            # For MAC customers, return monthly rate
            return float((obj.mbps * obj.unit_price).quantize(Decimal('0.01')))
        return 0.0
    
    def get_cust_entitlement_master(self, obj):
        """Return nested entitlement master information"""
        if obj.cust_entitlement_id:
            entitlement = obj.cust_entitlement_id
            # Refresh from DB to ensure we get the latest calculated total_bill
            # as it is updated during the save() of the detail
            if entitlement.pk:
                entitlement.refresh_from_db()

            return {
                'id': entitlement.id,
                'bill_number': entitlement.bill_number,
                'activation_date': entitlement.activation_date,
                'total_bill': float(entitlement.total_bill),
                'last_bill_invoice_date': entitlement.last_bill_invoice_date,
                'customer_master': {
                    'id': entitlement.customer_master_id.id,
                    'customer_number': entitlement.customer_master_id.customer_number,
                    'customer_name': entitlement.customer_master_id.customer_name,
                    'customer_type': entitlement.customer_master_id.customer_type,
                    'email': entitlement.customer_master_id.email,
                    'phone': entitlement.customer_master_id.phone,
                } if entitlement.customer_master_id else None
            }
        return None
    
    def get_bandwidth_type(self, obj):
        """
        Extract bandwidth type from package name or remarks.
        For bandwidth customers, package names are like: 'IPT', 'CDN', 'NIX', 'GCC', 'BAISHAN'
        Priority: 1) Package name (from package_master_id), 2) Remarks field
        """
        if obj.type == 'bw':
            # First, try to get from package_master_id (BW/MAC primary source)
            if obj.package_master_id:
                package_name = obj.package_master_id.package_name.upper()
                for bw_type in ['IPT', 'GCC', 'CDN', 'NIX', 'BAISHAN']:
                    if bw_type in package_name:
                        return bw_type.lower()
            
            # Try package_pricing_id (for backward compatibility)
            if obj.package_pricing_id and obj.package_pricing_id.package_master_id:
                package_name = obj.package_pricing_id.package_master_id.package_name.upper()
                for bw_type in ['IPT', 'GCC', 'CDN', 'NIX', 'BAISHAN']:
                    if bw_type in package_name:
                        return bw_type.lower()
            
            # Fallback: try to extract from remarks field (for backward compatibility)
            if hasattr(obj, 'remarks') and obj.remarks:
                remarks_upper = obj.remarks.upper()
                for bw_type in ['IPT', 'GCC', 'CDN', 'NIX', 'BAISHAN']:
                    if remarks_upper.startswith(bw_type):
                        return bw_type.lower()
        
        return None

    
    def validate(self, data):
        """Validate based on customer type"""
        if 'cust_entitlement_id' in data:
            entitlement = data['cust_entitlement_id']
            customer = entitlement.customer_master_id

            # For bandwidth customers, mbps and unit_price are required
            if customer.customer_type == CustomerMaster.CUSTOMER_TYPE_BW:
                if data.get('mbps') is None or data.get('unit_price') is None:
                    raise serializers.ValidationError(
                        "mbps and unit_price are required for bandwidth customers"
                    )
                
                # Keep end_date as NULL for open-ended entitlements
                # Only set end_date when mbps value changes (handled by mbps change logic)
                # When mbps changes: close previous detail with end_date, create new detail with NULL end_date
            
        
        return data


class CustomerEntitlementMasterSerializer(serializers.ModelSerializer):
    customer_master = CustomerMasterSerializer(source='customer_master_id', read_only=True)
    details = CustomerEntitlementDetailsSerializer(many=True, read_only=True)
    details_count = serializers.SerializerMethodField()
    total_entitlement_amount = serializers.SerializerMethodField()
    total_mbps_quantity_used = serializers.SerializerMethodField()

    class Meta:
        model = CustomerEntitlementMaster
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_details_count(self, obj):
        return obj.details.count()
    
    def get_total_entitlement_amount(self, obj):
        """Return the auto-calculated total bill from the model"""
        return float(obj.total_bill)
    
    def get_total_mbps_quantity_used(self, obj):
        """
        Calculate total Mbps quantity used aggregated by bandwidth type.
        
        Returns cumulative Mbps totals by type (dynamically fetched from PackageMaster).
        Respects negative values for reductions.
        Supports date filtering via query parameters:
        - start_date: Filter details from this date
        - end_date: Filter details up to this date
        - period: 'weekly', 'monthly', or custom via start_date/end_date
        
        Example response:
        {
            "ipt": 450.00,
            "cdn": 100.00,
            "gcc": 100.00,
            "nix": 0.00,
            "baishan": 0.00,
            "other": 0.00,
            "total": 650.00
        }
        """
        from datetime import datetime, timedelta
        from django.db.models import Sum, Q
        from apps.package.models import PackageMaster
        
        # Get date filters from context (passed via view)
        request = self.context.get('request')
        start_date = None
        end_date = None
        
        if request:
            # Check for period parameter
            period = request.query_params.get('period')
            if period == 'weekly':
                end_date = date.today()
                start_date = end_date - timedelta(days=7)
            elif period == 'monthly':
                end_date = date.today()
                start_date = end_date - timedelta(days=30)
            
            # Override with explicit dates if provided
            start_date_param = request.query_params.get('start_date')
            end_date_param = request.query_params.get('end_date')
            
            if start_date_param:
                try:
                    start_date = datetime.strptime(start_date_param, '%Y-%m-%d').date()
                except ValueError:
                    pass
            
            if end_date_param:
                try:
                    end_date = datetime.strptime(end_date_param, '%Y-%m-%d').date()
                except ValueError:
                    pass
        
        # Build query for entitlement details
        details_query = obj.details.filter(type='bw')  # Only bandwidth customers have types
        
        # Apply date filters if provided
        if start_date:
            # Include details that started on or before end_date (or still active)
            details_query = details_query.filter(
                Q(start_date__gte=start_date) |
                Q(start_date__lt=start_date, end_date__gte=start_date) |
                Q(start_date__lt=start_date, end_date__isnull=True)
            )
        
        if end_date:
            # Include details that started on or before end_date
            details_query = details_query.filter(start_date__lte=end_date)
        
        # Dynamically get all bandwidth package types from PackageMaster
        # Filter for BW type packages and get unique package names
        bw_package_names = PackageMaster.objects.filter(
            package_type='bw',
            is_active=True
        ).values_list('package_name', flat=True).distinct()
        
        # Initialize bandwidth type totals dynamically
        # Convert package names to lowercase for consistent keys
        bw_types = {}
        for package_name in bw_package_names:
            # Use uppercase package name as key (normalized)
            key = package_name.upper()
            bw_types[key] = Decimal('0.00')
        
        # Always include 'other' for unclassified
        bw_types['OTHER'] = Decimal('0.00')
        
        # Aggregate by bandwidth type
        for detail in details_query.select_related('package_master_id'):
            if detail.mbps:
                # Determine bandwidth type from package name
                bw_type = None
                if detail.package_master_id:
                    # Use the actual package name from the detail's package
                    bw_type = detail.package_master_id.package_name.upper()
                
                # Fallback to remarks if package name doesn't exist
                if not bw_type and detail.remarks:
                    # Try to match remarks with known package types
                    remarks_upper = detail.remarks.upper()
                    for package_name in bw_package_names:
                        if remarks_upper.startswith(package_name.upper()):
                            bw_type = package_name.upper()
                            break
                
                # Add to appropriate bucket (supports negative values)
                if bw_type and bw_type in bw_types:
                    bw_types[bw_type] += detail.mbps
                else:
                    bw_types['OTHER'] += detail.mbps
        
        # Calculate total
        total = sum(bw_types.values())
        
        # Convert to float for JSON serialization with lowercase keys for consistency
        result = {key.lower(): float(value) for key, value in bw_types.items()}
        result['total'] = float(total)
        
        return result


# ==================== Bulk Entitlement Details Serializers ====================

class BandwidthEntitlementDetailSerializer(serializers.Serializer):
    """Serializer for creating multiple bandwidth entitlement details at once"""
    bandwidth_type = serializers.ChoiceField(choices=['ipt', 'gcc', 'cdn', 'nix', 'baishan'], help_text="Bandwidth type: ipt, gcc, cdn, nix, or baishan")
    mbps = serializers.DecimalField(max_digits=10, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    package_pricing_id = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    status = serializers.ChoiceField(choices=['active', 'inactive', 'expired'], default='active')
    remarks = serializers.CharField(required=False, allow_blank=True)


class ChannelPartnerEntitlementDetailSerializer(BandwidthEntitlementDetailSerializer):
    """
    Backward-compatible alias for removed channel partner flows.
    The system now uses BW/SOHO only; this serializer is kept to avoid
    import/runtime failures in legacy endpoints until they are fully removed.
    """
    custom_mac_percentage_share = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, allow_null=True
    )


class SohoEntitlementDetailSerializer(serializers.Serializer):
    """Serializer for creating multiple SOHO entitlement details at once"""
    mbps = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    package_pricing_id = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(default=True)
    status = serializers.ChoiceField(choices=['active', 'inactive', 'expired'], default='active')
    remarks = serializers.CharField(required=False, allow_blank=True)


class BulkEntitlementDetailsCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating entitlement details"""
    entitlement_master_id = serializers.IntegerField()
    bandwidth_details = BandwidthEntitlementDetailSerializer(many=True, required=False)
    soho_details = SohoEntitlementDetailSerializer(many=True, required=False)


# ==================== Add Entitlement Detail Serializer ====================

class AddEntitlementDetailSerializer(serializers.Serializer):
    """
    Serializer for adding OR updating a single entitlement detail via POST /api/add/entitlements/details
    
    CREATE Mode (when id is NOT provided):
    - Creates a new entitlement detail
    - All required fields must be provided
    
    UPDATE Mode (when id IS provided):
    - Updates an existing entitlement detail
    - Can update mbps, unit_price, start_date, and other editable fields
    - Useful for correcting wrong input values
    
    Supports:
    - Negative mbps values (for quantity reductions)
    - Zero mbps and unit_price
    - Supported customer types: bw, soho
    - Each entry is independent - does NOT automatically close previous records
    - End dates should only be set during invoice generation
    """
    # Optional ID field for updates
    id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Provide this to UPDATE an existing detail. Omit to CREATE new detail."
    )
    
    # Required fields for CREATE, optional for UPDATE
    start_date = serializers.DateField(required=False)
    type = serializers.ChoiceField(
        choices=CustomerEntitlementDetails.TYPE_CHOICES,
        required=False,
        help_text="Customer type: bw or soho"
    )
    cust_entitlement_id = serializers.IntegerField(required=False)
    mbps = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        help_text="Mbps value (can be negative for reductions, or zero)"
    )
    unit_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        help_text="Unit price (can be zero)"
    )
    
    # Optional fields
    package_master_id = serializers.IntegerField(required=False, allow_null=True)
    package_pricing_id = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.ChoiceField(
        choices=CustomerEntitlementDetails.STATUS_CHOICES,
        required=False,
        default='active'
    )
    is_active = serializers.BooleanField(required=False, default=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    remarks = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    
    def validate_cust_entitlement_id(self, value):
        """Validate that entitlement exists"""
        try:
            entitlement = CustomerEntitlementMaster.objects.get(id=value)
            return entitlement
        except CustomerEntitlementMaster.DoesNotExist:
            raise serializers.ValidationError(f"Entitlement with ID {value} does not exist")
    
    def validate_package_master_id(self, value):
        """Validate that package master exists if provided"""
        if value is not None:
            from apps.package.models import PackageMaster
            try:
                return PackageMaster.objects.get(id=value)
            except PackageMaster.DoesNotExist:
                raise serializers.ValidationError(f"Package Master with ID {value} does not exist")
        return value
    
    def validate_package_pricing_id(self, value):
        """Validate that package pricing exists if provided"""
        if value is not None:
            from apps.package.models import PackagePricing
            try:
                return PackagePricing.objects.get(id=value)
            except PackagePricing.DoesNotExist:
                raise serializers.ValidationError(f"Package Pricing with ID {value} does not exist")
        return value
    
    def validate(self, data):
        """
        Cross-field validation for both CREATE and UPDATE operations.
        
        UPDATE Mode: When 'id' is provided
        CREATE Mode: When 'id' is NOT provided
        """
        detail_id = data.get('id')
        is_update = detail_id is not None
        
        # For UPDATE: Validate that detail exists
        if is_update:
            try:
                existing_detail = CustomerEntitlementDetails.objects.get(id=detail_id)
                # Store for use in update method
                self._existing_detail = existing_detail
                
                # If cust_entitlement_id provided in update, verify it matches
                if 'cust_entitlement_id' in data:
                    if data['cust_entitlement_id'] != existing_detail.cust_entitlement_id:
                        raise serializers.ValidationError({
                            'cust_entitlement_id': f"Cannot change entitlement ID during update"
                        })
                
                # Use existing detail's entitlement for validation
                entitlement = existing_detail.cust_entitlement_id
                customer_type = data.get('type', existing_detail.type)
                
            except CustomerEntitlementDetails.DoesNotExist:
                raise serializers.ValidationError({
                    'id': f"Entitlement detail with ID {detail_id} does not exist"
                })
        else:
            # For CREATE: Required fields validation
            required_fields = ['start_date', 'type', 'cust_entitlement_id', 'mbps', 'unit_price']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                raise serializers.ValidationError({
                    field: "This field is required for creating new entitlement detail"
                    for field in missing_fields
                })
            
            entitlement = data.get('cust_entitlement_id')
            customer_type = data.get('type')
        
        if entitlement:
            # Validate customer type matches
            customer = entitlement.customer_master_id
            if customer.customer_type != customer_type:
                raise serializers.ValidationError({
                    'type': f"Type '{customer_type}' does not match customer type '{customer.customer_type}'"
                })
        return data
    
    def create(self, validated_data):
        """
        Create the entitlement detail as a fresh, independent entry.
        
        Note: Does NOT automatically close previous open-ended details.
        Each entry is treated as separate and independent.
        End dates should only be set during invoice generation, not during creation.
        """
        from django.db import transaction
        
        # Remove 'id' if present (shouldn't be in create)
        validated_data.pop('id', None)
        
        # Extract the entitlement (already converted to object in validate_cust_entitlement_id)
        entitlement = validated_data.pop('cust_entitlement_id')
        package_master = validated_data.pop('package_master_id', None)
        package_pricing = validated_data.pop('package_pricing_id', None)
        
        # Get current user from context
        user = self.context.get('request').user if self.context.get('request') else None
        
        with transaction.atomic():
            # Create the new detail as a fresh, independent entry
            detail = CustomerEntitlementDetails.objects.create(
                cust_entitlement_id=entitlement,
                package_master_id=package_master,
                package_pricing_id=package_pricing,
                created_by=user,
                last_changes_updated_date=date.today(),
                **validated_data
            )
            
            return detail
    
    def update(self, instance, validated_data):
        """
        Update an existing entitlement detail.
        
        Allows correcting wrong input values for:
        - mbps
        - unit_price
        - start_date
        - remarks
        - status
        - is_active
        - end_date
        - package references
        
        Note: Does NOT create new records. Simply updates the existing one.
        Use this for data correction only.
        """
        from django.db import transaction
        
        # Get current user from context
        user = self.context.get('request').user if self.context.get('request') else None
        
        # Remove fields that shouldn't be updated directly
        validated_data.pop('id', None)
        validated_data.pop('cust_entitlement_id', None)  # Cannot change entitlement
        validated_data.pop('type', None)  # Cannot change type
        
        # Extract package references if provided
        package_master = validated_data.pop('package_master_id', None)
        package_pricing = validated_data.pop('package_pricing_id', None)
        
        with transaction.atomic():
            # Update fields
            for field, value in validated_data.items():
                setattr(instance, field, value)
            
            # Update package references if provided
            if package_master is not None:
                instance.package_master_id = package_master
            if package_pricing is not None:
                instance.package_pricing_id = package_pricing
            
            # Update metadata
            instance.updated_by = user
            instance.last_changes_updated_date = date.today()
            
            # Save the instance
            instance.save()
            
            return instance
    
    def save(self, **kwargs):
        """
        Override save to handle both create and update operations.
        """
        if hasattr(self, '_existing_detail'):
            # UPDATE operation
            return self.update(self._existing_detail, self.validated_data)
        else:
            # CREATE operation
            return self.create(self.validated_data)


class InvoiceEmailScheduleSerializer(serializers.ModelSerializer):
    target_customer_name = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceEmailSchedule
        fields = [
            'id', 'name', 'enabled',
            'target_customer', 'target_customer_name',
            'schedule_type', 'run_at_hour', 'run_at_minute',
            'weekly_day', 'monthly_day', 'cron_expression',
            'generate_invoices_before_send', 'invoice_status_filter', 'days_lookback',
            'last_run_at', 'next_run_at',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['last_run_at', 'next_run_at', 'created_at', 'updated_at', 'target_customer_name']

    def get_target_customer_name(self, obj):
        if obj.target_customer_id:
            return obj.target_customer.customer_name
        return None

    def save(self, **kwargs):
        instance = super().save(**kwargs)
        try:
            from apps.bills.management.commands.run_invoice_email_schedule import get_next_run_at
            instance.next_run_at = get_next_run_at(instance)
            instance.save(update_fields=['next_run_at'])
        except Exception:
            # If croniter missing or schedule invalid, leave next_run_at as-is
            pass
        return instance

