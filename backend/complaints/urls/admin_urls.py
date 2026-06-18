from django.urls import path 
from complaints.views import (
    AdminComplaintListView,
    AdminComplaintDetailView,
    AdminModerateView,
    AdminSeverityView,
    AdminOutcomeView,
    AdminEventListView,
)

app_name = 'complaints_admin'

urlpatterns = [
    path('', AdminComplaintListView.as_view(), name='list'),
    path('<int:pk>/', AdminComplaintDetailView.as_view(), name='detail'),
    path('<int:pk>/moderate/', AdminModerateView.as_view(), name='moderate'),
    path('<int:pk>/severity/', AdminSeverityView.as_view(), name='severity'),
    path('<int:pk>/record-outcome/', AdminOutcomeView.as_view(), name='record-outcome'),
    path('<int:complaint_id>/events/', AdminEventListView.as_view(), name='events'),
]
