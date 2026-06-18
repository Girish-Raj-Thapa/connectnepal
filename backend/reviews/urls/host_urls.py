from django.urls import path
from reviews.views import (
    HostReviewListView,
    HostReviewReplyView,
    ReviewReportView,
    HostReplyReportView,
)

app_name = "reviews"

urlpatterns = [
    path('', HostReviewListView.as_view(), name='host-review-list'),
    path('<int:pk>/reply/', HostReviewReplyView.as_view(), name='host-review-reply'),
    path('<int:pk>/report/', ReviewReportView.as_view(), name='review-report'),
    path('<int:pk>/reply/report/', HostReplyReportView.as_view(), name='host-reply-report'),
]
