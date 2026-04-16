"""
Dashboard Analytics Serializers - Serialize analytics data for API response
"""

from rest_framework import serializers


class RevenueMetricSerializer(serializers.Serializer):
    """Serialize individual revenue metrics"""
    total_revenue = serializers.DecimalField(max_digits=18, decimal_places=2)
    invoice_count = serializers.IntegerField()
    period = serializers.CharField()


class RevenueAnalyticsSerializer(serializers.Serializer):
    """Serialize complete revenue analytics"""
    daily = RevenueMetricSerializer()
    weekly = RevenueMetricSerializer()
    monthly = RevenueMetricSerializer()
    yearly = RevenueMetricSerializer()
    custom = RevenueMetricSerializer(required=False, allow_null=True)


class CollectionMetricSerializer(serializers.Serializer):
    """Serialize individual collection metrics"""
    total_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_invoiced = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    transaction_count = serializers.IntegerField(required=False)
    collection_rate = serializers.DecimalField(max_digits=7, decimal_places=2, required=False)
    period = serializers.CharField(required=False)


class CollectionByCustomerSerializer(serializers.Serializer):
    """Serialize collection data by customer"""
    customer_id = serializers.IntegerField()
    customer_name = serializers.CharField()
    customer_type = serializers.CharField()
    total_invoiced = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    collection_rate = serializers.DecimalField(max_digits=7, decimal_places=2)
    outstanding_balance = serializers.DecimalField(max_digits=18, decimal_places=2)


class CollectionAnalyticsSerializer(serializers.Serializer):
    """Serialize complete collection analytics"""
    total_collected = serializers.DictField()
    daily = CollectionMetricSerializer()
    weekly = CollectionMetricSerializer()
    monthly = CollectionMetricSerializer()
    custom = CollectionMetricSerializer(required=False, allow_null=True)
    by_customer = CollectionByCustomerSerializer(many=True)


class CustomerBreakdownSerializer(serializers.Serializer):
    """Serialize customer breakdown by type"""
    count = serializers.IntegerField()
    total_invoiced = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_due = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    collection_rate = serializers.DecimalField(max_digits=7, decimal_places=2)


class CustomerStatusBreakdownSerializer(serializers.Serializer):
    """Serialize customer status breakdown"""
    count = serializers.IntegerField()
    total_invoiced = serializers.DecimalField(max_digits=18, decimal_places=2)


class CustomerAnalyticsSerializer(serializers.Serializer):
    """Serialize complete customer analytics"""
    total_active_customers = serializers.IntegerField()
    total_customers = serializers.IntegerField()
    customer_breakdown = serializers.DictField(child=CustomerBreakdownSerializer())
    customer_status = serializers.DictField(child=CustomerStatusBreakdownSerializer())


class DueAnalyticsSerializer(serializers.Serializer):
    """Serialize due/outstanding analytics"""
    total_due = serializers.DecimalField(max_digits=18, decimal_places=2)
    invoice_count = serializers.IntegerField()
    overdue_count = serializers.IntegerField()
    overdue_amount = serializers.DecimalField(max_digits=18, decimal_places=2)


class CustomerTypeDetailedSerializer(serializers.Serializer):
    """Serialize detailed analytics for specific customer type"""
    customer_type = serializers.CharField()
    total_customers = serializers.IntegerField()
    active_customers = serializers.IntegerField()
    inactive_customers = serializers.IntegerField()
    suspended_customers = serializers.IntegerField()
    total_invoiced = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_due = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    collection_rate = serializers.DecimalField(max_digits=7, decimal_places=2)


class CustomerTypesAnalyticsSerializer(serializers.Serializer):
    """Serialize all customer types analytics"""
    bandwidth = CustomerTypeDetailedSerializer()
    soho = CustomerTypeDetailedSerializer()


class KAMPerformanceSerializer(serializers.Serializer):
    """Serialize KAM performance metrics"""
    kam_id = serializers.IntegerField()
    kam_name = serializers.CharField()
    customers_count = serializers.IntegerField()
    invoices_count = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=18, decimal_places=2)
    collection_rate = serializers.DecimalField(max_digits=7, decimal_places=2)


class KAMPerformanceAnalyticsSerializer(serializers.Serializer):
    """Serialize complete KAM performance analytics"""
    monthly = KAMPerformanceSerializer(many=True)
    weekly = KAMPerformanceSerializer(many=True)
    overall = KAMPerformanceSerializer(many=True)


class EngagementMetricSerializer(serializers.Serializer):
    """Serialize engagement metrics"""
    period = serializers.CharField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    total_active_customers = serializers.IntegerField()
    engaged_customers = serializers.IntegerField()
    engagement_ratio = serializers.DecimalField(max_digits=5, decimal_places=2)
    disengaged_customers = serializers.IntegerField()


class EngagementAnalyticsSerializer(serializers.Serializer):
    """Serialize complete engagement analytics"""
    weekly = EngagementMetricSerializer()
    monthly = EngagementMetricSerializer()
    yearly = EngagementMetricSerializer()


class ChurnMetricSerializer(serializers.Serializer):
    """Serialize churn metrics"""
    period = serializers.CharField()
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    total_customers = serializers.IntegerField()
    churned_customers = serializers.IntegerField()
    churn_rate = serializers.DecimalField(max_digits=5, decimal_places=2)


class ChurnAnalyticsSerializer(serializers.Serializer):
    """Serialize complete churn analytics"""
    monthly = ChurnMetricSerializer()
    yearly = ChurnMetricSerializer()


class DashboardAnalyticsSerializer(serializers.Serializer):
    """Main Dashboard Analytics Serializer - Combines all analytics"""
    timestamp = serializers.DateTimeField()
    revenue = RevenueAnalyticsSerializer()
    collections = CollectionAnalyticsSerializer()
    customers = CustomerAnalyticsSerializer()
    due = DueAnalyticsSerializer()
    customer_types = CustomerTypesAnalyticsSerializer()
    kam_performance = KAMPerformanceAnalyticsSerializer()
    engagement = EngagementAnalyticsSerializer()
    churn = ChurnAnalyticsSerializer()
