from rest_framework.permissions import BasePermission
from .models import Account

class IsTraveller(BasePermission):
    """
    Permission Class for Traveller
    """
    message = "Only traveller can access this resource"

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Account.Role.TRAVELLER
    

class IsHost(BasePermission):
    """
    Permission Class for Host
    """
    message = "Only hosts can access this resource"

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Account.Role.HOST
    

class IsAdmin(BasePermission):
    """
    Permission Class for Admin
    """
    message = "Only admin can access this resource"

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Account.Role.ADMIN