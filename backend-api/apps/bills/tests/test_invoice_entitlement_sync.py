from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.bills.models import (
    CustomerEntitlementDetails,
    CustomerEntitlementMaster,
    InvoiceDetails,
    InvoiceMaster,
)
from apps.bills.serializers import InvoiceDetailsSerializer
from apps.customers.models import CustomerMaster, KAMMaster


User = get_user_model()


class InvoiceEntitlementSyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="invoice-sync-user",
            email="invoice-sync@example.com",
            password="password123",
        )
        self.kam = KAMMaster.objects.create(kam_name="KAM Sync")
        self.customer = CustomerMaster.objects.create(
            customer_name="Sync Customer",
            customer_type=CustomerMaster.CUSTOMER_TYPE_BW,
            kam_id=self.kam,
            created_by=self.user,
        )
        self.primary_entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.customer,
            activation_date=date(2026, 3, 1),
            created_by=self.user,
        )
        self.secondary_entitlement = CustomerEntitlementMaster.objects.create(
            customer_master_id=self.customer,
            activation_date=date(2026, 3, 1),
            created_by=self.user,
        )
        self.primary_detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=self.primary_entitlement,
            type=CustomerMaster.CUSTOMER_TYPE_BW,
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
            mbps=Decimal("10.00"),
            unit_price=Decimal("100.00"),
            remarks="Original",
            created_by=self.user,
        )
        self.secondary_detail = CustomerEntitlementDetails.objects.create(
            cust_entitlement_id=self.secondary_entitlement,
            type=CustomerMaster.CUSTOMER_TYPE_BW,
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 31),
            mbps=Decimal("20.00"),
            unit_price=Decimal("200.00"),
            remarks="Secondary",
            created_by=self.user,
        )
        self.invoice = InvoiceMaster.objects.create(
            customer_entitlement_master_id=self.primary_entitlement,
            customer_master_id=self.customer,
            issue_date=date(2026, 3, 31),
            additional_entitlements=[{"id": self.secondary_entitlement.id}],
            created_by=self.user,
        )
        self.invoice_detail = InvoiceDetails.objects.create(
            invoice_master_id=self.invoice,
            entitlement_details_id=self.primary_detail,
            type=CustomerMaster.CUSTOMER_TYPE_BW,
            start_date=self.primary_detail.start_date,
            end_date=self.primary_detail.end_date,
            mbps=self.primary_detail.mbps,
            unit_price=self.primary_detail.unit_price,
            remarks=self.primary_detail.remarks,
            sub_total=Decimal("1000.00"),
            vat_rate=Decimal("0.00"),
            sub_discount_rate=Decimal("0.00"),
        )
        self.request_factory = APIRequestFactory()

    def _request_with_user(self):
        request = self.request_factory.patch("/api/bills/invoice-details/")
        request.user = self.user
        return request

    def test_invoice_detail_update_syncs_linked_entitlement_detail(self):
        serializer = InvoiceDetailsSerializer(
            instance=self.invoice_detail,
            data={
                "mbps": "12.50",
                "unit_price": "110.00",
                "start_date": "2026-03-05",
                "end_date": "2026-03-30",
                "remarks": "Synced from invoice edit",
            },
            partial=True,
            context={"request": self._request_with_user()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        self.primary_detail.refresh_from_db()
        self.assertEqual(self.primary_detail.mbps, Decimal("12.50"))
        self.assertEqual(self.primary_detail.unit_price, Decimal("110.00"))
        self.assertEqual(self.primary_detail.start_date, date(2026, 3, 5))
        self.assertEqual(self.primary_detail.end_date, date(2026, 3, 30))
        self.assertEqual(self.primary_detail.remarks, "Synced from invoice edit")
        self.assertEqual(self.primary_detail.updated_by_id, self.user.id)

    def test_invoice_detail_rejects_mismatched_entitlement_mapping(self):
        invoice_without_secondary = InvoiceMaster.objects.create(
            customer_entitlement_master_id=self.primary_entitlement,
            customer_master_id=self.customer,
            issue_date=date(2026, 3, 31),
            additional_entitlements=[],
            created_by=self.user,
        )
        detail = InvoiceDetails.objects.create(
            invoice_master_id=invoice_without_secondary,
            entitlement_details_id=self.primary_detail,
            type=CustomerMaster.CUSTOMER_TYPE_BW,
            start_date=self.primary_detail.start_date,
            end_date=self.primary_detail.end_date,
            mbps=self.primary_detail.mbps,
            unit_price=self.primary_detail.unit_price,
            sub_total=Decimal("1000.00"),
            vat_rate=Decimal("0.00"),
            sub_discount_rate=Decimal("0.00"),
        )

        serializer = InvoiceDetailsSerializer(
            instance=detail,
            data={"entitlement_details_id": self.secondary_detail.id},
            partial=True,
            context={"request": self._request_with_user()},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("entitlement_details_id", serializer.errors)
