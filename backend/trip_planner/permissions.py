from rest_framework.permissions import BasePermission

class IsTripPlanOwner(BasePermission):
    """
    Only the trip plan's owner can access it.
    """

    message = "You can only access your own trip planners."

    def has_object_permission(self, request, view, obj):
        return obj.traveller == request.user
    