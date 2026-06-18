from django.urls import path

from .views import (
    EventIngestionView,
    ForYouPackagesView,
    ForYouListingsView,
    InteractionIngestionView,
    SimilarListingsView,
)

app_name = 'recommendations'

urlpatterns = [
    # Similar listings for a specific listing
    path('listings/<int:pk>/similar/', SimilarListingsView.as_view(), name='similar-listings'),

    # Personalized "for you" recommendations
    path('for-you/', ForYouListingsView.as_view(), name='for-you'),

    # Personalized package recommendations
    path('packages/for-you/', ForYouPackagesView.as_view(), name='for-you-packages'),

    # Recommendation event ingestion
    path('events/', EventIngestionView.as_view(), name='events'),

    # General listing interaction ingestion (Broader browsing phase)
    path('interactions/', InteractionIngestionView.as_view(), name='interactions'),
]
