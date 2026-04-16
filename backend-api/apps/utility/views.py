"""
REST API Views for Utility App - GET only
"""
from rest_framework import viewsets, generics, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import UtilityInformationMaster, UtilityDetails
from .serializers import (
    UtilityInformationMasterSerializer,
    UtilityDetailsSerializer,
)
from apps.authentication.permissions import RequirePermissions


class UtilityInformationMasterListView(generics.ListAPIView):
    """GET only - List all Utility Information Masters"""
    queryset = UtilityInformationMaster.objects.filter(is_active=True).prefetch_related('details')
    serializer_class = UtilityInformationMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['utilities:read']
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['is_active']
    ordering_fields = ['created_at']


class UtilityInformationMasterDetailView(generics.RetrieveAPIView):
    """GET only - Retrieve single Utility Information Master"""
    queryset = UtilityInformationMaster.objects.prefetch_related('details')
    serializer_class = UtilityInformationMasterSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['utilities:read']


class UtilityDetailsListView(generics.ListAPIView):
    """GET only - List all Utility Details"""
    queryset = UtilityDetails.objects.select_related('utility_master_id').filter(is_active=True)
    serializer_class = UtilityDetailsSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['utilities:read']
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['utility_master_id', 'type', 'is_active']
    search_fields = ['name', 'number']
    ordering_fields = ['type', 'name', 'created_at']


class UtilityDetailsDetailView(generics.RetrieveAPIView):
    """GET only - Retrieve single Utility Detail"""
    queryset = UtilityDetails.objects.select_related('utility_master_id')
    serializer_class = UtilityDetailsSerializer
    permission_classes = [permissions.IsAuthenticated, RequirePermissions]
    required_permissions = ['utilities:read']

