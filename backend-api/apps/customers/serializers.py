from rest_framework import serializers
from django.db import models
from decimal import Decimal
from .models import (
    Prospect,
    ProspectStatusHistory,
    ProspectFollowUp,
    ProspectAttachment,
    KAMMaster,
    CustomerMaster,
)


class ProspectSerializer(serializers.ModelSerializer):
    kam_details = serializers.SerializerMethodField()

    class Meta:
        model = Prospect
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'kam']

    def get_kam_details(self, obj):
        if obj.kam:
            return {
                'id': obj.kam.id,
                'username': getattr(obj.kam, 'username', ''),
                'email': obj.kam.email,
                'first_name': getattr(obj.kam, 'first_name', ''),
                'last_name': getattr(obj.kam, 'last_name', ''),
            }
        return None

    def validate_follow_up_date(self, value):
        from datetime import date
        if value and value < date.today():
            raise serializers.ValidationError('Follow-up date cannot be in the past')
        return value


class ProspectStatusHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProspectStatusHistory
        fields = '__all__'
        read_only_fields = ['changed_at', 'changed_by']


class ProspectFollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProspectFollowUp
        fields = '__all__'
        read_only_fields = ['created_at']


class ProspectAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProspectAttachment
        fields = '__all__'
        read_only_fields = ['uploaded_at', 'uploaded_by']


# ==================== KAM Master Serializers ====================

class KAMMasterSerializer(serializers.ModelSerializer):
    assigned_customers_count = serializers.SerializerMethodField()
    
    class Meta:
        model = KAMMaster
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_assigned_customers_count(self, obj):
        return obj.customers.count()


# ==================== Customer Master Serializers ====================

class CustomerMasterListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for dropdowns/selects - no N+1 queries.
    Use with ?minimal=1 for invoice/payment form customer loading.
    Expects active_entitlements_count to be annotated on the queryset.
    """
    active_entitlements_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CustomerMaster
        fields = [
            'id', 'customer_name', 'company_name', 'customer_number', 'nid',
            'customer_type', 'active_entitlements_count',
        ]


class CustomerMasterSerializer(serializers.ModelSerializer):
    kam_details = serializers.SerializerMethodField()
    total_billed = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    total_due = serializers.SerializerMethodField()
    cumulative_balance = serializers.SerializerMethodField()
    active_entitlements_count = serializers.SerializerMethodField()
    created_by_details = serializers.SerializerMethodField()
    updated_by_details = serializers.SerializerMethodField()
    
    class Meta:
        model = CustomerMaster
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'customer_number', 'last_bill_invoice_date', 'created_by', 'updated_by']
    
    def get_kam_details(self, obj):
        if obj.kam_id:
            return {
                'id': obj.kam_id.id,
                'name': obj.kam_id.kam_name,
                'designation': obj.kam_id.designation,
                'email': obj.kam_id.email,
                'phone': obj.kam_id.phone,
            }
        return None
    
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
    
    def get_total_billed(self, obj):
        """Calculate total billed amount from all invoices"""
        from apps.bills.models import InvoiceMaster
        total = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=obj
        ).aggregate(total=models.Sum('total_bill_amount'))['total']
        return float(total) if total else 0.0

    def get_total_paid(self, obj):
        """Calculate total paid amount from all invoices using model method"""
        return float(obj.get_total_received())

    def get_total_due(self, obj):
        """Calculate total due amount - DEPRECATED: Use cumulative_balance instead"""
        # Keep for backward compatibility but use cumulative_balance
        return float(obj.get_cumulative_balance())
    
    def get_cumulative_balance(self, obj):
        """
        Calculate customer's cumulative outstanding balance across all unpaid/partial invoices.
        This is the accurate total amount customer owes.
        """
        return float(obj.get_cumulative_balance())

    def get_active_entitlements_count(self, obj):
        """Count active entitlements"""
        from apps.bills.models import CustomerEntitlementMaster
        return CustomerEntitlementMaster.objects.filter(
            customer_master_id=obj,
            details__is_active=True,
            details__status='active'
        ).distinct().count()



