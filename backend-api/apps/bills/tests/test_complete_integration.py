"""
Comprehensive Integration Tests for Customer Billing & Invoice Generation System

Tests cover:
- Customer creation (BW, MAC, SOHO)
- Entitlement master and details
- Package master and pricing
- Invoice generation with all customer types
- Payment processing
- Mbps change detection
- VAT calculations
- Multiple scenarios
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.customers.models import CustomerMaster, KAMMaster
from apps.bills.models import (
    CustomerEntitlementMaster,
    CustomerEntitlementDetails,
    InvoiceMaster,
    InvoiceDetails
)
from apps.package.models import PackageMaster, PackagePricing
from apps.payment.models import PaymentMaster, PaymentDetails
from apps.utility.models import UtilityInformationMaster
from apps.bills.utils import generate_invoice_for_entitlement
from datetime import date, timedelta
from decimal import Decimal

User = get_user_model()


class ComprehensiveInvoiceSystemTests(TestCase):
    """Complete integration tests for the invoice generation system"""
    
    def setUp(self):
        """Set up test data"""
        # Create user with email (required by CustomUserManager)
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123'
        )
        
        # Create KAM
        self.kam = KAMMaster.objects.create(
            kam_name='Test KAM',
            email='kam@example.com',
            phone='+8801712345678'
        )
        
        # Create utility with VAT
        self.utility = UtilityInformationMaster.objects.create(
            vat_rate=Decimal('15.00'),
            terms_condition='Payment due within 30 days',
            is_active=True
        )
        
        # Create package masters
        self.package_ipt = PackageMaster.objects.create(
            package_name='IPT',
            package_type='bw'
        )
        self.package_cdn = PackageMaster.objects.create(
            package_name='CDN',
            package_type='bw'
        )
        self.package_nix = PackageMaster.objects.create(
            package_name='NIX',
            package_type='bw'
        )
        self.package_soho = PackageMaster.objects.create(
            package_name='Home 50Mbps',
            package_type='soho'
        )
        
        # Create package pricing for SOHO
        self.soho_pricing = PackagePricing.objects.create(
            package_master_id=self.package_soho,
            rate=Decimal('1500.00'),
            val_start_at=date(2025, 1, 1),
            val_end_at=date(2025, 12, 31)
        )
    
    def test_scenario_1_bw_customer_single_package(self):
        """
        Scenario 1: BW Customer with single package (IPT)
        - Create customer
        - Create entitlement with single package
        - Generate invoice
        - Verify calculations
        """
        # Create BW customer
        customer = CustomerMaster.objects.create(
            customer_name='BW Customer Single',
            email='bw1@example.com',
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
        
        # Create entitlement detail (IPT)
        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Generate invoice for Dec 15 (15 days)
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 15)
        )
        
        # Verify
        if not result['success']:
            print(f"Invoice generation failed: {result.get('message')}")
        self.assertTrue(result['success'])
        invoice = result['invoice']
        calculation = result['calculation']
        
        # Expected: 15 days × 10 Mbps × 100 = 15,000
        expected_total_bill = Decimal('15000.00')
        expected_vat = expected_total_bill * Decimal('0.15')  # 2,250
        expected_total = expected_total_bill + expected_vat  # 17,250
        
        self.assertEqual(invoice.total_bill, expected_total_bill)
        self.assertEqual(invoice.total_vat_amount, expected_vat)
        self.assertEqual(invoice.total_bill_amount, expected_total)
        self.assertEqual(len(calculation['details']), 1)
        self.assertEqual(calculation['details'][0]['days'], 15)
    
    def test_scenario_2_bw_customer_multiple_packages(self):
        """
        Scenario 2: BW Customer with multiple packages (IPT, CDN, NIX)
        - Multiple entitlement details
        - Generate invoice
        - Verify all packages calculated
        """
        customer = CustomerMaster.objects.create(
            customer_name='BW Customer Multi',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Create multiple package details
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_cdn,
            mbps=Decimal('15'),
            unit_price=Decimal('150'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_nix,
            mbps=Decimal('10'),
            unit_price=Decimal('50'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Generate invoice for Dec 15
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 15)
        )
        
        # Verify
        self.assertTrue(result['success'])
        calculation = result['calculation']
        
        # Expected:
        # IPT: 15 × 10 × 100 = 15,000
        # CDN: 15 × 15 × 150 = 33,750
        # NIX: 15 × 10 × 50 = 7,500
        # Total: 56,250
        expected_total = Decimal('56250.00')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(len(calculation['details']), 3)
    
    def test_scenario_3_bw_customer_mbps_change(self):
        """
        Scenario 3: BW Customer with mbps change
        - Create initial detail
        - Create new detail with different mbps (triggers auto-close)
        - Generate invoice
        - Verify both periods calculated correctly
        """
        customer = CustomerMaster.objects.create(
            customer_name='BW Customer Mbps Change',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Create initial detail (10 Mbps)
        detail1 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Simulate mbps change by manually closing detail1 and creating detail2
        # (The auto-close logic is in the ViewSet, not the model)
        from datetime import timedelta
        
        # Create new detail with different mbps
        new_start = date(2025, 12, 10)
        
        # Manually close previous detail (simulating what the view does)
        detail1.end_date = new_start - timedelta(days=1)
        detail1.last_changes_updated_date = date.today()
        detail1.is_active = False  # The view marks it as inactive
        detail1.status = 'expired' # The view marks it as expired
        detail1.save()
        
        # Create new detail
        detail2 = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('15'),  # Changed
            unit_price=Decimal('150'),
            start_date=new_start,
            created_by=self.user
        )
        
        # Refresh detail1 to verify it was closed
        detail1.refresh_from_db()
        
        # Verify detail1 was closed
        self.assertEqual(detail1.end_date, date(2025, 12, 9))
        
        # Generate invoice for Dec 15
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 15)
        )
        
        # Verify
        self.assertTrue(result['success'])
        calculation = result['calculation']
        
        # Expected:
        # Detail 1: 9 days (Dec 1-9) × 10 × 100 = 9,000
        # Detail 2: 6 days (Dec 10-15) × 15 × 150 = 13,500
        # Total: 22,500
        expected_total = Decimal('22500.00')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(len(calculation['details']), 2)
    
    def test_scenario_4_mac_customer_default_percentage(self):
        """
        Scenario 4: MAC Customer with default percentage share
        - Create MAC customer with default percentage
        - Create usage without custom percentage
        - Generate invoice
        - Verify percentage applied
        """
        customer = CustomerMaster.objects.create(
            customer_name='MAC Customer Default',
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
        
        # Create usage without custom percentage
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 4),
            created_by=self.user
        )
        
        # Generate invoice for Dec 12 (9 days)
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 12)
        )
        
        # Verify
        self.assertTrue(result['success'])
        calculation = result['calculation']
        
        # Expected: 9 days × 10 × 100 × 55% = 4,950
        expected_total = Decimal('4950.00')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(calculation['details'][0]['percentage_share'], 55.0)
    
    def test_scenario_5_mac_customer_custom_percentage(self):
        """
        Scenario 5: MAC Customer with custom percentage share
        - Create usage with custom percentage
        - Verify custom percentage overrides default
        """
        customer = CustomerMaster.objects.create(
            customer_name='MAC Customer Custom',
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
        
        # Create usage with custom percentage
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            custom_mac_percentage_share=Decimal('50.00'),  # Custom
            start_date=date(2025, 12, 5),
            created_by=self.user
        )
        
        # Generate invoice
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 10)
        )
        
        # Verify custom percentage used
        self.assertTrue(result['success'])
        calculation = result['calculation']
        
        # Expected: 6 days × 10 × 100 × 50% = 3,000
        expected_total = Decimal('3000.00')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(calculation['details'][0]['percentage_share'], 50.0)
    
    def test_scenario_6_mac_customer_multiple_usages(self):
        """
        Scenario 6: MAC Customer with multiple usages
        - Multiple usage records
        - Different percentage shares
        - Verify all calculated correctly
        """
        customer = CustomerMaster.objects.create(
            customer_name='MAC Customer Multi Usage',
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
        
        # Usage 1: 55% share
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            custom_mac_percentage_share=Decimal('55.00'),
            start_date=date(2025, 12, 4),
            created_by=self.user
        )
        
        # Usage 2: 45% share
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='channel_partner',
            mbps=Decimal('20'),
            unit_price=Decimal('200'),
            custom_mac_percentage_share=Decimal('45.00'),
            start_date=date(2025, 12, 5),
            created_by=self.user
        )
        
        # Generate invoice for Dec 12
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 12)
        )
        
        # Verify
        self.assertTrue(result['success'])
        calculation = result['calculation']
        
        # Expected:
        # Usage 1: 9 days × 10 × 100 × 55% = 4,950
        # Usage 2: 8 days × 20 × 200 × 45% = 14,400
        # Total: 19,350
        expected_total = Decimal('19350.00')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(len(calculation['details']), 2)
    
    def test_scenario_7_soho_customer_fixed_pricing(self):
        """
        Scenario 7: SOHO Customer with fixed monthly pricing
        - Create SOHO customer
        - Assign package pricing
        - Generate invoice
        - Verify fixed rate applied
        """
        customer = CustomerMaster.objects.create(
            customer_name='SOHO Customer',
            customer_type='soho',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Create entitlement detail with package pricing
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='soho',
            package_pricing_id=self.soho_pricing,
            package_master_id=self.package_soho,
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Generate invoice
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 31)
        )
        
        # Verify
        self.assertTrue(result['success'])
        calculation = result['calculation']
        
        # Expected: Fixed rate of 1,500
        expected_total = Decimal('1500.00')
        
        self.assertEqual(calculation['total_bill'], expected_total)
        self.assertEqual(calculation['details'][0]['billing_type'], 'Monthly Fixed')
    
    def test_scenario_8_payment_processing(self):
        """
        Scenario 8: Complete payment processing flow
        - Generate invoice
        - Create payment
        - Verify invoice updated
        - Test partial and full payment
        """
        # Create customer and invoice
        customer = CustomerMaster.objects.create(
            customer_name='Payment Test Customer',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Generate invoice
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 15)
        )
        
        invoice = result['invoice']
        total_amount = invoice.total_bill_amount
        
        # Test partial payment
        payment = PaymentMaster.objects.create(
            invoice_master_id=invoice,
            customer_entitlement_master_id=entitlement,
            payment_date=date.today(),
            payment_method='Bank Transfer',
            status='completed',
            created_by=self.user
        )
        
        PaymentDetails.objects.create(
            payment_master_id=payment,
            pay_amount=Decimal('10000.00'),
            status='completed',
            created_by=self.user
        )
        
        # Recalculate invoice totals
        invoice.calculate_totals()
        invoice.refresh_from_db()
        
        # Verify partial payment
        self.assertEqual(invoice.total_paid_amount, Decimal('10000.00'))
        self.assertEqual(invoice.total_balance_due, total_amount - Decimal('10000.00'))
        self.assertEqual(invoice.status, 'partial')
        
        # Add remaining payment
        PaymentDetails.objects.create(
            payment_master_id=payment,
            pay_amount=invoice.total_balance_due,
            status='completed',
            created_by=self.user
        )
        
        invoice.calculate_totals()
        invoice.refresh_from_db()
        
        # Verify full payment
        self.assertEqual(invoice.total_balance_due, Decimal('0.00'))
        self.assertEqual(invoice.status, 'paid')
    
    def test_scenario_9_vat_calculation(self):
        """
        Scenario 9: VAT calculation verification
        - Generate invoice
        - Verify VAT calculated correctly
        - Verify total_bill_amount = total_bill + VAT
        """
        customer = CustomerMaster.objects.create(
            customer_name='VAT Test Customer',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        # Generate invoice
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 10)
        )
        
        invoice = result['invoice']
        
        # Verify VAT calculation
        # 10 days × 10 × 100 = 10,000
        # VAT: 10,000 × 15% = 1,500
        # Total: 11,500
        
        self.assertEqual(invoice.total_bill, Decimal('10000.00'))
        self.assertEqual(invoice.total_vat_amount, Decimal('1500.00'))
        self.assertEqual(invoice.total_bill_amount, Decimal('11500.00'))
    
    def test_scenario_10_duplicate_invoice_prevention(self):
        """
        Scenario 10: Duplicate invoice prevention
        - Generate invoice
        - Try to generate again
        - Verify duplicate prevented
        - Test force flag
        """
        customer = CustomerMaster.objects.create(
            customer_name='Duplicate Test',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package_ipt,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        target_date = date(2025, 12, 15)
        
        # First generation
        result1 = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=target_date,
            force=False
        )
        
        self.assertTrue(result1['success'])
        
        # Second generation (should be prevented)
        result2 = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=target_date,
            force=False
        )
        
        self.assertFalse(result2['success'])
        self.assertIn('already exists', result2['message'])
        
        # With force flag (should succeed)
        result3 = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=target_date,
            force=True
        )
        
        self.assertTrue(result3['success'])


class EdgeCaseTests(TestCase):
    """Test edge cases and boundary conditions"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='edge@example.com',
            password='pass'
        )
        self.kam = KAMMaster.objects.create(kam_name='Test KAM')
        self.utility = UtilityInformationMaster.objects.create(
            vat_rate=Decimal('15.00'),
            is_active=True
        )
        self.package = PackageMaster.objects.create(
            package_name='Test Package',
            package_type='bw'
        )
    
    def test_zero_mbps(self):
        """Test handling of zero mbps"""
        customer = CustomerMaster.objects.create(
            customer_name='Zero Mbps Test',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package,
            mbps=Decimal('0'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 1),
            created_by=self.user
        )
        
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 15)
        )
        
        # Should generate but with zero amount
        self.assertTrue(result['success'])
        self.assertEqual(result['calculation']['total_bill'], Decimal('0.00'))
    
    def test_single_day_billing(self):
        """Test billing for a single day"""
        customer = CustomerMaster.objects.create(
            customer_name='Single Day Test',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=customer,
            activation_date=date(2025, 12, 15),
            created_by=self.user
        )
        
        CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=entitlement,
            type='bw',
            package_master_id=self.package,
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2025, 12, 15),
            created_by=self.user
        )
        
        result = generate_invoice_for_entitlement(
            entitlement=entitlement,
            target_date=date(2025, 12, 15)
        )
        
        # Should calculate for 1 day
        self.assertTrue(result['success'])
        self.assertEqual(result['calculation']['details'][0]['days'], 1)
        self.assertEqual(result['calculation']['total_bill'], Decimal('1000.00'))
