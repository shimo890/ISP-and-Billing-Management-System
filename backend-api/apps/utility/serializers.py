"""
Serializers for Utility App - GET only
"""
from rest_framework import serializers
from .models import UtilityInformationMaster, UtilityDetails


class UtilityDetailsSerializer(serializers.ModelSerializer):
    utility_master_id_info = serializers.SerializerMethodField()
    
    class Meta:
        model = UtilityDetails
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_utility_master_id_info(self, obj):
        if obj.utility_master_id:
            return {
                'id': obj.utility_master_id.id,
                'vat_rate': float(obj.utility_master_id.vat_rate),
            }
        return None


class UtilityInformationMasterSerializer(serializers.ModelSerializer):
    details = UtilityDetailsSerializer(many=True, read_only=True)
    details_count = serializers.SerializerMethodField()
    active_details = serializers.SerializerMethodField()
    
    class Meta:
        model = UtilityInformationMaster
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
    
    def get_details_count(self, obj):
        return obj.details.count()
    
    def get_active_details(self, obj):
        """Get only active utility details"""
        active = obj.details.filter(is_active=True)
        return UtilityDetailsSerializer(active, many=True).data

