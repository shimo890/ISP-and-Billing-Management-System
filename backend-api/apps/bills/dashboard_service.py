"""
Dashboard Analytics Service - Comprehensive sales analytics calculations
Provides all metrics and KPIs for sales dashboard
"""

from django.db.models import Q, Sum, Count, F, DecimalField, Case, When
from django.utils import timezone
from datetime import datetime, date, timedelta
from decimal import Decimal
from apps.customers.models import CustomerMaster
from apps.bills.models import InvoiceMaster, CustomerEntitlementMaster, CustomerEntitlementDetails
from apps.payment.models import PaymentMaster, PaymentDetails


class DashboardAnalyticsService:
    """Service to calculate all dashboard analytics"""
    
    def __init__(self, start_date=None, end_date=None, custom_start=None, custom_end=None):
        """
        Initialize service with date ranges
        
        Args:
            start_date: Period start (default: today)
            end_date: Period end (default: today)
            custom_start: Custom date range start
            custom_end: Custom date range end
        """
        self.today = date.today()
        self.start_date = start_date or self.today
        self.end_date = end_date or self.today
        self.custom_start = custom_start
        self.custom_end = custom_end
    
    # ==================== REVENUE ANALYTICS ====================
    
    def get_revenue_analytics(self):
        """
        Calculate revenue for daily, weekly, monthly, yearly, and custom periods.
        All periods show cumulative total revenue from first invoice to last (all-time total).
        Period field shows the queried date range.
        """
        # Calculate date ranges
        weekly_start = self.today - timedelta(days=self.today.weekday())
        weekly_end = self.today + timedelta(days=6 - self.today.weekday())
        monthly_start = date(self.today.year, self.today.month, 1)
        yearly_start = date(self.today.year, 1, 1)
        
        return {
            'daily': self._calculate_revenue(self.today, self.today),
            'weekly': self._calculate_revenue(weekly_start, weekly_end),
            'monthly': self._calculate_revenue(monthly_start, self.today),
            'yearly': self._calculate_revenue(yearly_start, self.today),
            'custom': self._calculate_revenue(self.custom_start, self.custom_end) if self.custom_start and self.custom_end else None,
        }
    
    def _calculate_revenue(self, start_date, end_date):
        """
        Calculate total revenue (cumulative from first invoice to last).
        Returns all-time total revenue, but period shows the queried date range.
        
        Args:
            start_date: Period start date (for period display)
            end_date: Period end date (for period display)
        
        Returns:
            dict with cumulative total_revenue (all-time) and period information
        """
        # Calculate cumulative total revenue from first invoice to last (all-time)
        all_time_revenue = InvoiceMaster.objects.aggregate(
            total=Sum('total_bill_amount', output_field=DecimalField()),
            count=Count('id')
        )
        
        # Format period string
        if start_date and end_date:
            period_str = f"{start_date} to {end_date}"
        else:
            period_str = "N/A"
        
        return {
            'total_revenue': all_time_revenue['total'] or Decimal('0'),  # Cumulative all-time total
            'invoice_count': all_time_revenue['count'] or 0,  # Total invoice count (all-time)
            'period': period_str  # Shows the queried period
        }
    
    # ==================== COLLECTION/PAYMENT ANALYTICS ====================
    
    def get_collection_analytics(self):
        """Calculate collection rates and details"""
        return {
            'total_collected': self._get_total_collected_all_time(),
            'daily': self._get_collection_for_period(self.today, self.today),
            'weekly': self._get_collection_for_period(
                self.today - timedelta(days=self.today.weekday()),
                self.today + timedelta(days=6 - self.today.weekday())
            ),
            'monthly': self._get_collection_for_period(
                date(self.today.year, self.today.month, 1),
                self.today
            ),
            'custom': self._get_collection_for_period(self.custom_start, self.custom_end) if self.custom_start and self.custom_end else None,
            'by_customer': self._get_collection_by_customer_all_time(),
        }
    
    def _get_total_collected_all_time(self):
        """Get total amount collected across all time"""
        payments = PaymentDetails.objects.filter(
            status='completed'
        ).aggregate(
            total=Sum('pay_amount', output_field=DecimalField()),
            count=Count('id')
        )
        
        return {
            'total_collected': payments['total'] or Decimal('0'),
            'total_transactions': payments['count'] or 0,
        }
    
    def _get_collection_for_period(self, start_date, end_date):
        """Get collections for a specific period"""
        if not start_date or not end_date:
            return {
                'total_collected': Decimal('0'),
                'transaction_count': 0,
                'collection_rate': Decimal('0'),
                'period': f"{start_date} to {end_date}"
            }
        
        payments = PaymentDetails.objects.filter(
            payment_master_id__payment_date__gte=start_date,
            payment_master_id__payment_date__lte=end_date,
            status='completed'
        ).aggregate(
            total=Sum('pay_amount', output_field=DecimalField()),
            count=Count('id')
        )
        
        invoices = InvoiceMaster.objects.filter(
            issue_date__gte=start_date,
            issue_date__lte=end_date
        ).aggregate(
            total=Sum('total_bill_amount', output_field=DecimalField())
        )
        
        total_collected = payments['total'] or Decimal('0')
        total_invoiced = invoices['total'] or Decimal('0')
        collection_rate = (total_collected / total_invoiced * 100) if total_invoiced > 0 else Decimal('0')
        
        return {
            'total_collected': total_collected,
            'total_invoiced': total_invoiced,
            'transaction_count': payments['count'] or 0,
            'collection_rate': collection_rate,
            'period': f"{start_date} to {end_date}"
        }
    
    def _get_collection_by_customer_all_time(self):
        """Get collection details grouped by customer"""
        customers = CustomerMaster.objects.filter(
            is_active=True
        ).annotate(
            total_invoiced=Sum('invoices__total_bill_amount', output_field=DecimalField()),
            total_collected=Sum(
                'invoices__payments__details__pay_amount',
                output_field=DecimalField(),
                filter=Q(invoices__payments__details__status='completed')
            ),
        ).values(
            'id', 'customer_name', 'customer_type', 'total_invoiced', 'total_collected'
        )
        
        result = []
        for customer in customers:
            total_invoiced = customer['total_invoiced'] or Decimal('0')
            total_collected = customer['total_collected'] or Decimal('0')
            collection_rate = (total_collected / total_invoiced * 100) if total_invoiced > 0 else Decimal('0')
            
            result.append({
                'customer_id': customer['id'],
                'customer_name': customer['customer_name'],
                'customer_type': customer['customer_type'],
                'total_invoiced': total_invoiced,
                'total_collected': total_collected,
                'collection_rate': collection_rate,
                'outstanding_balance': total_invoiced - total_collected,
            })
        
        return result
    
    # ==================== CUSTOMER ANALYTICS ====================
    
    def get_customer_analytics(self):
        """Get comprehensive customer metrics"""
        return {
            'total_active_customers': self._count_active_customers(),
            'total_customers': self._count_total_customers(),
            'customer_breakdown': self._get_customer_breakdown(),
            'customer_status': self._get_customer_status_breakdown(),
        }
    
    def _count_active_customers(self):
        """Count active customers"""
        return CustomerMaster.objects.filter(
            status='active', is_active=True
        ).count()
    
    def _count_total_customers(self):
        """Count total customers"""
        return CustomerMaster.objects.filter(is_active=True).count()
    
    def _get_customer_breakdown(self):
        """Get customer breakdown by type (BW, SOHO)"""
        breakdown = CustomerMaster.objects.filter(
            is_active=True
        ).values('customer_type').annotate(
            count=Count('id'),
            total_invoiced=Sum('invoices__total_bill_amount', output_field=DecimalField()),
            total_due=Sum(
                'invoices__total_balance_due',
                output_field=DecimalField()
            ),
            total_collected=Sum(
                'invoices__payments__details__pay_amount',
                output_field=DecimalField(),
                filter=Q(invoices__payments__details__status='completed')
            )
        )
        
        result = {}
        for item in breakdown:
            customer_type = item['customer_type']
            result[customer_type] = {
                'count': item['count'] or 0,
                'total_invoiced': item['total_invoiced'] or Decimal('0'),
                'total_due': item['total_due'] or Decimal('0'),
                'total_collected': item['total_collected'] or Decimal('0'),
                'collection_rate': self._safe_divide(
                    item['total_collected'] or Decimal('0'),
                    item['total_invoiced'] or Decimal('0')
                ) * 100
            }
        
        return result
    
    def _get_customer_status_breakdown(self):
        """Get customer breakdown by status (active/inactive/suspended)"""
        breakdown = CustomerMaster.objects.filter(
            is_active=True
        ).values('status').annotate(
            count=Count('id'),
            total_invoiced=Sum('invoices__total_bill_amount', output_field=DecimalField()),
        )
        
        return {
            item['status']: {
                'count': item['count'] or 0,
                'total_invoiced': item['total_invoiced'] or Decimal('0'),
            }
            for item in breakdown
        }
    
    # ==================== DUE ANALYTICS ====================
    
    def get_due_analytics(self):
        """Get total due/outstanding amounts"""
        invoices = InvoiceMaster.objects.aggregate(
            total_due=Sum('total_balance_due', output_field=DecimalField()),
            invoice_count=Count('id'),
            overdue_count=Count(
                'id',
                filter=Q(issue_date__lt=self.today - timedelta(days=30))
            )
        )
        
        return {
            'total_due': invoices['total_due'] or Decimal('0'),
            'invoice_count': invoices['invoice_count'] or 0,
            'overdue_count': invoices['overdue_count'] or 0,
            'overdue_amount': self._calculate_overdue_amount(),
        }
    
    def _calculate_overdue_amount(self):
        """Calculate overdue amount (outstanding > 30 days)"""
        thirty_days_ago = self.today - timedelta(days=30)
        overdue = InvoiceMaster.objects.filter(
            issue_date__lt=thirty_days_ago,
            total_balance_due__gt=0
        ).aggregate(
            total=Sum('total_balance_due', output_field=DecimalField())
        )
        
        return overdue['total'] or Decimal('0')
    
    # ==================== CUSTOMER TYPE DETAILED ANALYTICS ====================
    
    def get_bw_customer_analytics(self):
        """Get BW (Bandwidth) customer specific analytics"""
        return self._get_customer_type_analytics(CustomerMaster.CUSTOMER_TYPE_BW)
    
    def get_soho_customer_analytics(self):
        """Get SOHO customer specific analytics"""
        return self._get_customer_type_analytics(CustomerMaster.CUSTOMER_TYPE_SOHO)
    
    def _get_customer_type_analytics(self, customer_type):
        """Get detailed analytics for a specific customer type"""
        customers = CustomerMaster.objects.filter(
            customer_type=customer_type,
            is_active=True
        )
        
        stats = customers.aggregate(
            total_count=Count('id'),
            active_count=Count('id', filter=Q(status='active')),
            inactive_count=Count('id', filter=Q(status='inactive')),
            suspended_count=Count('id', filter=Q(status='suspended')),
            total_invoiced=Sum('invoices__total_bill_amount', output_field=DecimalField()),
            total_due=Sum('invoices__total_balance_due', output_field=DecimalField()),
            total_collected=Sum(
                'invoices__payments__details__pay_amount',
                output_field=DecimalField(),
                filter=Q(invoices__payments__details__status='completed')
            ),
        )
        
        return {
            'customer_type': customer_type,
            'total_customers': stats['total_count'] or 0,
            'active_customers': stats['active_count'] or 0,
            'inactive_customers': stats['inactive_count'] or 0,
            'suspended_customers': stats['suspended_count'] or 0,
            'total_invoiced': stats['total_invoiced'] or Decimal('0'),
            'total_due': stats['total_due'] or Decimal('0'),
            'total_collected': stats['total_collected'] or Decimal('0'),
            'collection_rate': self._safe_divide(
                stats['total_collected'] or Decimal('0'),
                stats['total_invoiced'] or Decimal('0')
            ) * 100,
        }
    
    # ==================== KAM PERFORMANCE ANALYTICS ====================
    
    def get_kam_performance_analytics(self):
        """Get KAM performance metrics (monthly, weekly)"""
        return {
            'monthly': self._get_kam_performance_for_period(
                date(self.today.year, self.today.month, 1),
                self.today
            ),
            'weekly': self._get_kam_performance_for_period(
                self.today - timedelta(days=self.today.weekday()),
                self.today
            ),
            'overall': self._get_kam_performance_overall(),
        }
    
    def _get_kam_performance_for_period(self, start_date, end_date):
        """Get KAM performance for a specific period"""
        kams = CustomerMaster.objects.filter(
            is_active=True,
            kam_id__isnull=False
        ).values(
            'kam_id__id', 'kam_id__kam_name'
        ).annotate(
            customers_count=Count('id'),
            invoices_count=Count('invoices', filter=Q(
                invoices__issue_date__gte=start_date,
                invoices__issue_date__lte=end_date
            )),
            total_revenue=Sum(
                'invoices__total_bill_amount',
                output_field=DecimalField(),
                filter=Q(
                    invoices__issue_date__gte=start_date,
                    invoices__issue_date__lte=end_date
                )
            ),
        ).order_by('-total_revenue')
        
        # Calculate collection separately for each KAM
        result = []
        for kam in kams:
            kam_id = kam['kam_id__id']
            kam_name = kam['kam_id__kam_name']
            customers_count = kam['customers_count'] or 0
            invoices_count = kam['invoices_count'] or 0
            total_revenue = kam['total_revenue'] or Decimal('0')
            
            # Get collected amount for this KAM in the period
            total_collected = Decimal('0')
            payments = PaymentDetails.objects.filter(
                payment_master_id__payment_date__gte=start_date,
                payment_master_id__payment_date__lte=end_date,
                payment_master_id__invoice_master_id__customer_entitlement_master_id__customer_master_id__kam_id=kam_id,
                status='completed'
            ).aggregate(total=Sum('pay_amount', output_field=DecimalField()))
            total_collected = payments['total'] or Decimal('0')
            
            collection_rate = self._safe_divide(total_collected, total_revenue) * 100
            
            result.append({
                'kam_id': kam_id,
                'kam_name': kam_name,
                'customers_count': customers_count,
                'invoices_count': invoices_count,
                'total_revenue': total_revenue,
                'total_collected': total_collected,
                'collection_rate': collection_rate,
            })
        
        return result
    
    def _get_kam_performance_overall(self):
        """Get overall KAM performance"""
        return self._get_kam_performance_for_period(
            date(self.today.year, 1, 1),
            self.today
        )
    
    # ==================== CUSTOMER ENGAGEMENT ANALYTICS ====================
    
    def get_engagement_analytics(self):
        """Get customer engagement ratio for weekly, monthly, yearly"""
        return {
            'weekly': self._get_engagement_for_period(
                self.today - timedelta(days=self.today.weekday()),
                self.today + timedelta(days=6 - self.today.weekday()),
                'weekly'
            ),
            'monthly': self._get_engagement_for_period(
                date(self.today.year, self.today.month, 1),
                self.today,
                'monthly'
            ),
            'yearly': self._get_engagement_for_period(
                date(self.today.year, 1, 1),
                self.today,
                'yearly'
            ),
        }
    
    def _get_engagement_for_period(self, start_date, end_date, period_type):
        """
        Calculate engagement ratio
        Engagement = customers with invoices in period / total active customers
        """
        total_active = self._count_active_customers()
        
        engaged_customers = CustomerMaster.objects.filter(
            status='active',
            is_active=True,
            invoices__issue_date__gte=start_date,
            invoices__issue_date__lte=end_date
        ).distinct().count()
        
        engagement_ratio = (engaged_customers / total_active * 100) if total_active > 0 else Decimal('0')
        
        return {
            'period': period_type,
            'start_date': start_date,
            'end_date': end_date,
            'total_active_customers': total_active,
            'engaged_customers': engaged_customers,
            'engagement_ratio': engagement_ratio,
            'disengaged_customers': total_active - engaged_customers,
        }
    
    # ==================== CUSTOMER CHURN ANALYTICS ====================
    
    def get_churn_analytics(self):
        """Get customer churn/loss/disconnect ratio (monthly, yearly)"""
        return {
            'monthly': self._get_churn_for_period(
                date(self.today.year, self.today.month, 1),
                self.today,
                'monthly'
            ),
            'yearly': self._get_churn_for_period(
                date(self.today.year, 1, 1),
                self.today,
                'yearly'
            ),
        }
    
    def _get_churn_for_period(self, start_date, end_date, period_type):
        """
        Calculate churn rate
        Churn = customers who became inactive/suspended in period / total customers at start of period
        """
        churned_customers = CustomerMaster.objects.filter(
            is_active=False,
            updated_at__gte=start_date,
            updated_at__lte=end_date
        ).count() + CustomerMaster.objects.filter(
            status__in=['inactive', 'suspended'],
            updated_at__gte=start_date,
            updated_at__lte=end_date
        ).count()
        
        total_customers = self._count_total_customers()
        churn_rate = (churned_customers / total_customers * 100) if total_customers > 0 else Decimal('0')
        
        return {
            'period': period_type,
            'start_date': start_date,
            'end_date': end_date,
            'total_customers': total_customers,
            'churned_customers': churned_customers,
            'churn_rate': churn_rate,
        }
    
    # ==================== UTILITY METHODS ====================
    
    def _safe_divide(self, numerator, denominator):
        """Safely divide two decimal numbers"""
        if denominator == 0 or not denominator:
            return Decimal('0')
        return Decimal(numerator) / Decimal(denominator)
    
    # ==================== COMPLETE DASHBOARD ANALYTICS ====================
    
    def get_complete_dashboard_analytics(self):
        """Get all analytics in one comprehensive response"""
        return {
            'timestamp': timezone.now(),
            'revenue': self.get_revenue_analytics(),
            'collections': self.get_collection_analytics(),
            'customers': self.get_customer_analytics(),
            'due': self.get_due_analytics(),
            'customer_types': {
                'bandwidth': self.get_bw_customer_analytics(),
                'soho': self.get_soho_customer_analytics(),
            },
            'kam_performance': self.get_kam_performance_analytics(),
            'engagement': self.get_engagement_analytics(),
            'churn': self.get_churn_analytics(),
        }
