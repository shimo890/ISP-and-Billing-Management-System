"""
REST API Views for Package App
"""
from rest_framework import viewsets, generics, permissions, filters, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import PackageMaster, PackagePricing
from .serializers import PackageMasterSerializer, PackagePricingSerializer
from apps.authentication.permissions import RequirePermissions


class PackageMasterViewSet(viewsets.ModelViewSet):
    """CRUD for Package Master"""
    queryset = PackageMaster.objects.prefetch_related('pricings').filter(is_active=True)
    serializer_class = PackageMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['packages:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['package_type', 'is_active']
    search_fields = ['package_name']
    ordering_fields = ['package_name', 'created_at']
    
    def get_queryset(self):
        # Allow viewing inactive packages for admin
        if self.request.user.is_superuser:
            return PackageMaster.objects.prefetch_related('pricings').all()
        return self.queryset
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.required_permissions = ['packages:write']
        return PackageMasterSerializer
    
    @action(detail=True, methods=['get'])
    def pricings(self, request, pk=None):
        """Get all pricings for a package"""
        package = self.get_object()
        pricings = package.pricings.all()
        serializer = PackagePricingSerializer(pricings, many=True)
        return Response(serializer.data)


class PackagePricingViewSet(viewsets.ModelViewSet):
    """CRUD for Package Pricing"""
    queryset = PackagePricing.objects.select_related('package_master_id').filter(is_active=True)
    serializer_class = PackagePricingSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['package_pricing:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['package_master_id', 'is_active']
    ordering_fields = ['val_start_at', 'val_end_at', 'created_at']
    
    def get_queryset(self):
        if self.request.user.is_superuser:
            return PackagePricing.objects.select_related('package_master_id').all()
        return self.queryset
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            self.required_permissions = ['package_pricing:write']
        return PackagePricingSerializer

