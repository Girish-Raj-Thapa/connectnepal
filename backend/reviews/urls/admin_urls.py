from django.urls import path
from reviews.views import (
    AdminReviewReportListView,
    AdminReviewModerateView,
    AdminReplyModerateView,
)

app_name = "reviews_admin"

urlpatterns = [
    path('review-reports/', AdminReviewReportListView.as_view(), name='admin-review-reports'),
    path('reviews/<int:pk>/moderate/', AdminReviewModerateView.as_view(), name='admin-review-moderate'),
    path('reviews/<int:pk>/reply/moderate/', AdminReplyModerateView.as_view(), name='admin-reply-moderate'),
]
