from rest_framework.permissions import BasePermission


class IsPackageOwner(BasePermission):
    """
    Object-level permission that passes only when the requesting host owns
    the ``Package`` instance.

    Stack after ``IsAuthenticated`` and ``IsHost`` so that unauthenticated
    requests and non-host roles are rejected before this check runs.
    """

    message = "You do not own this package."

    def has_object_permission(self, request, _view, obj):
        return obj.host.user == request.user
