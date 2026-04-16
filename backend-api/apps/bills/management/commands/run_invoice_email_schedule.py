"""
Management command to run invoice email automation schedules.
Sends Service Name Invoice PDFs to customers based on configured schedules.

Add to crontab to run every minute:
  * * * * * cd /path/to/backend-api && python manage.py run_invoice_email_schedule
"""
import base64
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, date, timedelta
from croniter import croniter

from django.db.models import Q
from apps.bills.models import InvoiceMaster, InvoiceEmailSchedule
from apps.bills.pdf_service import generate_service_name_invoice_pdf, get_invoice_pdf_filename
from apps.bills.utils import generate_invoice_for_entitlement
from apps.customers.email_service import send_invoice_email
from apps.bills.models import CustomerEntitlementMaster

logger = logging.getLogger(__name__)


def run_schedule(schedule, dry_run=False):
    """
    Execute a single schedule. Returns dict with sent, skipped, errors counts.
    """
    result = {'sent': 0, 'skipped': 0, 'errors': 0}
    if dry_run:
        invoices = get_invoices_for_schedule(schedule)
        result['would_process'] = invoices.count()
        return result

    if schedule.generate_invoices_before_send:
        ents_qs = CustomerEntitlementMaster.objects.filter(customer_master_id__is_active=True)
        if schedule.target_customer_id:
            ents_qs = ents_qs.filter(customer_master_id=schedule.target_customer)
        for ent in ents_qs:
            try:
                generate_invoice_for_entitlement(entitlement=ent, target_date=date.today(), force=False)
            except Exception as e:
                logger.warning('Skip entitlement %s: %s', ent.id, e)

    invoices = get_invoices_for_schedule(schedule)
    for invoice in invoices:
        customer = (
            invoice.customer_entitlement_master_id.customer_master_id
            if invoice.customer_entitlement_master_id
            else invoice.customer_master_id
        )
        if not customer:
            result['skipped'] += 1
            continue
        email_addr = (customer.email or '').strip()
        if not email_addr or '@' not in email_addr:
            result['skipped'] += 1
            continue
        try:
            pdf_bytes = generate_service_name_invoice_pdf(invoice)
            filename = get_invoice_pdf_filename(invoice)
            pdf_b64 = base64.b64encode(pdf_bytes).decode('ascii')
            if send_invoice_email(
                email_addr,
                invoice.invoice_number or f'INV-{invoice.id}',
                pdf_b64,
                customer_name=customer.customer_name,
                filename=filename,
            ):
                result['sent'] += 1
            else:
                result['errors'] += 1
        except Exception as e:
            logger.exception('Error sending %s: %s', invoice.invoice_number, e)
            result['errors'] += 1

    schedule.last_run_at = timezone.now()
    schedule.next_run_at = get_next_run_at(schedule)
    schedule.save()
    return result


def get_next_run_at(schedule):
    """Compute next run time for a schedule."""
    now = timezone.now()
    base = now.replace(second=0, microsecond=0)
    run_time = base.replace(hour=schedule.run_at_hour, minute=schedule.run_at_minute, second=0, microsecond=0)

    if schedule.schedule_type == InvoiceEmailSchedule.SCHEDULE_TYPE_CRON and schedule.cron_expression:
        try:
            it = croniter(schedule.cron_expression, now)
            return it.get_next(datetime)
        except Exception:
            return run_time + timedelta(days=1)

    if schedule.schedule_type == InvoiceEmailSchedule.SCHEDULE_TYPE_DAILY:
        if run_time <= now:
            run_time += timedelta(days=1)
        return run_time

    if schedule.schedule_type == InvoiceEmailSchedule.SCHEDULE_TYPE_WEEKLY:
        # weekly_day: 0=Monday, 6=Sunday
        target_weekday = (schedule.weekly_day or 0) % 7
        current_weekday = now.weekday()  # 0=Monday, 6=Sunday
        days_ahead = (target_weekday - current_weekday) % 7
        if days_ahead == 0 and run_time <= now:
            days_ahead = 7
        next_date = (now + timedelta(days=days_ahead)).date()
        return timezone.make_aware(
            datetime.combine(next_date, datetime.min.time().replace(
                hour=schedule.run_at_hour, minute=schedule.run_at_minute
            ))
        )

    if schedule.schedule_type == InvoiceEmailSchedule.SCHEDULE_TYPE_MONTHLY:
        day = max(1, min(28, schedule.monthly_day or 1))
        try:
            cand = now.replace(day=day, hour=schedule.run_at_hour, minute=schedule.run_at_minute, second=0, microsecond=0)
        except ValueError:
            cand = (now.replace(day=1) + timedelta(days=32)).replace(day=min(day, 28))
        if cand <= now:
            if now.month == 12:
                cand = cand.replace(year=now.year + 1, month=1)
            else:
                cand = cand.replace(month=now.month + 1)
        return cand

    return run_time + timedelta(days=1)


def is_due_now(schedule):
    """Check if schedule should run now (within current minute)."""
    now = timezone.now()
    if schedule.next_run_at is None:
        return True
    # Run if next_run_at is in the past or within this minute
    return schedule.next_run_at <= now or (
        schedule.next_run_at.year == now.year
        and schedule.next_run_at.month == now.month
        and schedule.next_run_at.day == now.day
        and schedule.next_run_at.hour == now.hour
        and schedule.next_run_at.minute == now.minute
    )


def get_invoices_for_schedule(schedule):
    """Get invoices matching schedule filters."""
    since = date.today() - timedelta(days=schedule.days_lookback)
    qs = InvoiceMaster.objects.filter(
        issue_date__gte=since,
    ).select_related(
        'customer_entitlement_master_id__customer_master_id',
        'customer_master_id',
    ).prefetch_related(
        'details',
        'details__entitlement_details_id__package_master_id',
        'details__entitlement_details_id__package_pricing_id__package_master_id',
    )

    if schedule.target_customer_id:
        qs = qs.filter(
            Q(customer_entitlement_master_id__customer_master_id=schedule.target_customer) |
            Q(customer_master_id=schedule.target_customer)
        )

    if schedule.invoice_status_filter == InvoiceEmailSchedule.STATUS_FILTER_UNPAID:
        qs = qs.filter(status='unpaid')
    elif schedule.invoice_status_filter == InvoiceEmailSchedule.STATUS_FILTER_PARTIAL:
        qs = qs.filter(status__in=['unpaid', 'partial'])
    # STATUS_FILTER_ALL: no filter

    return qs.order_by('issue_date', 'id')


class Command(BaseCommand):
    help = 'Run invoice email automation schedules. Send Service Name Invoice PDFs to customers.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--schedule-id',
            type=int,
            help='Run only this schedule ID (for testing)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would run without sending emails',
        )

    def handle(self, *args, **options):
        schedule_id = options.get('schedule_id')
        dry_run = options.get('dry_run', False)

        if schedule_id:
            schedules = InvoiceEmailSchedule.objects.filter(id=schedule_id, enabled=True)
        else:
            schedules = InvoiceEmailSchedule.objects.filter(enabled=True)

        for schedule in schedules:
            if not schedule_id and not is_due_now(schedule):
                continue

            self.stdout.write(f'\n--- Schedule: {schedule.name} (ID={schedule.id}) ---')

            if dry_run:
                self.stdout.write(self.style.WARNING('DRY RUN - no emails sent'))
                r = run_schedule(schedule, dry_run=True)
                self.stdout.write(f'Would process {r.get("would_process", 0)} invoice(s)')
                continue

            r = run_schedule(schedule, dry_run=False)
            self.stdout.write(
                self.style.SUCCESS(f'Done: sent={r["sent"]}, skipped={r["skipped"]}, errors={r["errors"]}')
            )
