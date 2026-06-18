from rest_framework.pagination import PageNumberPagination


class EightPerPagePagination(PageNumberPagination):
    """General-purpose pagination (default 8 per page). Used for booking and admin lists."""
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 50


# Alias kept for backward compatibility
BookingListPagination = EightPerPagePagination


class ReviewPagination(PageNumberPagination):
    """
    Pagination for public review list endpoints.

    Supports ?page_size=N so frontends can implement "load more" patterns
    (e.g. ?page=1&page_size=3 then ?page=2&page_size=3).
    Defaults to 8 per page; maximum allowed is 50.
    """
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 50
