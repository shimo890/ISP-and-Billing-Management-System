"""
Django management command to generate invoices for customers.

Usage:
    python manage.py generate_invoices --customer-id=<id> --target-date=YYYY-MM-DD
    python manage.py generate_invoices --all --target-date=YYYY-MM-DD
    python manage.py generate_invoices --customer-id=<id> --target-date=YYYY-MM-DD --force
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import datetime, date
from apps.bills.models import CustomerEntitlementMaster
from apps.customers.models import CustomerMaster
from apps.bills.utils import generate_invoice_for_entitlement


class Command(BaseCommand):
    help = 'Generate invoices for customers based on their entitlements'

    def add_arguments(self, parser):
        parser.add_argument(
            '--customer-id',
            type=int,
            help='Customer ID to generate invoice for (specific customer)',
        )
        parser.add_argument(
            '--entitlement-id',
            type=int,
            help='Entitlement ID to generate invoice for (specific entitlement)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Generate invoices for all customers with active entitlements',
        )
        parser.add_argument(
            '--target-date',
            type=str,
            help='Target invoice date (YYYY-MM-DD). Defaults to today.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force regeneration even if invoice already exists',
        )

    def handle(self, *args, **options):
        customer_id = options.get('customer_id')
        entitlement_id = options.get('entitlement_id')
        generate_all = options.get('all')
        target_date_str = options.get('target_date')
        force = options.get('force', False)

        # Validate arguments
        if not customer_id and not entitlement_id and not generate_all:
            raise CommandError('Please specify --customer-id, --entitlement-id, or --all')

        # Parse target date
        if target_date_str:
            try:
                target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
            except ValueError:
                raise CommandError('Invalid date format. Use YYYY-MM-DD')
        else:
            target_date = date.today()

        self.stdout.write(self.style.SUCCESS(f'Generating invoices for target date: {target_date}'))

        # Get entitlements to process
        entitlements = []

        if entitlement_id:
            # Specific entitlement
            try:
                entitlement = CustomerEntitlementMaster.objects.get(id=entitlement_id)
                entitlements.append(entitlement)
                self.stdout.write(f'Processing entitlement ID: {entitlement_id}')
            except CustomerEntitlementMaster.DoesNotExist:
                raise CommandError(f'Entitlement with ID {entitlement_id} does not exist')

        elif customer_id:
            # All entitlements for specific customer
            try:
                customer = CustomerMaster.objects.get(id=customer_id)
                entitlements = CustomerEntitlementMaster.objects.filter(
                    customer_master_id=customer
                )
                self.stdout.write(f'Processing customer: {customer.customer_name} (ID: {customer_id})')
                self.stdout.write(f'Found {entitlements.count()} entitlement(s)')
            except CustomerMaster.DoesNotExist:
                raise CommandError(f'Customer with ID {customer_id} does not exist')

        elif generate_all:
            # All active entitlements
            entitlements = CustomerEntitlementMaster.objects.filter(
                customer_master_id__is_active=True
            )
            self.stdout.write(f'Processing all active customers')
            self.stdout.write(f'Found {entitlements.count()} entitlement(s)')

        # Generate invoices
        success_count = 0
        skip_count = 0
        error_count = 0

        for entitlement in entitlements:
            customer = entitlement.customer_master_id
            self.stdout.write(f'\n--- Processing: {customer.customer_name} (Type: {customer.customer_type}) ---')

            try:
                result = generate_invoice_for_entitlement(
                    entitlement=entitlement,
                    target_date=target_date,
                    force=force
                )

                if result['success']:
                    success_count += 1
                    invoice = result['invoice']
                    calculation = result['calculation']
                    
                    self.stdout.write(self.style.SUCCESS(
                        f'✓ Generated invoice: {invoice.invoice_number}'
                    ))
                    self.stdout.write(f'  Billing period: {calculation["billing_start_date"]} to {calculation["billing_end_date"]}')
                    self.stdout.write(f'  Total bill: {calculation["total_bill"]}')
                    self.stdout.write(f'  Details count: {len(calculation["details"])}')
                else:
                    skip_count += 1
                    self.stdout.write(self.style.WARNING(
                        f'⊘ Skipped: {result["message"]}'
                    ))

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(
                    f'✗ Error: {str(e)}'
                ))

        # Summary
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(f'Invoice Generation Summary:'))
        self.stdout.write(f'  Successfully generated: {success_count}')
        self.stdout.write(f'  Skipped: {skip_count}')
        self.stdout.write(f'  Errors: {error_count}')
        self.stdout.write(f'  Total processed: {len(entitlements)}')
        self.stdout.write('='*60)

        if error_count > 0:
            self.stdout.write(self.style.WARNING(
                f'\n⚠ {error_count} invoice(s) failed to generate. Check logs for details.'
            ))
