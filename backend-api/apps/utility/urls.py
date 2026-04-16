from django.urls import path
from .views import (
    UtilityInformationMasterListView,
    UtilityInformationMasterDetailView,
    UtilityDetailsListView,
    UtilityDetailsDetailView,
)

urlpatterns = [
    path('utility-info/', UtilityInformationMasterListView.as_view(), name='utility-info-list'),
    path('utility-info/<int:pk>/', UtilityInformationMasterDetailView.as_view(), name='utility-info-detail'),
    path('utility-details/', UtilityDetailsListView.as_view(), name='utility-details-list'),
    path('utility-details/<int:pk>/', UtilityDetailsDetailView.as_view(), name='utility-details-detail'),
]

