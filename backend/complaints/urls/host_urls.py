from django.urls import path 
from complaints.views import (
    HostComplaintListCreateView,
    HostComplaintDetailView,
    HostEvidenceListCreateView,
    HostReceivedComplaintListView,
    HostReceivedComplaintDetailView,
    HostRespondView,
    HostRespondentEvidenceListCreateView,
)

app_name = 'complaints_host'

urlpatterns = [
    # Filed by
    path('', HostComplaintListCreateView.as_view(), name='list-create'),
    path('<int:pk>/', HostComplaintDetailView.as_view(), name='detail'),
    path('<int:complaint_id>/evidence/', HostEvidenceListCreateView.as_view(), name='evidence'),

    # Filed against
    path('received/', HostReceivedComplaintListView.as_view(), name='received-list'),
    path('received/<int:pk>/', HostReceivedComplaintDetailView.as_view(), name='received-detail'),
    path('received/<int:pk>/respond/', HostRespondView.as_view(), name='received-respond'),
    path('received/<int:complaint_id>/evidence/', HostRespondentEvidenceListCreateView.as_view(), name='received-evidence'),
]
