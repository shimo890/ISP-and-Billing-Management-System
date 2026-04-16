from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from apps.customers.models import CustomerMaster, KAMMaster
from apps.bills.models import CustomerEntitlementMaster, CustomerEntitlementDetails, InvoiceMaster
from apps.package.models import PackageMaster, PackagePricing
from datetime import date, timedelta
from decimal import Decimal
from apps.bills.serializers import CustomerEntitlementDetailsSerializer
from apps.bills.views import CustomerEntitlementDetailsViewSet

User = get_user_model()

class BillingLogicTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='password')
        self.kam = KAMMaster.objects.create(kam_name='Test KAM')
        
        # Create Bandwidth Customer
        self.bw_customer = CustomerMaster.objects.create(
            customer_name='BW Customer',
            email='bw@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        
        # Create Channel Partner Customer with default share
        self.cp_customer = CustomerMaster.objects.create(
            customer_name='CP Customer',
            email='cp@example.com',
            customer_type='channel_partner',
            kam_id=self.kam,
            default_percentage_share=Decimal('40.00'),
            created_by=self.user
        )
        
        # Create Entitlement Masters
        self.bw_entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.bw_customer,
            created_by=self.user
        )
        self.cp_entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.cp_customer,
            created_by=self.user
        )

    def test_bw_end_date_default(self):
        """Test that end_date defaults to 2099-12-31 for BW customers if not provided"""
        # Using serializer directly to test validation logic
        from apps.bills.serializers import CustomerEntitlementDetailsSerializer
        
        data = {
            'cust_entitlement_id': self.bw_entitlement.id,
            'type': 'bw',
            'mbps': 10,
            'unit_price': 100,
            'start_date': date.today(),
            # No end_date provided
        }
        
        serializer = CustomerEntitlementDetailsSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['end_date'], date(2099, 12, 31))

    def test_cp_default_share(self):
        """Test that Channel Partner uses default share if not provided"""
        from apps.bills.serializers import CustomerEntitlementDetailsSerializer
        
        data = {
            'cust_entitlement_id': self.cp_entitlement.id,
            'type': 'channel_partner',
            'mbps': 10,
            'unit_price': 100,
            'start_date': date.today(),
            'end_date': date.today() + timedelta(days=30),
            # No custom_mac_percentage_share provided
        }
        
        serializer = CustomerEntitlementDetailsSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['custom_mac_percentage_share'], Decimal('40.00'))

    def test_cp_missing_share_error(self):
        """Test validation error if no share provided and no default exists"""
        # Create CP customer without default share
        cp_no_default = CustomerMaster.objects.create(
            customer_name='CP No Default',
            email='cp_nodefault@example.com',
            customer_type='channel_partner',
            kam_id=self.kam,
            default_percentage_share=None,
            created_by=self.user
        )
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=cp_no_default,
            created_by=self.user
        )
        
        from apps.bills.serializers import CustomerEntitlementDetailsSerializer
        
        data = {
            'cust_entitlement_id': entitlement.id,
            'type': 'channel_partner',
            'mbps': 10,
            'unit_price': 100,
            'start_date': date.today(),
            'end_date': date.today() + timedelta(days=30),
        }
        
        serializer = CustomerEntitlementDetailsSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('custom_mac_percentage_share', serializer.errors)

    def test_package_update_history(self):
        """Test that updating mbps/price creates new record and expires old one"""
        # Create initial detail
        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=self.bw_entitlement,
            type='bw',
            mbps=10,
            unit_price=100,
            start_date=date.today() - timedelta(days=10),
            end_date=date(2099, 12, 31),
            created_by=self.user
        )
        
        from apps.bills.views import CustomerEntitlementDetailsViewSet
        from rest_framework.test import APIRequestFactory
        
        from rest_framework.request import Request
        factory = APIRequestFactory()
        view = CustomerEntitlementDetailsViewSet()
        view.request = Request(factory.patch('/', {}))
        view.request.user = self.user
        view.format_kwarg = None
        view.kwargs = {'pk': detail.id}
        
        # Simulate update via serializer
        from apps.bills.serializers import CustomerEntitlementDetailsSerializer
        
        data = {
            'mbps': 20, # Changed
            'unit_price': 100
        }
        
        serializer = CustomerEntitlementDetailsSerializer(detail, data=data, partial=True)
        self.assertTrue(serializer.is_valid())
        
        # Call perform_update manually since we're not doing full request dispatch
        view.perform_update(serializer)
        
        # Reload old detail
        detail.refresh_from_db()
        self.assertEqual(detail.status, 'expired')
        self.assertFalse(detail.is_active)
        self.assertEqual(detail.end_date, date.today() - timedelta(days=1))
        
        # Check new detail
        new_detail = CustomerEntitlementDetails.objects.filter(
            cust_entitlement_id=self.bw_entitlement,
            status='active'
        ).first()
        
        self.assertIsNotNone(new_detail)
        self.assertEqual(new_detail.mbps, 20)
        self.assertEqual(new_detail.start_date, date.today())

    def test_cp_share_update_history(self):
        """Test that updating share creates new record"""
        detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=self.cp_entitlement,
            type='channel_partner',
            mbps=10,
            unit_price=100,
            custom_mac_percentage_share=Decimal('40.00'),
            start_date=date.today() - timedelta(days=10),
            end_date=date.today() + timedelta(days=30),
            created_by=self.user
        )
        
        from apps.bills.views import CustomerEntitlementDetailsViewSet
        from rest_framework.test import APIRequestFactory
        
        from rest_framework.request import Request
        factory = APIRequestFactory()
        view = CustomerEntitlementDetailsViewSet()
        view.request = Request(factory.patch('/', {}))
        view.request.user = self.user
        view.format_kwarg = None
        view.kwargs = {'pk': detail.id}
        
        from apps.bills.serializers import CustomerEntitlementDetailsSerializer
        
        data = {
            'custom_mac_percentage_share': Decimal('50.00') # Changed
        }
        
        serializer = CustomerEntitlementDetailsSerializer(detail, data=data, partial=True)
        self.assertTrue(serializer.is_valid())
        
        view.perform_update(serializer)
        
        detail.refresh_from_db()
        self.assertEqual(detail.status, 'expired')
        
        new_detail = CustomerEntitlementDetails.objects.filter(
            cust_entitlement_id=self.cp_entitlement,
            status='active'
        ).first()
        
        self.assertIsNotNone(new_detail)
        self.assertEqual(new_detail.custom_mac_percentage_share, Decimal('50.00'))


class EntitlementBehaviorTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password'
        )
        self.kam = KAMMaster.objects.create(kam_name='Test KAM')
        self.customer = CustomerMaster.objects.create(
            customer_name='BW Customer',
            email='bw@example.com',
            customer_type='bw',
            kam_id=self.kam,
            created_by=self.user
        )
        self.entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.customer,
            activation_date=date(2026, 2, 1),
            created_by=self.user
        )

    def test_auto_close_previous_detail_no_overlap(self):
        """New detail should close previous one on the day before start_date."""
        previous = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=self.entitlement,
            type='bw',
            mbps=Decimal('10'),
            unit_price=Decimal('100'),
            start_date=date(2026, 2, 1),
            end_date=None,
            is_active=True,
            status='active',
            created_by=self.user
        )

        new_data = {
            'cust_entitlement_id': self.entitlement.id,
            'type': 'bw',
            'mbps': Decimal('20'),
            'unit_price': Decimal('100'),
            'start_date': date(2026, 3, 1),
            'status': 'active',
            'is_active': True,
        }

        factory = APIRequestFactory()
        request = factory.post('/api/bills/entitlement-details/', new_data, format='json')
        force_authenticate(request, user=self.user)

        viewset = CustomerEntitlementDetailsViewSet()
        viewset.request = request

        serializer = CustomerEntitlementDetailsSerializer(data=new_data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        viewset.perform_create(serializer)

        previous.refresh_from_db()
        self.assertEqual(previous.end_date, date(2026, 2, 28))

    def test_invoice_updates_last_bill_invoice_date(self):
        """Creating an invoice updates customer's last_bill_invoice_date."""
        InvoiceMaster.objects.create(
            customer_entitlement_master_id=self.entitlement,
            issue_date=date(2026, 2, 28),
            created_by=self.user
        )
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.last_bill_invoice_date, date(2026, 2, 28))
