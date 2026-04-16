
from django.contrib import admin
from django.urls import path, include
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions
from django.urls import re_path

# Customize admin site
admin.site.site_header = "ISP Billing & Customer Management — Admin"
admin.site.site_title = "ISP Billing Admin"
admin.site.index_title = "ISP Billing & Customer Management"


schema_view = get_schema_view(
    openapi.Info(
        title="ISP Billing & Customer Management API",
        default_version='v1',
        description="""
        # ISP Billing & Customer Management API
        
        ## Overview
        Bandwidth and Home/SOHO subscriber billing, invoicing, and payments:
        - **Bandwidth customers**
        - **Home / SOHO customers**
        
        ## Authentication
        Use JWT Bearer token authentication. Click the 'Authorize' button to add your Bearer token.
        
        """,
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@example.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    # API docs
    path('api/docs/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('api/redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('api/swagger.json', schema_view.without_ui(cache_timeout=0), name='schema-json'),

    # App routes
    path('api/auth/', include('apps.authentication.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/customers/', include('apps.customers.urls')),
    path('api/bills/', include('apps.bills.urls')),
    path('api/payments/', include('apps.payment.urls')),
    path('api/packages/', include('apps.package.urls')),
    path('api/utility/', include('apps.utility.urls')),
]
