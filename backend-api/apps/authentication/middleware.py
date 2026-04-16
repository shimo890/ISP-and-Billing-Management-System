import time
from django.utils.deprecation import MiddlewareMixin
from django.utils.timezone import now
from .models import UserActivityLog
from django.conf import settings


class ActivityLogMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_time = time.time()

    def process_response(self, request, response):
        if getattr(settings, 'ACTIVITY_LOG_ENABLED', True):
            try:
                user = getattr(request, 'user', None)
                if user and user.is_authenticated:
                    duration_ms = None
                    if hasattr(request, '_start_time'):
                        duration_ms = round((time.time() - request._start_time) * 1000, 2)
                    UserActivityLog.objects.create(
                        user=user,
                        action=self._infer_action(request.method),
                        resource=self._infer_resource(request.path),
                        details={
                            'path': request.path,
                            'method': request.method,
                        },
                        ip_address=self._get_ip(request),
                        user_agent=request.META.get('HTTP_USER_AGENT', ''),
                        status_code=response.status_code,
                        response_time=duration_ms,
                    )
            except Exception:
                pass
        return response

    def _infer_action(self, method):
        return {
            'GET': 'read',
            'POST': 'create',
            'PUT': 'update',
            'PATCH': 'update',
            'DELETE': 'delete',
        }.get(method, 'read')

    def _infer_resource(self, path):
        parts = [p for p in path.split('/') if p]
        return parts[1] if len(parts) > 1 else ''

    def _get_ip(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            return xff.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


