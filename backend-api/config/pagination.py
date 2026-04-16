"""
Pagination classes for optimized API loading.
Supports limit/offset for dynamic pagination with smaller default payloads.
"""
from rest_framework.pagination import LimitOffsetPagination, PageNumberPagination


class StandardLimitOffsetPagination(LimitOffsetPagination):
    """
    Offset-based pagination. Use ?limit= and ?offset= query params.
    - Smaller default limit for faster initial load
    - Client can request up to max_limit items per page
    Response: { count, next, previous, results }
    """
    default_limit = 25
    limit_query_param = 'limit'
    offset_query_param = 'offset'
    max_limit = 100


class StandardPageNumberPagination(PageNumberPagination):
    """
    Page-based pagination. Use ?page= and ?page_size= query params.
    - For frontends that prefer page numbers over offset
    Response: { count, next, previous, results }
    """
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100
