from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PackageMasterViewSet,
    PackagePricingViewSet,
)

router = DefaultRouter()
router.register(r'package-pricings', PackagePricingViewSet, basename='package-pricing')
router.register(r'', PackageMasterViewSet, basename='package')

urlpatterns = [
    path('', include(router.urls)),
]

