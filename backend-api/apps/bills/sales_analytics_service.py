"""
Sales Analytics Service - Advanced sales & revenue analytics for ISP billing.
Supports date filters: monthly, bi-weekly, custom range.
"""

import calendar

from collections import defaultdict

from django.db.models import Q, Sum, Count, Min, DecimalField, Prefetch
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal

from apps.customers.models import CustomerMaster, KAMMaster
from apps.bills.models import (
    CustomerEntitlementMaster,
    CustomerEntitlementDetails,
    InvoiceMaster,
)
from apps.bills.ledger_service import get_all_customers_ledger_summary
def get_date_range(period=None, from_date=None, to_date=None):
    """
    Resolve start and end dates from period or custom range.
    - weekly: last 7 days ending today (or to_date)
    - biweekly: last 14 days inclusive ending today (or to_date)
    - monthly: current calendar month to today (or from_date/to_date if both set)
    - quarterly: current calendar quarter start to today
    - yearly: Jan 1 of current year through today (or custom from_date/to_date)
    - custom: from_date and to_date required
    """
    today = date.today()
    start, end = None, None
    period = (period or 'monthly').lower().replace('-', '')

    if period == 'custom':
        if from_date and to_date:
            start, end = from_date, to_date
        else:
            return (None, None)
    elif period == 'weekly':
        end = to_date or today
        start = from_date or (end - timedelta(days=6))
    elif period == 'biweekly':
        end = to_date or today
        start = from_date or (end - timedelta(days=13))
    elif period == 'monthly':
        if from_date and to_date:
            start, end = from_date, to_date
        else:
            start = date(today.year, today.month, 1)
            end = today
    elif period == 'quarterly':
        if from_date and to_date:
            start, end = from_date, to_date
        else:
            q = (today.month - 1) // 3
            start = date(today.year, q * 3 + 1, 1)
            end = today
    elif period == 'yearly':
        if from_date and to_date:
            start, end = from_date, to_date
        else:
            start = date(today.year, 1, 1)
            end = today
    else:
        start = date(today.year, today.month, 1)
        end = today

    if start and end and start > end:
        return (end, start)
    return (start, end)


def get_kam_growth_churn_date_range(period=None, from_date=None, to_date=None):
    """
    Date window for KAM Growth & Churn report.

    For weekly, biweekly, and quarterly presets (when not custom), expands the range to
    the rolling window: first day of (current month minus 2 months) through the same end
    date as get_date_range — i.e. roughly “last two months plus current month” aligned to
    month boundaries, so multiple monthly buckets appear in the report.
    """
    start, end = get_date_range(period=period, from_date=from_date, to_date=to_date)
    if not start or not end:
        return start, end
    period_norm = (period or "monthly").lower().replace("-", "")
    if period_norm == "custom":
        return start, end
    if period_norm in ("weekly", "biweekly", "quarterly"):
        y, m = end.year, end.month
        m0 = m - 2
        y0 = y
        while m0 < 1:
            m0 += 12
            y0 -= 1
        roll_start = date(y0, m0, 1)
        return roll_start, end
    return start, end


class SalesAnalyticsService:
    """Advanced sales and revenue analytics with date filtering."""

    def __init__(self, start_date=None, end_date=None, kam_id=None, customer_id=None):
        self.start_date = start_date
        self.end_date = end_date
        self.kam_id = kam_id
        self.customer_id = customer_id

    def _safe_decimal(self, v):
        return v if v is not None else Decimal('0')

    def get_kam_total_capacity_mbps_map(self):
        """
        Sum Mbps per KAM from active entitlement details overlapping the selected period.
        Uses Entitlements Details + Customer Master (KAM assignment).
        """
        if not self.start_date or not self.end_date:
            return {}
        base = CustomerEntitlementDetails.objects.filter(
            cust_entitlement_id__customer_master_id__is_active=True,
            is_active=True,
            status='active',
            cust_entitlement_id__customer_master_id__kam_id__isnull=False,
        ).filter(
            Q(start_date__lte=self.end_date) & (Q(end_date__gte=self.start_date) | Q(end_date__isnull=True))
        )
        if self.kam_id:
            base = base.filter(cust_entitlement_id__customer_master_id__kam_id_id=self.kam_id)
        rows = base.values('cust_entitlement_id__customer_master_id__kam_id__id').annotate(
            total_mbps=Sum('mbps', output_field=DecimalField())
        )
        return {
            r['cust_entitlement_id__customer_master_id__kam_id__id']: self._safe_decimal(r['total_mbps'])
            for r in rows
        }

    # ------------------------- Revenue Summary -------------------------

    def get_revenue_summary(self):
        """Total Active MRC, New MRC in period, Lost MRC, Net Growth."""
        # Total Active Customer MRC = sum of entitlement total_bill for active customers (current)
        active_mrc = CustomerEntitlementMaster.objects.filter(
            customer_master_id__is_active=True,
            customer_master_id__status='active',
        ).aggregate(
            total=Sum('total_bill', output_field=DecimalField())
        )['total'] or Decimal('0')

        # New MRC this period = sum of total_bill for entitlements activated in period
        new_mrc = Decimal('0')
        if self.start_date and self.end_date:
            new_mrc = CustomerEntitlementMaster.objects.filter(
                activation_date__gte=self.start_date,
                activation_date__lte=self.end_date,
                customer_master_id__is_active=True,
            ).aggregate(
                total=Sum('total_bill', output_field=DecimalField())
            )['total'] or Decimal('0')

        # Lost MRC = revenue loss from customers terminated in period
        terminated_in_period = CustomerMaster.objects.filter(
            is_active=True,
            status__in=['inactive', 'suspended'],
            updated_at__date__gte=self.start_date,
            updated_at__date__lte=self.end_date,
        ) if (self.start_date and self.end_date) else CustomerMaster.objects.none()
        lost_mrc = Decimal('0')
        for cust in terminated_in_period:
            lost_mrc += CustomerEntitlementMaster.objects.filter(
                customer_master_id=cust
            ).aggregate(t=Sum('total_bill', output_field=DecimalField()))['t'] or Decimal('0')

        net_growth = new_mrc - lost_mrc

        return {
            'total_active_mrc': active_mrc,
            'new_mrc_this_period': new_mrc,
            'lost_mrc': lost_mrc,
            'net_growth': net_growth,
        }

    # ------------------------- KAM Sales Overview -------------------------

    def get_kam_sales_overview(self):
        """
        Total Sales MRC per KAM in the selected period (from invoices in period),
        plus number of customers with invoices in this period per KAM.
        """
        if not self.start_date or not self.end_date:
            return []

        qs = InvoiceMaster.objects.filter(
            issue_date__gte=self.start_date,
            issue_date__lte=self.end_date,
            customer_entitlement_master_id__customer_master_id__kam_id__isnull=False,
        )
        if self.kam_id:
            qs = qs.filter(
                customer_entitlement_master_id__customer_master_id__kam_id_id=self.kam_id
            )

        kam_totals = (
            qs.values(
                'customer_entitlement_master_id__customer_master_id__kam_id__id',
                'customer_entitlement_master_id__customer_master_id__kam_id__kam_name',
            )
            .annotate(
                total_sales_mrc=Sum('total_bill_amount', output_field=DecimalField()),
                invoiced_customers_count=Count(
                    'customer_entitlement_master_id__customer_master_id',
                    distinct=True,
                ),
            )
            .order_by('-total_sales_mrc')
        )

        cap_map = self.get_kam_total_capacity_mbps_map()
        
        # Get actual assigned customer count per KAM (status='active', is_active=True)
        # Using status='active' gives the true current customer base size
        cust_counts = dict(
            CustomerMaster.objects.filter(is_active=True, status='active', kam_id__isnull=False)
            .values('kam_id_id')
            .annotate(count=Count('id', distinct=True))
            .values_list('kam_id_id', 'count')
        )

        return [
            {
                'kam_id': r['customer_entitlement_master_id__customer_master_id__kam_id__id'],
                'kam_name': r['customer_entitlement_master_id__customer_master_id__kam_id__kam_name'],
                'total_sales_mrc': self._safe_decimal(r['total_sales_mrc']),
                'customers_count': cust_counts.get(r['customer_entitlement_master_id__customer_master_id__kam_id__id'], 0),
                'total_capacity_mbps': cap_map.get(
                    r['customer_entitlement_master_id__customer_master_id__kam_id__id'],
                    Decimal('0'),
                ),
            }
            for r in kam_totals
        ]

    # ------------------------- KAM Detailed Sales Breakdown -------------------------

    def get_kam_detailed_breakdown(self, kam_id):
        """
        Per-KAM breakdown by service type (package name from PackageMaster).
        Uses EntitlementDetails + PackageMaster. Only "Others" when package_master_id is null or package_name blank.
        service_lines = number of entitlement detail lines for that service (clearer than "qty").
        """
        details = CustomerEntitlementDetails.objects.filter(
            cust_entitlement_id__customer_master_id__kam_id_id=kam_id,
            cust_entitlement_id__customer_master_id__is_active=True,
            is_active=True,
            status='active',
        ).select_related(
            'package_master_id',
            'package_pricing_id',
            'package_pricing_id__package_master_id',
            'cust_entitlement_id',
            'cust_entitlement_id__customer_master_id',
        )

        if self.start_date and self.end_date:
            details = details.filter(
                Q(start_date__lte=self.end_date) & (Q(end_date__gte=self.start_date) | Q(end_date__isnull=True))
            )

        # Key by display name: use package name when available, otherwise "Others"
        service_totals = {}
        total_capacity = Decimal('0')
        total_mrc = Decimal('0')

        for d in details:
            pkg = d.package_master_id or (getattr(d.package_pricing_id, 'package_master_id', None) if d.package_pricing_id else None)
            service_name = (pkg.package_name or '').strip() if pkg else 'Others'
            if not service_name:
                service_name = 'Others'
            if service_name not in service_totals:
                service_totals[service_name] = {'mbps': Decimal('0'), 'mrc': Decimal('0'), 'service_lines': 0}
            mbps = (d.mbps or Decimal('0'))
            service_totals[service_name]['mbps'] += mbps
            service_totals[service_name]['service_lines'] += 1
            # MRC: BW/MAC = mbps * unit_price; SOHO = package rate
            monthly = (d.mbps or Decimal('0')) * (d.unit_price or Decimal('0'))
            if monthly == 0 and d.package_pricing_id and getattr(d.package_pricing_id, 'rate', None):
                monthly = d.package_pricing_id.rate or Decimal('0')
            service_totals[service_name]['mrc'] += monthly
            total_capacity += mbps
            total_mrc += monthly

        # Sort by service name; "Others" last
        sorted_names = sorted(service_totals.keys(), key=lambda x: (x == 'Others', x))
        rows = [
            {
                'service_type': name,
                'total_mbps': service_totals[name]['mbps'],
                'service_lines': service_totals[name]['service_lines'],
                # qty = same as service_lines: count of entitlement detail rows (billing lines) for this package
                'qty': service_totals[name]['service_lines'],
                'total_mrc': service_totals[name]['mrc'],
            }
            for name in sorted_names
        ]
        kam = KAMMaster.objects.filter(pk=kam_id).first()
        return {
            'kam_id': kam_id,
            'kam_name': kam.kam_name if kam else '',
            'by_service': rows,
            'total_capacity_mbps': total_capacity,
            'total_mrc': total_mrc,
        }

    def get_service_sales_overview(self):
        """
        Aggregate MRC, Mbps, and qty (entitlement detail line count) per service package
        for the date range and optional KAM filter. Replaces a simple MAC vs B/M split with
        explicit package-level sales analytics.
        """
        if not self.start_date or not self.end_date:
            return []

        details = CustomerEntitlementDetails.objects.filter(
            cust_entitlement_id__customer_master_id__is_active=True,
            is_active=True,
            status='active',
            cust_entitlement_id__customer_master_id__kam_id__isnull=False,
        ).select_related(
            'package_master_id',
            'package_pricing_id',
            'package_pricing_id__package_master_id',
            'cust_entitlement_id',
        )
        if self.kam_id:
            details = details.filter(
                cust_entitlement_id__customer_master_id__kam_id_id=self.kam_id
            )
        details = details.filter(
            Q(start_date__lte=self.end_date)
            & (Q(end_date__gte=self.start_date) | Q(end_date__isnull=True))
        )

        service_totals = {}
        for d in details:
            pkg = d.package_master_id or (
                getattr(d.package_pricing_id, 'package_master_id', None) if d.package_pricing_id else None
            )
            service_name = (pkg.package_name or '').strip() if pkg else 'Others'
            if not service_name:
                service_name = 'Others'
            if service_name not in service_totals:
                service_totals[service_name] = {'mbps': Decimal('0'), 'mrc': Decimal('0'), 'qty': 0}
            mbps = d.mbps or Decimal('0')
            service_totals[service_name]['mbps'] += mbps
            service_totals[service_name]['qty'] += 1
            monthly = mbps * (d.unit_price or Decimal('0'))
            if monthly == 0 and d.package_pricing_id and getattr(d.package_pricing_id, 'rate', None):
                monthly = d.package_pricing_id.rate or Decimal('0')
            service_totals[service_name]['mrc'] += monthly

        sorted_names = sorted(service_totals.keys(), key=lambda x: (x == 'Others', x))
        return [
            {
                'service_type': name,
                'total_mbps': service_totals[name]['mbps'],
                'qty': service_totals[name]['qty'],
                'total_mrc': service_totals[name]['mrc'],
            }
            for name in sorted_names
        ]

    # ------------------------- Customers Under KAM -------------------------

    def get_customers_under_kam(self, kam_id):
        """All customers assigned to the selected KAM with service type, capacity, MRC, status."""
        customers = CustomerMaster.objects.filter(
            kam_id_id=kam_id,
            is_active=True,
        ).prefetch_related(
            'entitlements',
            'entitlements__details',
            'entitlements__details__package_master_id',
            'entitlements__details__package_pricing_id__package_master_id',
        )

        result = []
        for c in customers:
            status_label = 'Active'
            if c.status == 'inactive':
                status_label = 'Terminated'
            elif c.created_at and self.start_date and self.end_date and self.start_date <= c.created_at.date() <= self.end_date:
                status_label = 'New Customer'
            total_mbps = Decimal('0')
            total_mrc = Decimal('0')
            service_types = set()
            line_qty = 0
            for ent in c.entitlements.all():
                total_mrc += ent.total_bill or Decimal('0')
                for det in ent.details.filter(is_active=True, status='active'):
                    line_qty += 1
                    total_mbps += det.mbps or Decimal('0')
                    pkg = det.package_master_id or (getattr(det.package_pricing_id, 'package_master_id', None) if det.package_pricing_id else None)
                    pname = (pkg.package_name or '').strip() if pkg else ''
                    service_types.add(pname if pname else 'Others')
            result.append({
                'customer_id': c.id,
                'customer_name': c.customer_name,
                'company_name': c.company_name or '',
                'service_type': ', '.join(sorted(service_types)) if service_types else 'Others',
                'capacity_mbps': total_mbps,
                'qty': line_qty,
                'mrc': total_mrc,
                'status': c.status,
                'status_display': status_label,
            })
        return result

    # ------------------------- New Customer Tracking -------------------------

    def get_new_customers(self):
        """Customers with entitlement activated in the selected period."""
        if not self.start_date or not self.end_date:
            return []

        q = CustomerEntitlementMaster.objects.filter(
            activation_date__gte=self.start_date,
            activation_date__lte=self.end_date,
            customer_master_id__is_active=True,
        )
        if self.customer_id:
            q = q.filter(customer_master_id_id=self.customer_id)
        ents = q.select_related('customer_master_id', 'customer_master_id__kam_id').prefetch_related('details')

        seen = set()
        result = []
        for ent in ents:
            c = ent.customer_master_id
            if c.id in seen:
                continue
            seen.add(c.id)
            total_mbps = sum((d.mbps or 0) for d in ent.details.filter(is_active=True, status='active'))
            result.append({
                'customer_id': c.id,
                'customer_name': c.customer_name,
                'company_name': c.company_name or '',
                'kam_id': c.kam_id_id,
                'kam_name': c.kam_id.kam_name if c.kam_id else '',
                'activation_date': ent.activation_date,
                'mrc': ent.total_bill or Decimal('0'),
                'capacity_mbps': total_mbps,
            })
        return result

    # ------------------------- Terminated Customer Tracking -------------------------

    def get_terminated_customers(self):
        """Customers whose status became inactive/suspended in the selected period; revenue loss."""
        if not self.start_date or not self.end_date:
            return []

        q = CustomerMaster.objects.filter(
            status__in=['inactive', 'suspended'],
            updated_at__date__gte=self.start_date,
            updated_at__date__lte=self.end_date,
        )
        if self.customer_id:
            q = q.filter(pk=self.customer_id)
        terminated = q.order_by('-updated_at')

        result = []
        for c in terminated:
            last_mrc = CustomerEntitlementMaster.objects.filter(
                customer_master_id=c
            ).aggregate(t=Sum('total_bill', output_field=DecimalField()))['t'] or Decimal('0')
            result.append({
                'customer_id': c.id,
                'customer_name': c.customer_name,
                'company_name': c.company_name or '',
                'kam_id': c.kam_id_id if c.kam_id else None,
                'kam_name': c.kam_id.kam_name if c.kam_id else '',
                'termination_date': c.updated_at.date() if c.updated_at else None,
                'last_mrc': last_mrc,
                'revenue_loss': last_mrc,
            })
        return result

    # ------------------------- KAM Performance Report -------------------------

    def get_kam_performance_report(self):
        """KAM | Total Sales MRC | Total Revenue (collected) | Termination Loss."""
        if not self.start_date or not self.end_date:
            return []

        from apps.payment.models import PaymentDetails

        kams = CustomerMaster.objects.filter(
            is_active=True,
            kam_id__isnull=False,
        ).values('kam_id__id', 'kam_id__kam_name').distinct()

        result = []
        for kam in kams:
            kam_id = kam['kam_id__id']
            kam_name = kam['kam_id__kam_name']
            total_sales_mrc = InvoiceMaster.objects.filter(
                issue_date__gte=self.start_date,
                issue_date__lte=self.end_date,
                customer_entitlement_master_id__customer_master_id__kam_id_id=kam_id,
            ).aggregate(t=Sum('total_bill_amount', output_field=DecimalField()))['t'] or Decimal('0')

            total_revenue = PaymentDetails.objects.filter(
                status='completed',
                payment_master_id__payment_date__gte=self.start_date,
                payment_master_id__payment_date__lte=self.end_date,
                payment_master_id__invoice_master_id__customer_entitlement_master_id__customer_master_id__kam_id_id=kam_id,
            ).aggregate(t=Sum('pay_amount', output_field=DecimalField()))['t'] or Decimal('0')

            term_loss = Decimal('0')
            for c in CustomerMaster.objects.filter(kam_id_id=kam_id, status__in=['inactive', 'suspended'],
                    updated_at__date__gte=self.start_date, updated_at__date__lte=self.end_date):
                term_loss += CustomerEntitlementMaster.objects.filter(customer_master_id=c).aggregate(
                    t=Sum('total_bill', output_field=DecimalField()))['t'] or Decimal('0')

            result.append({
                'kam_id': kam_id,
                'kam_name': kam_name,
                'total_sales_mrc': total_sales_mrc,
                'total_revenue': total_revenue,
                'termination_loss': term_loss,
            })
        result.sort(key=lambda x: x['total_sales_mrc'] or 0, reverse=True)
        return result

    def get_kam_performance_row(self, kam_id):
        """Single KAM row from performance report (for detail page header)."""
        for row in self.get_kam_performance_report():
            if row['kam_id'] == kam_id:
                return row
        return None

    # ------------------------- KAM Performance Drill-Down -------------------------

    def get_kam_performance_drilldown(self, kam_id):
        """Per-KAM by service type: Total Mbps, Service lines, MRC. Grand Total MRC."""
        data = self.get_kam_detailed_breakdown(kam_id)
        rows = []
        for row in data.get('by_service', []):
            rows.append({
                'service_type': row['service_type'],
                'total_mbps': row['total_mbps'],
                'service_lines': row.get('service_lines', row.get('qty', 0)),
                'qty': row.get('qty', row.get('service_lines', 0)),
                'capacity_mbps': row['total_mbps'],
                'mrc': row['total_mrc'],
            })
        return {
            'kam_id': data['kam_id'],
            'kam_name': data['kam_name'],
            'rows': rows,
            'grand_total_mrc': data.get('total_mrc') or Decimal('0'),
        }

    # ------------------------- Chart Data -------------------------

    def get_chart_kam_sales_comparison(self):
        """Data for KAM Sales Comparison chart."""
        overview = self.get_kam_sales_overview()
        return [{'name': o['kam_name'], 'value': float(o['total_sales_mrc']), 'mrc': o['total_sales_mrc']} for o in overview]

    def get_chart_monthly_revenue_trend(self):
        """Monthly revenue trend (last 12 months or period)."""
        from django.db.models.functions import TruncMonth

        end = self.end_date or date.today()
        start = self.start_date or (end - timedelta(days=365))
        months = InvoiceMaster.objects.filter(
            issue_date__gte=start,
            issue_date__lte=end,
        ).annotate(
            month=TruncMonth('issue_date')
        ).values('month').annotate(
            revenue=Sum('total_bill_amount', output_field=DecimalField()),
        ).order_by('month')
        return [{'month': str(m['month'])[:7], 'revenue': float(m['revenue'] or 0)} for m in months]

    def _iter_report_buckets(self, period: str):
        """
        Calendar buckets within [start_date, end_date] for growth/churn report.
        weekly / biweekly: consecutive windows from start_date.
        monthly, quarterly, yearly, custom: one bucket per calendar month that overlaps the range.
        """
        start, end = self.start_date, self.end_date
        if not start or not end:
            return
        period_norm = (period or "monthly").lower().replace("-", "")

        if period_norm == "weekly":
            cur = start
            wk = 0
            while cur <= end:
                wk += 1
                bucket_end = min(cur + timedelta(days=6), end)
                yield {
                    "key": f"w{wk}",
                    "label": f"Week {wk}: {cur.strftime('%d %b %Y')} – {bucket_end.strftime('%d %b %Y')}",
                    "start": cur,
                    "end": bucket_end,
                }
                cur = bucket_end + timedelta(days=1)
            return

        if period_norm == "biweekly":
            cur = start
            wk = 0
            while cur <= end:
                wk += 1
                bucket_end = min(cur + timedelta(days=13), end)
                yield {
                    "key": f"bw{wk}",
                    "label": f"Bi-week {wk}: {cur.strftime('%d %b %Y')} – {bucket_end.strftime('%d %b %Y')}",
                    "start": cur,
                    "end": bucket_end,
                }
                cur = bucket_end + timedelta(days=1)
            return

        y, m = start.year, start.month
        while True:
            month_start = date(y, m, 1)
            if month_start > end:
                break
            last_d = calendar.monthrange(y, m)[1]
            month_end = date(y, m, last_d)
            eff_start = max(month_start, start)
            eff_end = min(month_end, end)
            if eff_start <= eff_end:
                yield {
                    "key": f"{y}-{m:02d}",
                    "label": f"{calendar.month_name[m]}-{y}",
                    "start": eff_start,
                    "end": eff_end,
                }
            if m == 12:
                y += 1
                m = 1
            else:
                m += 1

    def _bucket_key_for_date(self, d: date, buckets):
        for b in buckets:
            if b["start"] <= d <= b["end"]:
                return b["key"]
        return None

    def _row_capacity_mbps_from_entitlement(self, ent):
        """Prefer sum of active detail Mbps; else try numeric nttn_capacity."""
        if not ent:
            return Decimal("0")
        total = Decimal("0")
        for d in ent.details.all():
            if d.mbps is not None:
                total += Decimal(str(d.mbps))
        if total > 0:
            return total
        raw = (ent.nttn_capacity or "").strip()
        if raw:
            try:
                return Decimal(str(raw).replace(",", ""))
            except Exception:
                pass
        return Decimal("0")

    def _detail_active_on_date(self, detail, as_of: date) -> bool:
        if not as_of:
            return False
        if detail.start_date and detail.start_date > as_of:
            return False
        if detail.end_date and detail.end_date < as_of:
            return False
        return True

    def _monthly_mrc_from_detail(self, detail, customer) -> Decimal:
        """Recurring monthly charge from one entitlement detail (BW / SOHO)."""
        ctype = (customer.customer_type or "") if customer else ""
        mbps = detail.mbps or Decimal("0")
        unit_price = detail.unit_price or Decimal("0")
        monthly = mbps * unit_price
        if monthly == 0 and detail.package_pricing_id and getattr(
            detail.package_pricing_id, "rate", None
        ):
            monthly = detail.package_pricing_id.rate or Decimal("0")
        return monthly if monthly is not None else Decimal("0")

    def _computed_mrc_entitlement_as_of(self, ent, as_of: date) -> Decimal:
        """Sum of monthly MRC from entitlement lines that cover as_of (no invoice totals)."""
        if not ent or not as_of:
            return Decimal("0")
        customer = ent.customer_master_id
        total = Decimal("0")
        for detail in ent.details.all():
            if not self._detail_active_on_date(detail, as_of):
                continue
            total += self._monthly_mrc_from_detail(detail, customer)
        return total

    def _row_capacity_mbps_as_of(self, ent, as_of: date) -> Decimal:
        if not ent or not as_of:
            return Decimal("0")
        total = Decimal("0")
        for d in ent.details.all():
            if not self._detail_active_on_date(d, as_of):
                continue
            if d.mbps is not None:
                total += Decimal(str(d.mbps))
        if total > 0:
            return total
        raw = (ent.nttn_capacity or "").strip()
        if raw:
            try:
                return Decimal(str(raw).replace(",", ""))
            except Exception:
                pass
        return Decimal("0")

    def _first_invoice_facts_by_customer(self, customer_ids):
        """
        Per customer: min(issue_date) across all invoices, and total billed on that first billing
        day (sums all invoices on that date — e.g. multiple entitlements).
        """
        if not customer_ids:
            return {}
        pairs = list(
            InvoiceMaster.objects.filter(
                customer_entitlement_master_id__customer_master_id__in=customer_ids
            )
            .values("customer_entitlement_master_id__customer_master_id")
            .annotate(first_issue=Min("issue_date"))
        )
        cid_to_fd = {
            r["customer_entitlement_master_id__customer_master_id"]: r["first_issue"]
            for r in pairs
        }
        if not cid_to_fd:
            return {}
        q = Q()
        for cid, fd in cid_to_fd.items():
            q |= Q(customer_entitlement_master_id__customer_master_id=cid, issue_date=fd)
        rows = InvoiceMaster.objects.filter(q).values(
            "customer_entitlement_master_id__customer_master_id", "total_bill_amount"
        )
        sums = defaultdict(lambda: Decimal("0"))
        for row in rows:
            cid = row["customer_entitlement_master_id__customer_master_id"]
            sums[cid] += row["total_bill_amount"] or Decimal("0")
        return {
            cid: {"first_date": cid_to_fd[cid], "mrc_amount": sums[cid]}
            for cid in cid_to_fd
        }

    def _last_billed_mrc_before_termination(self, customer_id: int, termination_date: date) -> Decimal:
        """Sum of all invoice amounts on the latest issue_date on or before termination (real billed)."""
        if not termination_date:
            return Decimal("0")
        invs = InvoiceMaster.objects.filter(
            customer_entitlement_master_id__customer_master_id=customer_id,
            issue_date__lte=termination_date,
        ).order_by("-issue_date", "-id")
        first = invs.first()
        if not first:
            return Decimal("0")
        last_date = first.issue_date
        total = (
            InvoiceMaster.objects.filter(
                customer_entitlement_master_id__customer_master_id=customer_id,
                issue_date=last_date,
            ).aggregate(t=Sum("total_bill_amount", output_field=DecimalField()))["t"]
            or Decimal("0")
        )
        return total

    def _merge_nttn_labels(self, *labels):
        parts = []
        for lb in labels:
            if not lb:
                continue
            for p in str(lb).split(","):
                t = p.strip()
                if t:
                    parts.append(t)
        return ", ".join(sorted(set(parts))) if parts else ""

    def _aggregate_onboarding_by_customer(self, raw_rows):
        """Merge rows for the same customer in the same bucket (sum MRC & capacity)."""
        by_cust = {}
        order = []
        for pr in raw_rows:
            cid = pr["customer_id"]
            if cid not in by_cust:
                by_cust[cid] = {**pr}
                order.append(cid)
                continue
            acc = by_cust[cid]
            acc["bill_amount"] += pr["bill_amount"]
            acc["invoice_bill_amount"] = acc["bill_amount"]
            acc["capacity_mbps"] += pr["capacity_mbps"]
            pa, aa = pr.get("activation_date"), acc.get("activation_date")
            if pa and (aa is None or pa < aa):
                acc["activation_date"] = pr["activation_date"]
                acc["activation_date_display"] = pr["activation_date_display"]
            pf, af = pr.get("first_invoice_date"), acc.get("first_invoice_date")
            if pf and (af is None or pf < af):
                acc["first_invoice_date"] = pr["first_invoice_date"]
                acc["first_invoice_date_display"] = pr["first_invoice_date_display"]
            acc["nttn"] = self._merge_nttn_labels(acc.get("nttn"), pr.get("nttn"))
        return [by_cust[cid] for cid in order]

    def get_kam_growth_churn_report(self, kam_id: int, period: str = "monthly"):
        """
        Per-bucket new customers vs terminations for one KAM.

        New customers (invoice-driven): only customers whose FIRST invoice issue_date falls in the
        bucket; MRC = total billed on that first billing day. Zero-MRC or no-invoice customers
        excluded. Capacity/NTTN from entitlements as of first invoice date.

        Termination: customers terminated in period (status inactive/suspended + updated_at date
        in range; no dedicated termination_date on model). Loss = last billed invoice amount on or
        before termination (sum of invoice amounts on that latest issue_date).
        """
        if not self.start_date or not self.end_date or not kam_id:
            return {"error": "Invalid date range or kam_id"}

        kam = KAMMaster.objects.filter(pk=kam_id).first()
        if not kam:
            return {"error": "KAM not found"}

        buckets = list(self._iter_report_buckets(period))
        empty_grand = {
            "onboarding": {
                "customer_count": 0,
                "total_capacity_mbps": Decimal("0"),
                "total_mrc": Decimal("0"),
            },
            "termination": {
                "customer_count": 0,
                "total_capacity_mbps": Decimal("0"),
                "total_revenue_loss": Decimal("0"),
            },
            "performance": {
                "total_sales_mrc": Decimal("0"),
                "total_loss_mrc": Decimal("0"),
                "net_growth_mrc": Decimal("0"),
            },
            "total_new_bill_amount": Decimal("0"),
            "total_new_capacity_mbps": Decimal("0"),
            "total_termination_bill_amount": Decimal("0"),
            "total_termination_capacity_mbps": Decimal("0"),
        }
        if not buckets:
            return {
                "kam_id": kam_id,
                "kam_name": kam.kam_name,
                "period": period,
                "start_date": self.start_date,
                "end_date": self.end_date,
                "buckets": [],
                "grand_totals": empty_grand,
                "charts": {"monthly": []},
            }

        details_qs = CustomerEntitlementDetails.objects.select_related(
            "package_pricing_id",
            "package_master_id",
        )
        kam_cust_ids = list(
            CustomerMaster.objects.filter(kam_id_id=kam_id).values_list("id", flat=True)
        )
        first_facts = self._first_invoice_facts_by_customer(kam_cust_ids)

        pending_new = {b["key"]: [] for b in buckets}
        eligible_new = []
        for cid, fact in first_facts.items():
            fd = fact["first_date"]
            mrc = fact["mrc_amount"]
            if mrc is None or mrc <= 0:
                continue
            if fd < self.start_date or fd > self.end_date:
                continue
            key = self._bucket_key_for_date(fd, buckets)
            if not key:
                continue
            eligible_new.append((cid, fd, mrc, key))

        customers_by_id = {}
        if eligible_new:
            customers_by_id = {
                c.id: c
                for c in CustomerMaster.objects.filter(
                    pk__in=[t[0] for t in eligible_new]
                ).prefetch_related(
                    Prefetch(
                        "entitlements",
                        queryset=CustomerEntitlementMaster.objects.prefetch_related(
                            Prefetch("details", queryset=details_qs)
                        ),
                    )
                )
            }

        for cid, fd, mrc, key in eligible_new:
            cust = customers_by_id.get(cid)
            if not cust:
                continue
            cap = Decimal("0")
            nttn_acc = ""
            onboarding_d = None
            for ent in cust.entitlements.all():
                cap += self._row_capacity_mbps_as_of(ent, fd)
                nttn_acc = self._merge_nttn_labels(nttn_acc, (ent.nttn_company or "").strip())
                ad = ent.activation_date
                if ad and (onboarding_d is None or ad < onboarding_d):
                    onboarding_d = ad
            if onboarding_d is None and cust.created_at:
                onboarding_d = cust.created_at.date()

            company = (cust.company_name or "").strip()
            name_parts = [cust.customer_name or ""]
            if company:
                name_parts.append(company)
            customer_display = " — ".join([p for p in name_parts if p]) or (cust.customer_name or "")
            pending_new[key].append(
                {
                    "customer_id": cust.id,
                    "customer_name": cust.customer_name,
                    "company_name": company,
                    "customer_display": customer_display,
                    "activation_date": onboarding_d,
                    "activation_date_display": onboarding_d.strftime("%d %b %Y")
                    if onboarding_d
                    else "",
                    "first_invoice_date": fd,
                    "first_invoice_date_display": fd.strftime("%d %b %Y"),
                    "nttn": nttn_acc,
                    "capacity_mbps": cap,
                    "bill_amount": mrc,
                    "invoice_bill_amount": mrc,
                    "kam_name": kam.kam_name,
                }
            )

        new_by_bucket = {b["key"]: self._aggregate_onboarding_by_customer(pending_new[b["key"]]) for b in buckets}
        for rows in new_by_bucket.values():
            for r in rows:
                ad = r.get("activation_date")
                if ad and hasattr(ad, "isoformat"):
                    r["activation_date"] = ad.isoformat()
                fd = r.get("first_invoice_date")
                if fd and hasattr(fd, "isoformat"):
                    r["first_invoice_date"] = fd.isoformat()

        term_custs = CustomerMaster.objects.filter(
            kam_id_id=kam_id,
            status__in=["inactive", "suspended"],
            updated_at__date__gte=self.start_date,
            updated_at__date__lte=self.end_date,
        ).select_related("kam_id")
        term_custs_list = list(term_custs)
        term_cust_ids = [c.id for c in term_custs_list]

        ents_by_customer = defaultdict(list)
        if term_cust_ids:
            term_ents = (
                CustomerEntitlementMaster.objects.filter(customer_master_id__in=term_cust_ids)
                .select_related("customer_master_id")
                .prefetch_related(Prefetch("details", queryset=details_qs))
            )
            for e in term_ents:
                ents_by_customer[e.customer_master_id_id].append(e)

        term_by_bucket = {b["key"]: [] for b in buckets}
        for c in term_custs_list:
            td = c.updated_at.date() if c.updated_at else None
            if not td:
                continue
            key = self._bucket_key_for_date(td, buckets)
            if not key:
                continue
            loss = self._last_billed_mrc_before_termination(c.id, td)
            if loss is None or loss <= 0:
                continue
            cap_loss = Decimal("0")
            nttn_acc = ""
            for ent in ents_by_customer.get(c.id, []):
                cap_loss += self._row_capacity_mbps_as_of(ent, td)
                nttn_acc = self._merge_nttn_labels(nttn_acc, (ent.nttn_company or "").strip())
            kn = c.kam_id.kam_name if c.kam_id else kam.kam_name
            company = (c.company_name or "").strip()
            name_parts = [c.customer_name or ""]
            if company:
                name_parts.append(company)
            customer_display = " — ".join([p for p in name_parts if p]) or (c.customer_name or "")
            term_by_bucket[key].append(
                {
                    "customer_id": c.id,
                    "customer_name": c.customer_name,
                    "company_name": company,
                    "customer_display": customer_display,
                    "termination_date": td.isoformat(),
                    "termination_date_display": td.strftime("%d %b %Y"),
                    "nttn": nttn_acc,
                    "capacity_mbps": cap_loss,
                    "bill_amount": loss,
                    "invoice_bill_amount": loss,
                    "revenue_loss_mrc": loss,
                    "kam_name": kn,
                }
            )

        grand_new_bill = Decimal("0")
        grand_new_cap = Decimal("0")
        grand_new_count = 0
        grand_term_bill = Decimal("0")
        grand_term_cap = Decimal("0")
        grand_term_count = 0
        months_out = []

        for b in buckets:
            new_rows = new_by_bucket[b["key"]]
            term_rows = term_by_bucket[b["key"]]
            nt = sum((r["bill_amount"] for r in new_rows), Decimal("0"))
            nc = sum((r["capacity_mbps"] for r in new_rows), Decimal("0"))
            n_count = len(new_rows)
            tt = sum((r["bill_amount"] for r in term_rows), Decimal("0"))
            tc = sum((r["capacity_mbps"] for r in term_rows), Decimal("0"))
            t_count = len(term_rows)
            grand_new_bill += nt
            grand_new_cap += nc
            grand_new_count += n_count
            grand_term_bill += tt
            grand_term_cap += tc
            grand_term_count += t_count
            months_out.append(
                {
                    "key": b["key"],
                    "label": b["label"],
                    "start": b["start"],
                    "end": b["end"],
                    "new_customers": new_rows,
                    "new_totals": {
                        "customer_count": n_count,
                        "capacity_mbps": nc,
                        "bill_amount": nt,
                        "invoice_bill_amount": nt,
                        "total_mrc": nt,
                    },
                    "terminations": term_rows,
                    "termination_totals": {
                        "customer_count": t_count,
                        "capacity_mbps": tc,
                        "bill_amount": tt,
                        "invoice_bill_amount": tt,
                        "total_revenue_loss": tt,
                    },
                }
            )

        net_growth = grand_new_bill - grand_term_bill

        monthly_chart = defaultdict(lambda: {"sales_mrc": Decimal("0"), "loss_mrc": Decimal("0")})
        for b in buckets:
            for r in new_by_bucket[b["key"]]:
                fd_raw = r.get("first_invoice_date")
                if isinstance(fd_raw, str):
                    fd_p = date.fromisoformat(fd_raw)
                else:
                    fd_p = fd_raw
                if fd_p:
                    monthly_chart[(fd_p.year, fd_p.month)]["sales_mrc"] += r["bill_amount"]
            for r in term_by_bucket[b["key"]]:
                td_raw = r.get("termination_date")
                if isinstance(td_raw, str):
                    td_p = date.fromisoformat(td_raw[:10])
                else:
                    td_p = td_raw
                if td_p:
                    monthly_chart[(td_p.year, td_p.month)]["loss_mrc"] += r["bill_amount"]
        chart_monthly = []
        for ym in sorted(monthly_chart.keys()):
            y, m = ym
            d = monthly_chart[ym]
            chart_monthly.append(
                {
                    "month_label": f"{calendar.month_name[m]} {y}",
                    "year": y,
                    "month": m,
                    "sales_mrc": d["sales_mrc"],
                    "loss_mrc": d["loss_mrc"],
                }
            )

        return {
            "kam_id": kam_id,
            "kam_name": kam.kam_name,
            "period": period,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "buckets": months_out,
            "grand_totals": {
                "onboarding": {
                    "customer_count": grand_new_count,
                    "total_capacity_mbps": grand_new_cap,
                    "total_mrc": grand_new_bill,
                },
                "termination": {
                    "customer_count": grand_term_count,
                    "total_capacity_mbps": grand_term_cap,
                    "total_revenue_loss": grand_term_bill,
                },
                "performance": {
                    "total_sales_mrc": grand_new_bill,
                    "total_loss_mrc": grand_term_bill,
                    "net_growth_mrc": net_growth,
                },
                "total_new_bill_amount": grand_new_bill,
                "total_new_capacity_mbps": grand_new_cap,
                "total_termination_bill_amount": grand_term_bill,
                "total_termination_capacity_mbps": grand_term_cap,
            },
            "charts": {"monthly": chart_monthly},
        }

    def get_chart_new_vs_terminated(self):
        """New vs Terminated customers count (and MRC) for the period."""
        new = self.get_new_customers()
        term = self.get_terminated_customers()
        new_mrc = sum(c['mrc'] for c in new)
        lost_mrc = sum(c['revenue_loss'] for c in term)
        return {
            'new_count': len(new),
            'terminated_count': len(term),
            'new_mrc': new_mrc,
            'lost_mrc': lost_mrc,
            'series': [
                {'name': 'New Customers', 'count': len(new), 'mrc': new_mrc},
                {'name': 'Terminated', 'count': len(term), 'mrc': lost_mrc},
            ],
        }

    def get_customer_receivable_rows(self):
        """Opening → bill → received → due per customer (ledger), optional KAM scope."""
        if not self.start_date or not self.end_date:
            return []
        return get_all_customers_ledger_summary(
            from_date=self.start_date,
            to_date=self.end_date,
            kam_id=self.kam_id,
        )

    def get_monthly_growth_summary(self, n=4):
        """Last n calendar months ending at end_date: new vs terminated counts and MRC."""
        from dateutil.relativedelta import relativedelta
        import calendar

        if not self.end_date:
            return []
        rows = []
        end_anchor = self.end_date
        for k in range(n):
            month_start_date = end_anchor.replace(day=1) - relativedelta(months=(n - 1 - k))
            y, m = month_start_date.year, month_start_date.month
            start = date(y, m, 1)
            last_d = date(y, m, calendar.monthrange(y, m)[1])
            end_m = min(last_d, self.end_date)
            if start > end_m:
                continue
            svc = SalesAnalyticsService(
                start_date=start,
                end_date=end_m,
                kam_id=self.kam_id,
                customer_id=self.customer_id,
            )
            new_list = svc.get_new_customers()
            term_list = svc.get_terminated_customers()
            new_mrc = sum((c['mrc'] for c in new_list), Decimal('0'))
            lost_mrc = sum((c['revenue_loss'] for c in term_list), Decimal('0'))
            label = start.strftime('%b %Y')
            rows.append({
                'label': label,
                'new_count': len(new_list),
                'terminated_count': len(term_list),
                'new_mrc': float(new_mrc),
                'lost_mrc': float(lost_mrc),
                'net_mrc': float(new_mrc - lost_mrc),
            })
        return rows

    def get_kam_monthly_bill_vs_collected(self, kam_id, n=4):
        """Last n months: invoice MRC vs payments for this KAM (entitlement-linked invoices)."""
        from dateutil.relativedelta import relativedelta
        import calendar
        from apps.payment.models import PaymentDetails

        if not self.end_date:
            return []
        rows = []
        end_anchor = self.end_date
        for k in range(n):
            month_start_date = end_anchor.replace(day=1) - relativedelta(months=(n - 1 - k))
            y, m = month_start_date.year, month_start_date.month
            start = date(y, m, 1)
            last_d = date(y, m, calendar.monthrange(y, m)[1])
            end_m = min(last_d, self.end_date)
            if start > end_m:
                continue

            bill = InvoiceMaster.objects.filter(
                issue_date__gte=start,
                issue_date__lte=end_m,
                customer_entitlement_master_id__customer_master_id__kam_id_id=kam_id,
            ).aggregate(t=Sum('total_bill_amount', output_field=DecimalField()))['t'] or Decimal('0')

            collected = PaymentDetails.objects.filter(
                status='completed',
                payment_master_id__payment_date__gte=start,
                payment_master_id__payment_date__lte=end_m,
                payment_master_id__invoice_master_id__customer_entitlement_master_id__customer_master_id__kam_id_id=kam_id,
            ).aggregate(t=Sum('pay_amount', output_field=DecimalField()))['t'] or Decimal('0')

            label = start.strftime('%b %Y')
            rows.append({
                'label': label,
                'bill': float(bill),
                'collected': float(collected),
            })
        return rows

    def get_kam_assigned_counts(self, kam_id):
        """Customers assigned to this KAM (is_active on master)."""
        qs = CustomerMaster.objects.filter(kam_id_id=kam_id, is_active=True)
        return {
            'assigned': qs.count(),
            'active_status': qs.filter(status='active').count(),
        }

    def _due_aging_buckets_from_ledger(self, ledger_rows):
        """Bucket customer names by closing due (same thresholds as product UI)."""
        critical, high, low, cleared = [], [], [], []
        for r in ledger_rows:
            d = float(r.get('total_due_balance') or 0)
            name = (r.get('customer_name') or '').strip() or '—'
            if d <= 0:
                cleared.append(name)
            elif d > 100000:
                critical.append(name)
            elif d > 30000:
                high.append(name)
            else:
                low.append(name)
        n = max(len(ledger_rows), 1)

        def bar_pct(count):
            return min(100, round(100 * count / n))

        return {
            'critical': {
                'label': 'Critical (>৳1L)',
                'count': len(critical),
                'names': critical[:8],
                'bar_pct': bar_pct(len(critical)),
            },
            'high': {
                'label': 'High (৳30K–1L)',
                'count': len(high),
                'names': high[:8],
                'bar_pct': bar_pct(len(high)),
            },
            'low': {
                'label': 'Low (<৳30K)',
                'count': len(low),
                'names': low[:8],
                'bar_pct': bar_pct(len(low)),
            },
            'cleared': {
                'label': 'Cleared / Credit',
                'count': len(cleared),
                'names': cleared[:8],
                'bar_pct': bar_pct(len(cleared)),
            },
            'due_over_30k_count': len(critical) + len(high),
            'critical_count': len(critical),
        }

    def build_kam_detail_extras(self, kam_id_drill):
        """Ledger receivable, trend, aging, scoped new/term for KAM detail page."""
        ledger = []
        if self.start_date and self.end_date:
            ledger = get_all_customers_ledger_summary(
                from_date=self.start_date,
                to_date=self.end_date,
                kam_id=kam_id_drill,
            )
        for r in ledger:
            bill = float(r.get('total_bill_amount') or 0)
            rcvd = float(r.get('total_payment_received') or 0)
            r['collection_rate'] = int(round(100 * rcvd / bill)) if bill > 0 else 0

        aging = self._due_aging_buckets_from_ledger(ledger)
        new_k = [x for x in self.get_new_customers() if x.get('kam_id') == kam_id_drill]
        term_k = [x for x in self.get_terminated_customers() if x.get('kam_id') == kam_id_drill]
        new_mrc_sum = sum((x['mrc'] for x in new_k), Decimal('0'))
        term_loss_sum = sum((x['revenue_loss'] for x in term_k), Decimal('0'))
        counts = self.get_kam_assigned_counts(kam_id_drill)
        trend = self.get_kam_monthly_bill_vs_collected(kam_id_drill, n=4)
        total_opening = sum(float(r.get('opening_balance') or 0) for r in ledger)
        total_due = sum(float(r.get('total_due_balance') or 0) for r in ledger)

        return {
            'kam_receivable_rows': ledger,
            'kam_monthly_trend': trend,
            'kam_due_aging': aging,
            'kam_new_customers': new_k,
            'kam_terminated_customers': term_k,
            'kam_new_mrc_sum': new_mrc_sum,
            'kam_term_loss_sum': term_loss_sum,
            'kam_assigned_counts': counts,
            'kam_total_opening': total_opening,
            'kam_total_due_ledger': total_due,
        }

    # ------------------------- Full Response -------------------------

    def get_full_analytics(self, kam_id_drill=None, mode='overview'):
        """
        mode=overview: summary + charts (no per-KAM drill payload).
        mode=detail: requires kam_id_drill; service breakdown, customers, performance drill for that KAM.
        mode=full: legacy — overview + drill if kam_id_drill set.
        """
        mode = (mode or 'overview').lower()
        filters_meta = {
            'start_date': str(self.start_date) if self.start_date else None,
            'end_date': str(self.end_date) if self.end_date else None,
            'kam_id': self.kam_id,
            'customer_id': self.customer_id,
        }

        if mode == 'detail':
            if not kam_id_drill:
                raise ValueError('detail mode requires kam_drill (KAM id)')
            revenue_summary = self.get_revenue_summary()
            extras = self.build_kam_detail_extras(kam_id_drill)
            return {
                'mode': 'detail',
                'revenue_summary': revenue_summary,
                'filters': filters_meta,
                'kam_detail': self.get_kam_detailed_breakdown(kam_id_drill),
                'kam_customers': self.get_customers_under_kam(kam_id_drill),
                'kam_performance_drill': self.get_kam_performance_drilldown(kam_id_drill),
                'kam_performance_row': self.get_kam_performance_row(kam_id_drill),
                **extras,
            }

        revenue_summary = self.get_revenue_summary()
        kam_sales_overview = self.get_kam_sales_overview()
        new_customers = self.get_new_customers()
        terminated_customers = self.get_terminated_customers()
        kam_performance = self.get_kam_performance_report()

        payload = {
            'mode': mode,
            'revenue_summary': revenue_summary,
            'kam_sales_overview': kam_sales_overview,
            'new_customers': new_customers,
            'terminated_customers': terminated_customers,
            'kam_performance': kam_performance,
            'chart_kam_sales': self.get_chart_kam_sales_comparison(),
            'chart_monthly_revenue': self.get_chart_monthly_revenue_trend(),
            'chart_new_vs_terminated': self.get_chart_new_vs_terminated(),
            'service_sales_overview': self.get_service_sales_overview(),
            'customer_receivable_rows': self.get_customer_receivable_rows(),
            'monthly_growth_summary': self.get_monthly_growth_summary(),
            'filters': filters_meta,
        }

        if mode == 'full' and kam_id_drill:
            payload['kam_detail'] = self.get_kam_detailed_breakdown(kam_id_drill)
            payload['kam_customers'] = self.get_customers_under_kam(kam_id_drill)
            payload['kam_performance_drill'] = self.get_kam_performance_drilldown(kam_id_drill)

        return payload
