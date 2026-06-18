from django.urls import path
from complaints.views import (
    TravellerComplaintListCreateView,
    TravellerComplaintDetailView,
    TravellerEvidenceListCreateView,
    TravellerReceivedComplaintListView,
    TravellerReceivedComplaintDetailView,
    TravellerRespondView,
    TravellerRespondentEvidenceListCreateView,
)

app_name = 'complaints_traveller'

urlpatterns = [
    # Filed by
    path('', TravellerComplaintListCreateView.as_view(), name='list-create'),
    path('<int:pk>/', TravellerComplaintDetailView.as_view(), name='detail'),
    path('<int:complaint_id>/evidence/', TravellerEvidenceListCreateView.as_view(), name='evidence'),

    # Filed against
    path('received/', TravellerReceivedComplaintListView.as_view(), name='received-list'),
    path('received/<int:pk>/', TravellerReceivedComplaintDetailView.as_view(), name='received-detail'),
    path('received/<int:pk>/respond/', TravellerRespondView.as_view(), name='received-respond'),
    path('received/<int:complaint_id>/evidence/', TravellerRespondentEvidenceListCreateView.as_view(), name='received-evidence'),
]
