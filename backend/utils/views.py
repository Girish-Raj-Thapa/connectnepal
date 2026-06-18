from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import connection
from django.db.utils import OperationalError


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health_live(request):
    """
    Liveness check — is the process running?
    Returns 200 if the Django process is up. Used by Docker health checks.
    """
    return Response({'status': 'ok'})


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health_ready(request):
    """
    Readiness check — can the app serve real requests?
    Verifies database connectivity. Returns 503 if DB is unreachable.
    Used by load balancers to determine if traffic should be sent to this instance.
    """
    try:
        connection.ensure_connection()
        db_status = 'ok'
    except OperationalError:
        db_status = 'unavailable'

    if db_status == 'ok':
        return Response({'status': 'ok', 'database': db_status})
    return Response({'status': 'error', 'database': db_status}, status=503)
