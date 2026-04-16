from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.customers.models import CustomerMaster, KAMMaster
from apps.bills.models import CustomerEntitlementMaster, CustomerEntitlementDetails, InvoiceMaster, InvoiceDetails
from apps.package.models import PackageMaster, PackagePricing
from apps.bills.utils import (
    calculate_bw_customer_bill,
    calculate_mac_customer_bill,
    calculate_soho_customer_bill,
    get_billing_start_date,
    generate_invoice_for_entitlement
)
from datetime import date, timedelta
from decimal import Decimal

User = get_user_model()


class InvoiceGenerationTests(TestCase):
    """Test cases for invoice generation system"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password'
        )
        self.kam = KAMMaster.objects.create(kam_name='Test KAM')
        
    def test_bw_customer_single_entitlement(self):
        """Test BW customer with single entitlement detail"""
        # Create BW customer
        customer = CustomerMaster.objects.create(
            customer_name='BW Customer Single',
            email='bw_single@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        # Create entitlement
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Create single entitlement detail (IPT)
        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 31),
            remarks='IPT - Internet',
            created_by=self.user
        )
        
        # Calculate bill for 30 days (Dec 1-30)
        target_date = date(2025, 12, 30)
        calculation = calculate_bw_customer_bill(entitlement, target_date)
        
        # Expected: 30 days × 10 Mbps × 100 = 30,000
        expected_amount = Decimal('30') * Decimal('10') * Decimal('100')
        
        self.assertEqual(calculation['total_bill'], expected_amount)
        self.assertEqual(calculation['billing_start_date'], date(2025, 12, 1))
        self.assertEqual(calculation['billing_end_date'], target_date)
        self.assertEqual(len(calculation['details']), 1)
        self.assertEqual(calculation['details'][0]['days'], 30)
        
    def test_bw_customer_multiple_entitlements_with_changes(self):
        """Test BW customer with multiple entitlement details (package changes) - Example A from spec"""
        customer = CustomerMaster.objects.create(
            customer_name='BW Customer Multiple',
            email='bw_multiple@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Detail 1: Dec 1-4 (4 days)
        detail1_ipt = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 4),
            remarks='IPT',
            created_by=self.user
        )
        detail1_cdn = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('15'),
            unit_price=Decimal('150'),
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 4),
            remarks='CDN',
            created_by=self.user
        )
        
        # Detail 2: Dec 5-9 (5 days)
        detail2_ipt = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('15'),
            unit_price=Decimal('150'),
            start_date=date(2025, 12, 5),
            end_date=date(2025, 12, 9),
            remarks='IPT',
            created_by=self.user
        )
        
        # Detail 3: Dec 10-14 (5 days)
        detail3_ipt = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 10),
            end_date=date(2025, 12, 14),
            remarks='IPT',
            created_by=self.user
        )
        
        # Detail 4: Dec 15 onwards (1 day when target is Dec 15)
        detail4_ipt = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('20'),
            unit_price=Decimal('200'),
            start_date=date(2025, 12, 15),
            end_date=date(2099, 12, 31),
            remarks='IPT',
            created_by=self.user
        )
        
        # Calculate for target date Dec 15
        target_date = date(2025, 12, 15)
        calculation = calculate_bw_customer_bill(entitlement, target_date)
        
        # Expected calculations:
        # Detail 1 IPT: 4 days × 10 × 100 = 4,000
        # Detail 1 CDN: 4 days × 15 × 150 = 9,000
        # Detail 2 IPT: 5 days × 15 × 150 = 11,250
        # Detail 3 IPT: 5 days × 10 × 100 = 5,000
        # Detail 4 IPT: 1 day × 20 × 200 = 4,000
        # Total: 33,250
        
        expected_total = Decimal('4000') + Decimal('9000') + Decimal('11250') + Decimal('5000') + Decimal('4000')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(len(calculation['details']), 5)
        
    def test_bw_customer_exclude_future_entitlements(self):
        """Test that entitlements starting after target date are excluded"""
        customer = CustomerMaster.objects.create(
            customer_name='BW Customer Future',
            email='bw_future@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Current detail
        detail1 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            end_date=date(2025, 12, 14),
            remarks='IPT',
            created_by=self.user
        )
        
        # Future detail (starts after target date)
        detail2 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('25'),
            unit_price=Decimal('250'),
            start_date=date(2025, 12, 20),
            end_date=date(2099, 12, 31),
            remarks='IPT',
            created_by=self.user
        )
        
        # Calculate for Dec 15
        target_date = date(2025, 12, 15)
        calculation = calculate_bw_customer_bill(entitlement, target_date)
        
        # Only detail1 should be included (14 days)
        expected_amount = Decimal('14') * Decimal('10') * Decimal('100')
        
        self.assertEqual(calculation['total_bill'], expected_amount)
        self.assertEqual(len(calculation['details']), 1)
        
    def test_mac_customer_default_percentage(self):
        """Test MAC customer using default percentage share"""
        customer = CustomerMaster.objects.create(
            customer_name='MAC Customer Default',
            email='mac_default@example.com',
            customer_type='channel_partner',
            default_percentage_share=Decimal('55.00'),
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 4),
            created_by=self.user
        )
        
        # Usage without custom percentage (should use default 55%)
        usage1 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 4),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )
        
        # Calculate for Dec 12 (9 days: Dec 4-12)
        target_date = date(2025, 12, 12)
        calculation = calculate_mac_customer_bill(entitlement, target_date)
        
        # Expected: 9 days × 10 × 100 × 55% = 4,950
        base_amount = Decimal('9') * Decimal('10') * Decimal('100')
        expected_amount = base_amount * (Decimal('55') / Decimal('100'))
        
        self.assertEqual(calculation['total_bill'], expected_amount)
        self.assertEqual(calculation['details'][0]['percentage_share'], 55.0)
        
    def test_mac_customer_custom_percentage(self):
        """Test MAC customer with custom percentage share"""
        customer = CustomerMaster.objects.create(
            customer_name='MAC Customer Custom',
            email='mac_custom@example.com',
            customer_type='channel_partner',
            default_percentage_share=Decimal('40.00'),
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 5),
            created_by=self.user
        )
        
        # Usage with custom percentage (should override default)
        usage1 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            custom_mac_percentage_share=Decimal('50.00'),
            start_date=date(2025, 12, 5),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )
        
        target_date = date(2025, 12, 10)
        calculation = calculate_mac_customer_bill(entitlement, target_date)
        
        # Expected: 6 days × 10 × 100 × 50% = 3,000
        base_amount = Decimal('6') * Decimal('10') * Decimal('100')
        expected_amount = base_amount * (Decimal('50') / Decimal('100'))
        
        self.assertEqual(calculation['total_bill'], expected_amount)
        self.assertEqual(calculation['details'][0]['percentage_share'], 50.0)
        
    def test_mac_customer_multiple_usages(self):
        """Test MAC customer with multiple usages - Example B from spec"""
        customer = CustomerMaster.objects.create(
            customer_name='MAC Customer Multiple',
            email='mac_multiple@example.com',
            customer_type='channel_partner',
            default_percentage_share=Decimal('50.00'),
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 4),
            created_by=self.user
        )
        
        # Usage 1: Dec 4 onwards, 55% share
        usage1 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            custom_mac_percentage_share=Decimal('55.00'),
            start_date=date(2025, 12, 4),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )
        
        # Usage 2: Dec 5 onwards, 45% share
        usage2 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('20'),
            unit_price=Decimal('200'),
            custom_mac_percentage_share=Decimal('45.00'),
            start_date=date(2025, 12, 5),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )
        
        # Usage 3: Dec 13 onwards (should be excluded when target is Dec 12)
        usage3 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('30'),
            unit_price=Decimal('300'),
            start_date=date(2025, 12, 13),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )
        
        # Calculate for Dec 12
        target_date = date(2025, 12, 12)
        calculation = calculate_mac_customer_bill(entitlement, target_date)
        
        # Expected:
        # Usage 1: 9 days (Dec 4-12) × 10 × 100 × 55% = 4,950
        # Usage 2: 8 days (Dec 5-12) × 20 × 200 × 45% = 14,400
        # Usage 3: Excluded (starts Dec 13)
        # Total: 19,350
        
        usage1_amount = Decimal('9') * Decimal('10') * Decimal('100') * (Decimal('55') / Decimal('100'))
        usage2_amount = Decimal('8') * Decimal('20') * Decimal('200') * (Decimal('45') / Decimal('100'))
        expected_total = usage1_amount + usage2_amount
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(len(calculation['details']), 2)
        
    def test_soho_customer_fixed_pricing(self):
        """Test SOHO customer with fixed monthly pricing"""
        customer = CustomerMaster.objects.create(
            customer_name='SOHO Customer',
            email='soho@example.com',
            customer_type='soho',
            kam_id=self.kam,
            created_by=self.user
        )

        # Create package
        package = PackageMaster.objects.create(
            package_name='Home 50Mbps',
            package_type='soho'
        )

        # Create pricing
        pricing = PackagePricing.objects.create(
            package_master_id=package,
            rate=Decimal('1500.00'),
            val_start_at=date(2025, 1, 1),
            val_end_at=date(2025, 12, 31)
        )

        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )

        # Create entitlement detail with package pricing
        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='soho',
            package_pricing_id=pricing,
            package_master_id=package,
            start_date=date(2025, 12, 1),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )

        target_date = date(2025, 12, 31)
        calculation = calculate_soho_customer_bill(entitlement, target_date)

        # Expected: 1 month × 1500.00 = 1500.00
        self.assertEqual(calculation['total_bill'], Decimal('1500.00'))
        self.assertEqual(len(calculation['details']), 1)
        self.assertEqual(calculation['details'][0]['billing_type'], 'Monthly Fixed')
        self.assertEqual(calculation['details'][0]['months_count'], 1)

    def test_soho_customer_multi_month_billing(self):
        """Test SOHO customer billing across multiple months"""
        customer = CustomerMaster.objects.create(
            customer_name='SOHO Customer Multi',
            email='soho_multi@example.com',
            customer_type='soho',
            kam_id=self.kam,
            created_by=self.user
        )

        # Create package
        package = PackageMaster.objects.create(
            package_name='Home 100Mbps',
            package_type='soho'
        )

        # Create pricing
        pricing = PackagePricing.objects.create(
            package_master_id=package,
            rate=Decimal('2000.00'),
            val_start_at=date(2025, 1, 1),
            val_end_at=date(2025, 12, 31)
        )

        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 11, 15),  # Start in November
            created_by=self.user
        )

        # Create entitlement detail with package pricing
        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='soho',
            package_pricing_id=pricing,
            package_master_id=package,
            start_date=date(2025, 11, 15),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )

        # Bill for Jan 15, 2026 (spans Dec 2025 and Jan 2026)
        target_date = date(2026, 1, 15)
        calculation = calculate_soho_customer_bill(entitlement, target_date)

        # Expected: 3 months (Nov, Dec, Jan) × 2000.00 = 6000.00
        # Billing period: Nov 15 to Jan 15 spans November, December, and January
        expected_months = 3
        expected_total = Decimal(str(expected_months)) * Decimal('2000.00')

        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(len(calculation['details']), 1)
        self.assertEqual(calculation['details'][0]['months_count'], expected_months)
        self.assertEqual(calculation['details'][0]['package_rate'], 2000.0)
        
    def test_billing_start_date_with_last_invoice(self):
        """Test billing start date uses day after last_bill_invoice_date"""
        customer = CustomerMaster.objects.create(
            customer_name='Customer With History',
            email='history@example.com',
            customer_type='bw',
            last_bill_invoice_date=date(2025, 11, 30),
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 11, 1),
            created_by=self.user
        )
        
        billing_start = get_billing_start_date(customer, entitlement)
        
        # Should be Dec 1 (day after Nov 30)
        self.assertEqual(billing_start, date(2025, 12, 1))
        
    def test_billing_start_date_without_last_invoice(self):
        """Test billing start date returns None when no last_bill_invoice_date (uses detail start_date)"""
        customer = CustomerMaster.objects.create(
            customer_name='New Customer',
            email='new@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        billing_start = get_billing_start_date(customer, entitlement)
        
        # Should be None - each detail's start_date will be used directly
        self.assertIsNone(billing_start)
        
    def test_generate_invoice_duplicate_prevention(self):
        """Test that duplicate invoices are prevented"""
        customer = CustomerMaster.objects.create(
            customer_name='Duplicate Test',
            email='duplicate@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )

        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )

        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            end_date=date(2099, 12, 31),
            remarks='IPT',
            created_by=self.user
        )

        target_date = date(2025, 12, 15)

        # First generation should succeed
        result1 = generate_invoice_for_entitlement(entitlement, target_date, force=False)
        self.assertTrue(result1['success'])

        # Second generation should be prevented
        result2 = generate_invoice_for_entitlement(entitlement, target_date, force=False)
        self.assertFalse(result2['success'])
        self.assertIn('already exists', result2['message'])

        # With force=True, should succeed
        result3 = generate_invoice_for_entitlement(entitlement, target_date, force=True)
        self.assertTrue(result3['success'])

    def test_generate_invoice_past_billing_allowed(self):
        """Test that past billing is allowed for corrections with adjusted dates"""
        customer = CustomerMaster.objects.create(
            customer_name='Past Billing Test',
            email='past@example.com',
            customer_type='bw',
            last_bill_invoice_date=date(2025, 12, 14),  # Last invoice was on Dec 14
            kam_id=self.kam,
            created_by=self.user
        )

        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            last_bill_invoice_date=date(2025, 12, 14),  # Same as customer
            created_by=self.user
        )

        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            end_date=date(2099, 12, 31),
            remarks='IPT',
            created_by=self.user
        )

        # Generate invoice for Dec 13 (before last invoice date) - should be allowed for corrections
        past_target_date = date(2025, 12, 13)

        result = generate_invoice_for_entitlement(entitlement, past_target_date, force=False)
        self.assertTrue(result['success'])
        self.assertIsNotNone(result['invoice'])

        # Check that invoice details were created
        invoice = result['invoice']
        self.assertTrue(invoice.details.exists())
        self.assertGreater(invoice.details.count(), 0)
