"""
Serializers for Package App
"""
from rest_framework import serializers
from .models import PackageMaster, PackagePricing


class PackagePricingSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source='package_master_id.package_name', read_only=True)
    package_type = serializers.CharField(source='package_master_id.package_type', read_only=True)
    
    class Meta:
        model = PackagePricing
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class PackageMasterSerializer(serializers.ModelSerializer):
    pricings = PackagePricingSerializer(many=True, read_only=True)
    active_pricing = serializers.SerializerMethodField()
    pricings_count = serializers.SerializerMethodField()
    
    class Meta:
        model = PackageMaster
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_active_pricing(self, obj):
        """Get currently active pricing"""
        from django.utils import timezone
        today = timezone.now().date()
        active = obj.pricings.filter(
            is_active=True,
            val_start_at__lte=today,
            val_end_at__gte=today
        ).first()
        if active:
            return PackagePricingSerializer(active).data
        return None
    
    def get_pricings_count(self, obj):
        return obj.pricings.count()

