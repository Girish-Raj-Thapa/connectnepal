from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from analytics.permissions import (
    IsAnalyticsAdmin,
    IsAnalyticsHost,
    IsAnalyticsTraveller,
)
from analytics.serializers import (
    AdminOverviewSerializer,
    HostOverviewSerializer,
    TravellerOverviewSerializer,
)
from analytics.services.cache_service import (
    get_cached_admin_overview,
    get_cached_host_overview,
    get_cached_traveller_overview,
)


class TravellerOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAnalyticsTraveller]
    serializer_class = TravellerOverviewSerializer

    @extend_schema(tags=['Analytics'], responses={200: TravellerOverviewSerializer})
    def get(self, request):
        payload = get_cached_traveller_overview(request.user)
        serializer = self.serializer_class(payload)
        return Response(serializer.data)


class HostOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAnalyticsHost]
    serializer_class = HostOverviewSerializer

    @extend_schema(tags=['Analytics'], responses={200: HostOverviewSerializer})
    def get(self, request):
        payload = get_cached_host_overview(request.user)
        serializer = self.serializer_class(payload)
        return Response(serializer.data)


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAnalyticsAdmin]
    serializer_class = AdminOverviewSerializer

    @extend_schema(tags=['Analytics'], responses={200: AdminOverviewSerializer})
    def get(self, request):
        payload = get_cached_admin_overview()
        serializer = self.serializer_class(payload)
        return Response(serializer.data)
    