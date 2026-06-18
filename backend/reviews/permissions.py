from rest_framework.permissions import BasePermission


class IsReviewOwner(BasePermission):
    """
    Object-level permission.

    Passes only when the authenticated traveller owns the review.

    Stack after IsAuthenticated so unauthenticated requests fail earlier.
    """
    message = "You do not own this review."

    def has_object_permission(self, request, view, obj):
        return obj.traveller == request.user


class IsReviewTargetOwner(BasePermission):
    """
    Object-level permission for hosts.

    Passes only when the requesting host owns the listing or package that was reviewed.

    Stack after IsAuthenticated and IsHost.
    """
    message = "You do not own the listing or package for this review."

    def has_object_permission(self, request, view, obj):
        host = request.user.host_detail   # HostDetail instance
        if obj.listing:
            return obj.listing.host == host
        return obj.package.host == host
    