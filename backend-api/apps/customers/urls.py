from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    KAMMasterListView,
    KAMMasterDetailView,
    KAMMasterViewSet,
    CustomerMasterViewSet,
)


router = DefaultRouter()
router.register(r'kam-management', KAMMasterViewSet, basename='kam-management')
router.register(r'', CustomerMasterViewSet, basename='customer')

urlpatterns = [
    # KAM Master endpoints (GET only)
    path('kam/', KAMMasterListView.as_view(), name='kam-list'),
    path('kam/<int:pk>/', KAMMasterDetailView.as_view(), name='kam-detail'),
    
    # Customer endpoints (via router)
    path('', include(router.urls)),
]
