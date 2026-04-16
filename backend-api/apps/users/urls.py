from django.urls import path
from .views import MeView, UserListCreateView, UserDetailView, FieldStaffUsersView, ChangePasswordView

urlpatterns = [
    path('me/', MeView.as_view(), name='users-me'),
    path('change-password/', ChangePasswordView.as_view(), name='users-change-password'),
    path('field-staff/', FieldStaffUsersView.as_view(), name='field-staff-users'),
    path('', UserListCreateView.as_view(), name='users-list-create'),
    path('<int:pk>/', UserDetailView.as_view(), name='users-detail'),
]


