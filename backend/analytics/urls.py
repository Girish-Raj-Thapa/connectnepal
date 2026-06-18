from django.urls import path

from analytics.views import AdminOverviewView, HostOverviewView, TravellerOverviewView

app_name = 'analytics'

urlpatterns = [
    path('traveller/overview/', TravellerOverviewView.as_view(), name='traveller-overview'),
    path('host/overview/', HostOverviewView.as_view(), name='host-overview'),
    path('admin/overview/', AdminOverviewView.as_view(), name='admin-overview'),
]
