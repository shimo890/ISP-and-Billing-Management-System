"""
Tests for Customer Credit Balance and Fund Transfer APIs.

Covers:
- GET /api/customers/{id}/credit-balance/
- GET /api/payments/fund-transfers/
- GET /api/payments/fund-transfers/{id}/
- POST /api/payments/fund-transfers/ (single→single, validation)
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date

from apps.customers.models import CustomerMaster, KAMMaster, CustomerCreditTransaction
from apps.payment.models import CustomerFundTransfer, CustomerFundTransferLine

User = get_user_model()


class CustomerCreditBalanceAPITests(TestCase):
    """Tests for GET /api/customers/{id}/credit-balance/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username='admin',
            email='admin@test.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

        self.kam = KAMMaster.objects.create(kam_name='Test KAM', email='kam@test.com')
        self.customer = CustomerMaster.objects.create(
            customer_name='Tiger Online',
            customer_type='bw',
            status='active',
            kam_id=self.kam,
        )

    def test_credit_balance_empty(self):
        """Credit balance is 0 when no transactions."""
        response = self.client.get(f'/api/customers/{self.customer.id}/credit-balance/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['customer_id'], self.customer.id)
        self.assertEqual(response.data['customer_name'], 'Tiger Online')
        self.assertEqual(float(response.data['credit_balance']), 0.0)
        self.assertEqual(response.data['transactions'], [])

    def test_credit_balance_with_transactions(self):
        """Credit balance reflects overpayment and transfer transactions."""
        CustomerCreditTransaction.objects.create(
            customer_id=self.customer,
            amount=Decimal('20000.00'),
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
            entry_date=date.today(),
            remarks='Overpayment test',
            created_by=self.user,
        )
        response = self.client.get(f'/api/customers/{self.customer.id}/credit-balance/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data['credit_balance']), 20000.0)
        self.assertEqual(len(response.data['transactions']), 1)
        self.assertEqual(float(response.data['transactions'][0]['amount']), 20000.0)
        self.assertEqual(response.data['transactions'][0]['transaction_type'], 'overpayment')

    def test_credit_balance_requires_auth(self):
        """Credit balance endpoint requires authentication."""
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/customers/{self.customer.id}/credit-balance/')
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_credit_balance_404_for_invalid_customer(self):
        """Returns 404 for non-existent customer."""
        response = self.client.get('/api/customers/99999/credit-balance/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FundTransferAPITests(TestCase):
    """Tests for Fund Transfers API (list, retrieve, create)."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_superuser(
            username='admin',
            email='admin@test.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

        self.kam = KAMMaster.objects.create(kam_name='Raju', email='raju@test.com')
        self.source_customer = CustomerMaster.objects.create(
            customer_name='Tiger Online',
            customer_type='bw',
            status='active',
            kam_id=self.kam,
        )
        self.target_customer = CustomerMaster.objects.create(
            customer_name='Gazi Shihab',
            customer_type='bw',
            status='active',
            kam_id=self.kam,
        )
        # Give source customer credit so we can transfer
        CustomerCreditTransaction.objects.create(
            customer_id=self.source_customer,
            amount=Decimal('20000.00'),
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_MANUAL,
            entry_date=date.today(),
            remarks='Test credit',
            created_by=self.user,
        )

    def test_fund_transfer_list_empty(self):
        """List fund transfers returns empty list when none exist."""
        response = self.client.get('/api/payments/fund-transfers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 0)

    def test_fund_transfer_create_single_to_single(self):
        """Create transfer: single source → single target."""
        data = {
            'transfer_date': date.today().isoformat(),
            'remarks': 'Owner Adjustment Transfer – Raju',
            'source_customer_id': self.source_customer.id,
            'target_customer_id': self.target_customer.id,
            'amount': '20000.00',
        }
        response = self.client.post('/api/payments/fund-transfers/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('reference_number', response.data)
        self.assertTrue(response.data['reference_number'].startswith('TRF-'))
        self.assertEqual(response.data['transfer_date'], data['transfer_date'])
        self.assertEqual(response.data['remarks'], data['remarks'])
        self.assertEqual(len(response.data['lines']), 2)
        debit_line = next(l for l in response.data['lines'] if l['side'] == 'debit')
        credit_line = next(l for l in response.data['lines'] if l['side'] == 'credit')
        self.assertEqual(debit_line['customer_id'], self.source_customer.id)
        self.assertEqual(debit_line['customer_name'], 'Tiger Online')
        self.assertEqual(float(debit_line['amount']), -20000.0)
        self.assertEqual(credit_line['customer_id'], self.target_customer.id)
        self.assertEqual(credit_line['customer_name'], 'Gazi Shihab')
        self.assertEqual(float(credit_line['amount']), 20000.0)

        # DB: transfer and lines created
        self.assertEqual(CustomerFundTransfer.objects.count(), 1)
        self.assertEqual(CustomerFundTransferLine.objects.count(), 2)
        # Source credit decreased, target increased
        self.assertEqual(self.source_customer.get_credit_balance(), Decimal('0.00'))
        self.assertEqual(self.target_customer.get_credit_balance(), Decimal('20000.00'))

    def test_fund_transfer_create_with_allocations(self):
        """Create transfer using source_allocations and target_allocations."""
        # Ensure source has credit
        CustomerCreditTransaction.objects.filter(customer_id=self.source_customer).delete()
        CustomerCreditTransaction.objects.create(
            customer_id=self.source_customer,
            amount=Decimal('10000.00'),
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_MANUAL,
            entry_date=date.today(),
            remarks='Credit',
            created_by=self.user,
        )
        data = {
            'transfer_date': date.today().isoformat(),
            'remarks': 'Split transfer',
            'source_allocations': [{'customer_id': self.source_customer.id, 'amount': '10000.00'}],
            'target_allocations': [{'customer_id': self.target_customer.id, 'amount': '10000.00'}],
        }
        response = self.client.post('/api/payments/fund-transfers/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.target_customer.get_credit_balance(), Decimal('10000.00'))
        self.assertEqual(self.source_customer.get_credit_balance(), Decimal('0.00'))

    def test_fund_transfer_insufficient_credit(self):
        """Create transfer fails when source has insufficient credit."""
        # Source has 20k; try to transfer 25k
        data = {
            'transfer_date': date.today().isoformat(),
            'remarks': 'Over transfer',
            'source_customer_id': self.source_customer.id,
            'target_customer_id': self.target_customer.id,
            'amount': '25000.00',
        }
        response = self.client.post('/api/payments/fund-transfers/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('insufficient', response.data['error'].lower())

    def test_fund_transfer_retrieve(self):
        """Retrieve single fund transfer by id."""
        from apps.payment.fund_transfer_service import create_fund_transfer
        transfer = create_fund_transfer(
            source_allocations=[{'customer_id': self.source_customer.id, 'amount': Decimal('5000.00')}],
            target_allocations=[{'customer_id': self.target_customer.id, 'amount': Decimal('5000.00')}],
            transfer_date=date.today(),
            remarks='Retrieve test',
            created_by=self.user,
        )
        response = self.client.get(f'/api/payments/fund-transfers/{transfer.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], transfer.id)
        self.assertEqual(len(response.data['lines']), 2)

    def test_fund_transfer_list_filter_by_customer(self):
        """List fund transfers filtered by customer name or company name."""
        from apps.payment.fund_transfer_service import create_fund_transfer
        create_fund_transfer(
            source_allocations=[{'customer_id': self.source_customer.id, 'amount': Decimal('5000.00')}],
            target_allocations=[{'customer_id': self.target_customer.id, 'amount': Decimal('5000.00')}],
            transfer_date=date.today(),
            remarks='Filter test',
            created_by=self.user,
        )
        response = self.client.get('/api/payments/fund-transfers/?customer_search=Tiger')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        response2 = self.client.get('/api/payments/fund-transfers/?customer_search=Gazi')
        self.assertEqual(len(response2.data), 1)

    def test_fund_transfer_requires_auth(self):
        """Fund transfer endpoints require authentication."""
        self.client.force_authenticate(user=None)
        r1 = self.client.get('/api/payments/fund-transfers/')
        r2 = self.client.post('/api/payments/fund-transfers/', {
            'transfer_date': date.today().isoformat(),
            'source_customer_id': self.source_customer.id,
            'target_customer_id': self.target_customer.id,
            'amount': '100',
        }, format='json')
        self.assertIn(r1.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))
        self.assertIn(r2.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_fund_transfer_create_with_source_payment_master_id(self):
        """Create transfer with source_payment_master_id for traceability."""
        from apps.bills.models import CustomerEntitlementMaster, InvoiceMaster
        from apps.payment.models import PaymentMaster, PaymentDetails

        # Create entitlement and invoice for source customer
        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.source_customer,
            bill_number='BL-TEST-1',
            activation_date=date.today(),
            total_bill=Decimal('50000'),
        )
        invoice = InvoiceMaster.objects.create(
            customer_entitlement_master_id=entitlement,
            customer_master_id=self.source_customer,
            issue_date=date.today(),
            total_bill_amount=Decimal('50000'),
            total_paid_amount=Decimal('50000'),
            total_balance_due=Decimal('0'),
            status='paid',
            bill_number='BL-TEST-1',
            invoice_number='INV-TEST-1',
        )
        # Create payment that caused overpayment (e.g. paid 70k on 50k invoice)
        pm = PaymentMaster.objects.create(
            payment_date=date.today(),
            payment_method='Bank',
            customer_entitlement_master_id=entitlement,
            invoice_master_id=invoice,
            status='completed',
            created_by=self.user,
        )
        PaymentDetails.objects.create(
            payment_master_id=pm,
            pay_amount=Decimal('70000'),
            status='completed',
            created_by=self.user,
        )
        # Overpayment credit (20k) - link to this payment
        CustomerCreditTransaction.objects.filter(customer_id=self.source_customer).delete()
        CustomerCreditTransaction.objects.create(
            customer_id=self.source_customer,
            amount=Decimal('20000'),
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
            reference_id=pm.id,
            invoice_id=invoice,
            entry_date=date.today(),
            remarks='Overpayment',
            created_by=self.user,
        )

        data = {
            'transfer_date': date.today().isoformat(),
            'remarks': 'Transfer from payment overpayment',
            'source_customer_id': self.source_customer.id,
            'target_customer_id': self.target_customer.id,
            'amount': '20000.00',
            'source_payment_master_id': pm.id,
        }
        response = self.client.post('/api/payments/fund-transfers/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['source_payment_master_id'], pm.id)
        self.assertIsNotNone(response.data['source_payment'])
        self.assertEqual(response.data['source_payment']['payment_master_id'], pm.id)
        self.assertEqual(response.data['source_payment']['invoice_number'], invoice.invoice_number)

    def test_credit_sources_endpoint(self):
        """GET /api/payments/fund-transfers/credit-sources/?customer_id=X returns payments with credit."""
        from apps.bills.models import CustomerEntitlementMaster, InvoiceMaster
        from apps.payment.models import PaymentMaster, PaymentDetails

        entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.source_customer,
            bill_number='BL-TEST-2',
            activation_date=date.today(),
            total_bill=Decimal('30000'),
        )
        invoice = InvoiceMaster.objects.create(
            customer_entitlement_master_id=entitlement,
            customer_master_id=self.source_customer,
            issue_date=date.today(),
            total_bill_amount=Decimal('30000'),
            total_paid_amount=Decimal('30000'),
            total_balance_due=Decimal('0'),
            status='paid',
            bill_number='BL-TEST-2',
            invoice_number='INV-TEST-2',
        )
        pm = PaymentMaster.objects.create(
            payment_date=date.today(),
            payment_method='Cash',
            customer_entitlement_master_id=entitlement,
            invoice_master_id=invoice,
            status='completed',
            created_by=self.user,
        )
        CustomerCreditTransaction.objects.filter(customer_id=self.source_customer).delete()
        CustomerCreditTransaction.objects.create(
            customer_id=self.source_customer,
            amount=Decimal('5000'),
            transaction_type=CustomerCreditTransaction.TRANSACTION_TYPE_OVERPAYMENT,
            reference_type=CustomerCreditTransaction.REFERENCE_TYPE_PAYMENT,
            reference_id=pm.id,
            invoice_id=invoice,
            entry_date=date.today(),
            remarks='Overpayment',
            created_by=self.user,
        )

        response = self.client.get(
            f'/api/payments/fund-transfers/credit-sources/?customer_id={self.source_customer.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['customer_id'], self.source_customer.id)
        self.assertGreater(len(response.data['payments_with_credit']), 0)
        pw = response.data['payments_with_credit'][0]
        self.assertEqual(pw['payment_master_id'], pm.id)
        self.assertEqual(pw['invoice_number'], invoice.invoice_number)
        self.assertEqual(float(pw['credit_amount']), 5000.0)

    def test_credit_sources_requires_customer_id(self):
        """credit-sources returns 400 when customer_id missing."""
        response = self.client.get('/api/payments/fund-transfers/credit-sources/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
