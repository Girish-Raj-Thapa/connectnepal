from rest_framework.permissions import BasePermission

from accounts.models import HostDetail

class IsBookingOwner(BasePermission):
    """
    Traveller who created the booking.
    """
    message = "You do not own this booking."

    def has_object_permission(self, request, view, obj):
        # obj is a Booking instance
        return obj.traveller_id == request.user.id


class IsBookingItemHostOwner(BasePermission):
    """
    Host who owns the listing or package referenced by this BookingItem.

    HostDetail.user is primary_key=True, so host_detail.pk == account.pk.
    """
    message = "This booking item does not belong to your listing or package."

    def has_object_permission(self, request, view, obj):
        try:
            host_detail = request.user.host_detail
        except HostDetail.DoesNotExist:
            return False

        if obj.listing_id:
            return obj.listing and obj.listing.host_id == host_detail.pk

        if obj.package_id:
            return obj.package and obj.package.host_id == host_detail.pk

        return False
