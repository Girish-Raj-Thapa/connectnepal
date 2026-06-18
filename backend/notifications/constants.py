from django.db import models 

class NotificationType(models.TextChoices):
    """
    Each value maps to a specific business event.
    The owning domain app is documented here for clarity.
    """

    # Bookings domain
    BOOKING_CONFIRMED = "booking_confirmed", "Booking Confirmed"
    HOST_NEW_BOOKING = "host_new_booking", "New Booking Received"
    BOOKING_CANCELLED = "booking_cancelled", "Booking Cancelled"
    HOST_BOOKING_CANCELLED  = "host_booking_cancelled", "Booking Cancelled (Host)"
    BOOKING_EXPIRED = "booking_expired", "Booking Expired"
    BOOKING_COMPLETED = "booking_completed", "Booking Completed"

    # Reviews domain
    REVIEW_RECEIVED = "review_received", "New Review Received"
    REVIEW_REPLY_RECEIVED = "review_reply_received", "Host Reply on Your Review"

    # Later phases
    HOST_VERIFIED = "host_verified", "Host Verification Approved"
    HOST_VERIFICATION_REJECTED = "host_verification_rejected", "Host Verification Rejected"
    COMPLAINT_STATUS_CHANGED = "complaint_status_changed", "Complaint Status Updated"
    COMPLAINT_RECEIVED = "complaint_received", "New Complaint Filed"
    REVIEW_REPORTED = "review_reported", "Review Reported"
    REVIEW_MODERATED = "review_moderated", "Review Moderation Action"
    LISTING_ACTIVATED = "listing_activated", "Listing Activated"
    LISTING_DEACTIVATED = "listing_deactivated", "Listing Deactivated"
    PACKAGE_ACTIVATED = "package_activated", "Package Activated"
    PACKAGE_DEACTIVATED = "package_deactivated", "Package Deactivated"
    TRIP_PLAN_ITEM_REMOVED = "trip_plan_item_removed", "Trip Plan Item Removed"
    HOST_TRANSACTION_LIMIT_REACHED = "host_transaction_limit_reached", "Transaction Limit Reached"


class NotificationPriority(models.TextChoices):
    LOW = "low", "Low"
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    
