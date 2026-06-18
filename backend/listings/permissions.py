from rest_framework.permissions import BasePermission
from accounts.models import Account
from listings.constants import UNVERIFIED_HOST_LISTING_LIMIT, UNVERIFIED_HOST_TRANSACTION_LIMIT  # noqa: F401


# PERMISSIONS
class IsListingOwner(BasePermission):
    """
    Object-level permission: only the listing's host can modify it.

    Used for: UPDATE, DELETE operations
    """
    message = "You can only modify your own listings."

    def has_object_permission(self, request, view, obj):
        # obj is the Listing instance
        # obj.host is HostDetail
        # obj.host.user is Account
        return obj.host.user == request.user
    

class CanCreateListing(BasePermission):
    """
    Permission to create new listings.

    Business Rules:
    - Verified hosts: unlimited listings
    - Unverified hosts: maximum 2 active, bookable listings
    """
    message = f"Unverified hosts can only have {UNVERIFIED_HOST_LISTING_LIMIT} active, bookable listings. \nPlease verify your account to create more."

    def has_permission(self, request, view):

        # authenticated check
        if not request.user.is_authenticated:
            return False
        
        # host role check
        if request.user.role != Account.Role.HOST:
            self.message = "Only hosts can create listings."
            return False
        
        # Must have completed host onboarding
        from accounts.models import HostDetail
        try:
            host_detail = request.user.host_detail
        except HostDetail.DoesNotExist:
            self.message = "Please complete your host profile first."
            return False
        
        # verified host has no limits
        if host_detail.is_verified:
            return True
        
        # check for unverified listings
        current_listing_count = host_detail.listings.filter(
            is_active=True,
            is_bookable=True
        ).count()

        if current_listing_count >= UNVERIFIED_HOST_LISTING_LIMIT:
            return False

        return True
    

class IsHostOrReadOnly(BasePermission):
    """
    - GET, HEAD, OPTIONS: Anyone (even unauthenticated)
    - POST, PUT, PATCH, DELETE: Only authenticated hosts

    Used for: Mixed endpoints where browsing is public but modifications require host role
    """
    def has_permission(self, request, view):
        # Safe methods (read-only) are always allowed
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True

        # Write methods require authenticated host
        return (
            request.user.is_authenticated and
            request.user.role == Account.Role.HOST
        )
    
