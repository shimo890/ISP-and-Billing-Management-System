"""
Django management command to seed ISP Sales Dashboard with realistic dummy data.
Covers all use cases: daily bills, monthly bills, bi-weekly bills, date-to-date tracking,
payment tracking, invoice tracking, and sales calculations.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import datetime, timedelta, date
import random

from apps.customers.models import KAMMaster, CustomerMaster
from apps.package.models import PackageMaster, PackagePricing
from apps.bills.models import (
    CustomerEntitlementMaster, CustomerEntitlementDetails,
    InvoiceMaster, InvoiceDetails
)
from apps.payment.models import PaymentMaster, PaymentDetails
from apps.utility.models import UtilityInformationMaster, UtilityDetails

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed ISP Sales Dashboard with realistic dummy data (10 rows per model)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing existing data...'))
            PaymentDetails.objects.all().delete()
            PaymentMaster.objects.all().delete()
            InvoiceDetails.objects.all().delete()
            InvoiceMaster.objects.all().delete()
            CustomerEntitlementDetails.objects.all().delete()
            CustomerEntitlementMaster.objects.all().delete()
            CustomerMaster.objects.all().delete()
            KAMMaster.objects.all().delete()
            PackagePricing.objects.all().delete()
            PackageMaster.objects.all().delete()
            UtilityDetails.objects.all().delete()
            UtilityInformationMaster.objects.all().delete()

        # Get or create a user for created_by fields
        # Try to get existing superuser first
        admin_user = User.objects.filter(is_superuser=True).first()
        
        if not admin_user:
            # Try to get any user
            admin_user = User.objects.first()
            
        if not admin_user:
            # Create a new user if none exists
            import time
            unique_username = f'seed_admin_{int(time.time())}'
            try:
                admin_user = User.objects.create_user(
                    email=f'seed_admin_{int(time.time())}@isp.com',
                    username=unique_username,
                    password='temp_password_123',
                    is_staff=True,
                    is_superuser=True
                )
                self.stdout.write(self.style.SUCCESS(f'Created seed admin user: {unique_username}'))
            except Exception as e:
                # If creation fails, try to get any user
                admin_user = User.objects.first()
                if not admin_user:
                    raise Exception(
                        f"Could not create or find a user. Error: {str(e)}\n"
                        "Please create a superuser first: python manage.py createsuperuser"
                    )
        
        if not admin_user:
            raise Exception("Could not create or find a user. Please create a superuser first: python manage.py createsuperuser")
        
        self.stdout.write(self.style.SUCCESS(f'Using user: {admin_user.email} ({admin_user.username})'))

        self.stdout.write(self.style.SUCCESS('Starting data seeding...'))

        # 1. Create KAM Master (10 records)
        self.create_kam_masters(admin_user)
        
        # 2. Create Package Master and Pricing (10 records each)
        packages = self.create_packages()
        
        # 3. Create Utility Information and Details (10 records each)
        utility_masters = self.create_utility_info()
        
        # 4. Create Customer Master (10 records - mix of types)
        customers = self.create_customers(admin_user)
        
        # 5. Create Customer Entitlement Master and Details (10 records each)
        entitlements = self.create_entitlements(customers, packages, admin_user)
        
        # 6. Create Invoice Master and Details (10 records each)
        invoices = self.create_invoices(entitlements, utility_masters, admin_user)
        
        # 7. Create Payment Master and Details (10 records each)
        self.create_payments(invoices, entitlements, admin_user)

        self.stdout.write(self.style.SUCCESS('\n✅ Successfully seeded all data!'))
        self.stdout.write(self.style.SUCCESS(f'   - KAM Masters: {KAMMaster.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'   - Customers: {CustomerMaster.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'   - Packages: {PackageMaster.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'   - Entitlements: {CustomerEntitlementMaster.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'   - Invoices: {InvoiceMaster.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'   - Payments: {PaymentMaster.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'   - Utility Info: {UtilityInformationMaster.objects.count()}'))

    def create_kam_masters(self, user):
        """Create 10 KAM Master records"""
        kam_data = [
            {'kam_name': 'Ahmed Rahman', 'phone': '+8801712345678', 'email': 'ahmed.rahman@isp.com', 'address': 'Dhaka, Bangladesh'},
            {'kam_name': 'Fatima Khan', 'phone': '+8801712345679', 'email': 'fatima.khan@isp.com', 'address': 'Chittagong, Bangladesh'},
            {'kam_name': 'Karim Uddin', 'phone': '+8801712345680', 'email': 'karim.uddin@isp.com', 'address': 'Sylhet, Bangladesh'},
            {'kam_name': 'Nadia Islam', 'phone': '+8801712345681', 'email': 'nadia.islam@isp.com', 'address': 'Rajshahi, Bangladesh'},
            {'kam_name': 'Rashid Hasan', 'phone': '+8801712345682', 'email': 'rashid.hasan@isp.com', 'address': 'Khulna, Bangladesh'},
            {'kam_name': 'Sadia Chowdhury', 'phone': '+8801712345683', 'email': 'sadia.chowdhury@isp.com', 'address': 'Barisal, Bangladesh'},
            {'kam_name': 'Tariq Mahmud', 'phone': '+8801712345684', 'email': 'tariq.mahmud@isp.com', 'address': 'Comilla, Bangladesh'},
            {'kam_name': 'Zara Ahmed', 'phone': '+8801712345685', 'email': 'zara.ahmed@isp.com', 'address': 'Gazipur, Bangladesh'},
            {'kam_name': 'Imran Ali', 'phone': '+8801712345686', 'email': 'imran.ali@isp.com', 'address': 'Narayanganj, Bangladesh'},
            {'kam_name': 'Lubna Begum', 'phone': '+8801712345687', 'email': 'lubna.begum@isp.com', 'address': 'Mymensingh, Bangladesh'},
        ]
        
        kams = []
        for data in kam_data:
            kam = KAMMaster.objects.create(**data)
            kams.append(kam)
            self.stdout.write(f'  ✓ Created KAM: {kam.kam_name}')
        
        return kams

    def create_packages(self):
        """Create 10 Package Master and 10 Package Pricing records"""
        package_data = [
            {'name': 'Business 10 Mbps', 'type': 'bw', 'rate': None},
            {'name': 'Business 20 Mbps', 'type': 'bw', 'rate': None},
            {'name': 'Business 50 Mbps', 'type': 'bw', 'rate': None},
            {'name': 'Home Basic 5 Mbps', 'type': 'soho', 'rate': Decimal('1500.00')},
            {'name': 'Home Standard 10 Mbps', 'type': 'soho', 'rate': Decimal('2500.00')},
            {'name': 'Home Premium 20 Mbps', 'type': 'soho', 'rate': Decimal('3500.00')},
            {'name': 'Channel Partner Starter', 'type': 'channel_partner', 'rate': None},
            {'name': 'Channel Partner Pro', 'type': 'channel_partner', 'rate': None},
            {'name': 'Enterprise 100 Mbps', 'type': 'bw', 'rate': None},
            {'name': 'Enterprise 200 Mbps', 'type': 'bw', 'rate': None},
        ]
        
        packages = []
        today = date.today()
        
        for i, data in enumerate(package_data):
            package = PackageMaster.objects.create(
                package_name=data['name'],
                package_type=data['type'],
                is_active=True
            )
            packages.append(package)
            
            # Create pricing for each package
            pricing = PackagePricing.objects.create(
                package_master_id=package,
                rate=data['rate'],
                description=f'Pricing for {data["name"]} package',
                is_active=True,
                val_start_at=today - timedelta(days=30),
                val_end_at=today + timedelta(days=365)
            )
            
            self.stdout.write(f'  ✓ Created Package: {package.package_name} with pricing')
        
        return packages

    def create_utility_info(self):
        """Create 10 Utility Information Master and 10 Utility Details records"""
        utility_masters = []
        
        for i in range(10):
            vat_rate = Decimal(str(random.choice([0, 5, 7.5, 10, 15])))
            utility = UtilityInformationMaster.objects.create(
                terms_condition=f'Payment terms: Net {15 + i*5} days. Late payment charges apply.',
                vat_rate=vat_rate,
                regards=f'Thank you for your business - ISP Team {i+1}',
                remarks=f'Utility information set {i+1}',
                is_active=True
            )
            utility_masters.append(utility)
            
            # Create utility details (bank, bKash, Nagad)
            utility_types = ['bank', 'bkash', 'nagad']
            for util_type in utility_types:
                UtilityDetails.objects.create(
                    utility_master_id=utility,
                    type=util_type,
                    name=f'ISP {util_type.title()} Account {i+1}',
                    number=f'{random.randint(1000000000, 9999999999)}',
                    branch='Main Branch' if util_type == 'bank' else '',
                    routing_no=f'{random.randint(100000, 999999)}' if util_type == 'bank' else '',
                    swift_no=f'SWIFT{random.randint(100000, 999999)}' if util_type == 'bank' else '',
                    remarks=f'{util_type.title()} account details',
                    is_active=True
                )
            
            self.stdout.write(f'  ✓ Created Utility Info: VAT {vat_rate}% with 3 payment methods')
        
        return utility_masters

    def create_customers(self, user):
        """Create 10 Customer Master records with different types"""
        kams = list(KAMMaster.objects.all())
        
        customer_data = [
            {'name': 'TechCorp Solutions Ltd', 'type': 'bw', 'email': 'info@techcorp.com', 'phone': '+8801711111111', 'company': 'TechCorp Solutions'},
            {'name': 'Global Trading Co', 'type': 'bw', 'email': 'contact@globaltrade.com', 'phone': '+8801711111112', 'company': 'Global Trading'},
            {'name': 'Digital Marketing Hub', 'type': 'channel_partner', 'email': 'sales@dmhub.com', 'phone': '+8801711111113', 'company': 'DM Hub'},
            {'name': 'Residential Complex A', 'type': 'soho', 'email': 'admin@rescomplex.com', 'phone': '+8801711111114', 'company': 'Residential Complex'},
            {'name': 'Software Development Inc', 'type': 'bw', 'email': 'info@sdev.com', 'phone': '+8801711111115', 'company': 'SDev Inc'},
            {'name': 'E-commerce Platform Ltd', 'type': 'bw', 'email': 'support@ecom.com', 'phone': '+8801711111116', 'company': 'E-commerce Platform'},
            {'name': 'Home Users Group', 'type': 'soho', 'email': 'admin@homeusers.com', 'phone': '+8801711111117', 'company': 'Home Users'},
            {'name': 'Channel Partner Network', 'type': 'channel_partner', 'email': 'partner@cpn.com', 'phone': '+8801711111118', 'company': 'CP Network'},
            {'name': 'Enterprise Solutions', 'type': 'bw', 'email': 'enterprise@es.com', 'phone': '+8801711111119', 'company': 'Enterprise Solutions'},
            {'name': 'Residential Tower B', 'type': 'soho', 'email': 'towerb@res.com', 'phone': '+8801711111120', 'company': 'Tower B'},
        ]
        
        customers = []
        addresses = [
            'House 123, Road 45, Gulshan-2, Dhaka',
            'Plot 456, Banani, Dhaka',
            'Building 789, Dhanmondi, Dhaka',
            'Sector 7, Uttara, Dhaka',
            'Road 12, Mirpur, Dhaka',
            'Area 34, Mohammadpur, Dhaka',
            'Block A, Bashundhara, Dhaka',
            'Zone 5, Wari, Dhaka',
            'Street 8, Tejgaon, Dhaka',
            'Lane 9, Motijheel, Dhaka',
        ]
        
        for i, data in enumerate(customer_data):
            customer = CustomerMaster.objects.create(
                customer_name=data['name'],
                company_name=data.get('company', ''),
                email=data['email'],
                phone=data['phone'],
                address=addresses[i],
                customer_type=data['type'],
                kam_id=kams[i % len(kams)] if kams else None,
                customer_number=f'CUST{1000 + i:04d}',
                total_client=random.randint(50, 500) if data['type'] == 'channel_partner' else 0,
                total_active_client=random.randint(30, 400) if data['type'] == 'channel_partner' else 0,
                previous_total_client=random.randint(20, 300) if data['type'] == 'channel_partner' else 0,
                free_giveaway_client=random.randint(0, 50) if data['type'] == 'channel_partner' else 0,
                default_percentage_share=Decimal(str(random.uniform(10, 30))) if data['type'] == 'channel_partner' else Decimal('0'),
                contact_person=f'Contact Person {i+1}',
                status=random.choice(['active', 'active', 'active', 'inactive']),  # Mostly active
                last_bill_invoice_date=timezone.now() - timedelta(days=random.randint(0, 30)),
                is_active=True,
                created_by=user
            )
            customers.append(customer)
            self.stdout.write(f'  ✓ Created Customer: {customer.customer_name} ({customer.customer_type})')
        
        return customers

    def create_entitlements(self, customers, packages, user):
        """Create 10 Customer Entitlement Master and Details covering different billing scenarios"""
        entitlements = []
        today = date.today()
        
        # Different billing scenarios: daily, weekly, bi-weekly, monthly
        billing_scenarios = [
            {'period': 'monthly', 'days': 30},
            {'period': 'monthly', 'days': 30},
            {'period': 'bi-weekly', 'days': 14},
            {'period': 'bi-weekly', 'days': 14},
            {'period': 'weekly', 'days': 7},
            {'period': 'monthly', 'days': 30},
            {'period': 'daily', 'days': 1},
            {'period': 'monthly', 'days': 30},
            {'period': 'bi-weekly', 'days': 14},
            {'period': 'monthly', 'days': 30},
        ]
        
        for i, customer in enumerate(customers[:10]):
            scenario = billing_scenarios[i]
            start_date = today - timedelta(days=random.randint(0, 90))
            end_date = start_date + timedelta(days=scenario['days'])
            
            # Create entitlement master
            entitlement = CustomerEntitlementMaster.objects.create(
                customer_master_id=customer,
                bill_number=f'BILL{2024}{1000 + i:04d}',
                activation_date=start_date,
                nttn_company=f'NTTN Company {i+1}' if random.choice([True, False]) else '',
                nttn_capacity=f'{random.choice([10, 20, 50, 100])} Mbps' if random.choice([True, False]) else '',
                total_bill=Decimal(str(random.uniform(5000, 50000))),
                type_of_bw='Fiber' if customer.customer_type == 'soho' and random.choice([True, False]) else '',
                type_of_connection='Dedicated' if customer.customer_type == 'bw' else 'Shared',
                connected_pop=f'POP-{random.choice(["Dhaka", "Chittagong", "Sylhet"])}',
                remarks=f'{scenario["period"].title()} billing - {customer.customer_name}',
                created_by=user
            )
            entitlements.append(entitlement)
            
            # Create entitlement details
            package = packages[i % len(packages)]
            package_pricing = PackagePricing.objects.filter(package_master_id=package).first()
            
            # Determine type based on customer type
            if customer.customer_type == 'bw':
                ent_type = 'bw'
                mbps = Decimal(str(random.choice([10, 20, 50, 100, 200])))
                unit_price = Decimal(str(random.uniform(500, 2000)))
            elif customer.customer_type == 'channel_partner':
                ent_type = 'channel_partner'
                mbps = Decimal(str(random.choice([50, 100, 200])))
                unit_price = Decimal(str(random.uniform(1000, 3000)))
            else:  # soho
                ent_type = 'soho'
                mbps = None
                unit_price = None
            
            entitlement_detail = CustomerEntitlementDetails.objects.create(
                cust_entitlement_id=entitlement,
                start_date=start_date,
                end_date=end_date,
                type=ent_type,
                package_pricing_id=package_pricing,
                mbps=mbps,
                unit_price=unit_price,
                custom_mac_percentage_share=Decimal(str(random.uniform(15, 25))) if ent_type == 'channel_partner' else None,
                last_changes_updated_date=start_date,
                is_active=True,
                status=random.choice(['active', 'active', 'active', 'inactive']),
                created_by=user
            )
            
            self.stdout.write(f'  ✓ Created Entitlement: {entitlement.bill_number} ({scenario["period"]})')
        
        return entitlements

    def create_invoices(self, entitlements, utility_masters, user):
        """Create 10 Invoice Master and Details with different statuses and dates"""
        invoices = []
        today = date.today()
        
        invoice_statuses = ['draft', 'issued', 'paid', 'partial', 'draft', 'issued', 'paid', 'partial', 'issued', 'paid']
        
        for i, entitlement in enumerate(entitlements[:10]):
            issue_date = entitlement.activation_date + timedelta(days=random.randint(0, 5))
            
            # Calculate amounts
            base_amount = entitlement.total_bill
            utility = utility_masters[i % len(utility_masters)]
            vat_rate = utility.vat_rate
            vat_amount = base_amount * (vat_rate / Decimal('100'))
            # Calculate discount (0-10% of base amount)
            discount_percentage = Decimal(str(random.uniform(0, 10)))
            discount_amount = (base_amount * discount_percentage) / Decimal('100')
            total_bill_amount = base_amount + vat_amount - discount_amount
            
            # Determine paid amount based on status
            status = invoice_statuses[i]
            if status == 'paid':
                paid_amount = total_bill_amount
            elif status == 'partial':
                paid_amount = total_bill_amount * Decimal('0.5')
            else:
                paid_amount = Decimal('0')
            
            balance_due = total_bill_amount - paid_amount
            
            invoice = InvoiceMaster.objects.create(
                invoice_number=f'INV{2024}{1000 + i:04d}',
                customer_entitlement_master_id=entitlement,
                issue_date=issue_date,
                total_bill_amount=total_bill_amount,
                total_paid_amount=paid_amount,
                total_balance_due=balance_due,
                total_vat_amount=vat_amount,
                total_discount_amount=discount_amount,
                remarks=f'Invoice for {entitlement.bill_number} - {status}',
                information_master_id=utility,
                status=status,
                created_by=user
            )
            invoices.append(invoice)
            
            # Create invoice details
            entitlement_detail = entitlement.details.first()
            if entitlement_detail:
                InvoiceDetails.objects.create(
                    invoice_master_id=invoice,
                    entitlement_details_id=entitlement_detail,
                    sub_total=base_amount,
                    vat_rate=vat_rate,
                    sub_discount_rate=Decimal(str(random.uniform(0, 10))),
                    remarks=f'Invoice detail for {entitlement_detail.type} service'
                )
            
            self.stdout.write(f'  ✓ Created Invoice: {invoice.invoice_number} ({status}) - Amount: {total_bill_amount}')
        
        return invoices

    def create_payments(self, invoices, entitlements, user):
        """Create 10 Payment Master and Details with different payment methods and dates"""
        payment_methods = ['Bank Transfer', 'bKash', 'Nagad', 'Cash', 'Credit Card', 'Bank Transfer', 'bKash', 'Nagad', 'Cash', 'Bank Transfer']
        payment_statuses = ['completed', 'completed', 'completed', 'pending', 'completed', 'completed', 'completed', 'failed', 'completed', 'completed']
        
        for i, invoice in enumerate(invoices[:10]):
            # Payment date should be after invoice issue date
            payment_date = invoice.issue_date + timedelta(days=random.randint(0, 30))
            
            payment = PaymentMaster.objects.create(
                payment_date=payment_date,
                payment_method=payment_methods[i],
                customer_entitlement_master_id=invoice.customer_entitlement_master_id,
                invoice_master_id=invoice,
                remarks=f'Payment for invoice {invoice.invoice_number} via {payment_methods[i]}',
                status=payment_statuses[i],
                received_by=user,
                created_by=user
            )
            
            # Create payment details
            pay_amount = invoice.total_paid_amount if invoice.total_paid_amount > 0 else invoice.total_bill_amount * Decimal('0.5')
            
            PaymentDetails.objects.create(
                payment_master_id=payment,
                pay_amount=pay_amount,
                transaction_id=f'TXN{random.randint(100000, 999999)}' if payment_methods[i] in ['bKash', 'Nagad', 'Bank Transfer'] else '',
                remarks=f'Payment detail for {invoice.invoice_number}',
                status=payment_statuses[i],
                received_by=user,
                created_by=user
            )
            
            self.stdout.write(f'  ✓ Created Payment: {payment.id} - {payment_methods[i]} - {pay_amount} ({payment_statuses[i]})')

