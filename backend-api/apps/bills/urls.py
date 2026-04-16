from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InvoiceMasterViewSet,
    InvoiceDetailsViewSet,
    CustomerEntitlementMasterViewSet,
    CustomerEntitlementDetailsViewSet,
    InvoiceEmailScheduleViewSet,
    DashboardAnalyticsView,
    KAMGrowthChurnReportView,
    AddEntitlementDetailView,
    CustomerLedgerReportView,
    AllCustomersLedgerSummaryView,
)

router = DefaultRouter()
router.register(r'invoices', InvoiceMasterViewSet, basename='invoice')
router.register(r'invoice-details', InvoiceDetailsViewSet, basename='invoice-detail')
router.register(r'invoice-email-schedules', InvoiceEmailScheduleViewSet, basename='invoice-email-schedule')
router.register(r'entitlements', CustomerEntitlementMasterViewSet, basename='entitlement')
router.register(r'entitlement-details', CustomerEntitlementDetailsViewSet, basename='entitlement-detail')

urlpatterns = [
    path('', include(router.urls)),
    path('analytics/dashboard/', DashboardAnalyticsView.as_view(), name='dashboard-analytics'),
    path('analytics/kam/growth-churn/', KAMGrowthChurnReportView.as_view(), name='kam-growth-churn-report'),
    path('add/entitlements/details/', AddEntitlementDetailView.as_view(), name='add-entitlement-detail'),
    path('ledger/customer/<int:customer_id>/', CustomerLedgerReportView.as_view(), name='ledger-customer'),
    path('ledger/summary/', AllCustomersLedgerSummaryView.as_view(), name='ledger-summary'),
]

