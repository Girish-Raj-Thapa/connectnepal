from rest_framework.permissions import BasePermission

class IsComplaintFiler(BasePermission):
    """
    Object-level: passes when request.user == complaint.filed_by.

    Used on complainant detail views (TravellerComplaintDetailView, HostComplaintDetailView) to prevent accessing other users' filed complaints.
    """
    message = "You do not own this complaint."

    def has_object_permission(self, request, view, obj):
        return obj.filed_by_id == request.user.id
    