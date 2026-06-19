"""
URL configuration for connectnepal project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from connectnepal.feature_flags import chatbot_enabled, recommendations_enabled
from utils.views import health_live, health_ready


urlpatterns = [
    # Health checks (no authentication required)
    path('health/live', health_live, name='health-live'),
    path('health/ready', health_ready, name='health-ready'),

    path('admin/', admin.site.urls),

    # API Documentation (drf-spectacular)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Accounts App
    path('api/accounts/', include('accounts.urls', namespace="accounts")),

    # Listing App
    path('api/listings/', include('listings.urls', namespace='listings')),

    # Trip Planner App
    path('api/trip-planner/', include('trip_planner.urls', namespace='trip_planner')),

    # Booking App
    # traveller booking
    path("api/bookings/", include("bookings.urls.traveller_urls", namespace="bookings")),

    # host booking
    path("api/host/bookings/", include("bookings.urls.host_urls", namespace="bookings_host")),

    # admin booking oversight
    path("api/admin/bookings/", include("bookings.urls.admin_urls", namespace="bookings_admin")),


    # Packages App
    path("api/", include("packages.urls", namespace="packages")),

    # Payment App
    path("api/payments/", include("payments.urls", namespace="payments")),

    
    # Reviews App - traveller
    path('api/reviews/', include('reviews.urls.traveller_urls', namespace='reviews')),

    # Reviews App — host
    path('api/host/reviews/', include('reviews.urls.host_urls', namespace='reviews_host')),

    # Reviews App — admin moderation
    path('api/admin/', include('reviews.urls.admin_urls', namespace='reviews_admin')),

    # Analytics App
    path('api/analytics/', include('analytics.urls', namespace='analytics')),

    # Complaints App — traveller
    path('api/traveller/complaints/', include('complaints.urls.traveller_urls', namespace='complaints_traveller')),

    # Complaints App — host
    path('api/host/complaints/', include('complaints.urls.host_urls', namespace='complaints_host')),

    # Complaints App — admin
    path('api/admin/complaints/', include('complaints.urls.admin_urls', namespace='complaints_admin')),

    # Notifications App
    path("api/notifications/", include("notifications.urls", namespace="notifications")),

    # Pages App
    path("api/pages/", include("pages.urls", namespace="pages")),
]

if recommendations_enabled():
    urlpatterns.append(
        path('api/recommendations/', include('recommendations.urls', namespace='recommendations'))
    )

if chatbot_enabled():
    urlpatterns.append(
        path('api/chatbot/', include('chatbot.urls', namespace='chatbot'))
    )

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
