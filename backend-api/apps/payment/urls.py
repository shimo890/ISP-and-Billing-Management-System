from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PaymentMasterViewSet,
    PaymentDetailsViewSet,
)

router = DefaultRouter()
router.register(r'payment-details', PaymentDetailsViewSet, basename='payment-detail')
router.register(r'', PaymentMasterViewSet, basename='payment')

urlpatterns = [
    path('', include(router.urls)),
]

