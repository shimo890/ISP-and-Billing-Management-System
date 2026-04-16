"""
Custom DRF exception handlers.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Catch database setup errors and return helpful JSON instead of 500 HTML."""
    response = exception_handler(exc, context)
    if response is not None:
        return response

    # Check for database errors (table doesn't exist, etc.)
    err_str = str(exc).lower()
    is_db_error = (
        'does not exist' in err_str or
        ('relation' in err_str and 'exist' in err_str) or
        'programmingerror' in type(exc).__name__.lower() or
        'operationalerror' in type(exc).__name__.lower()
    )

    request = context.get('request')
    path = (request.path or '') if request else ''
    is_schedule_api = '/invoice-email-schedules' in path

    if is_db_error and is_schedule_api:
        return Response(
            {
                'error': 'Database setup required',
                'detail': 'The invoice email schedules table does not exist yet. Please run migrations.',
                'fix': 'Run: python manage.py migrate',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )

    return None  # Let default handling apply
