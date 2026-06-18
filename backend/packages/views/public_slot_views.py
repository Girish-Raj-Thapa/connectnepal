import calendar
from datetime import date, timedelta

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from packages.models import Package, PackageSlot
from packages.serializers.slot_serializers import PackageSlotPublicSerializer


class PackageSlotListView(APIView):
    """
    GET /api/packages/{id}/slots/

    Returns upcoming active slots for a package.

    Query params:
        ?date_from=YYYY-MM-DD  — earliest start_date (default: today)
        ?date_to=YYYY-MM-DD    — latest start_date (optional)
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        package = get_object_or_404(Package.objects.public_ready(), pk=pk)

        today = date.today()
        date_from_str = request.query_params.get("date_from")
        date_to_str = request.query_params.get("date_to")

        try:
            date_from = date.fromisoformat(date_from_str) if date_from_str else today
        except ValueError:
            date_from = today

        qs = (
            PackageSlot.objects
            .filter(package=package, is_active=True, start_date__gte=date_from)
            .order_by("start_date")
        )

        if date_to_str:
            try:
                date_to = date.fromisoformat(date_to_str)
                qs = qs.filter(start_date__lte=date_to)
            except ValueError:
                pass

        return Response(PackageSlotPublicSerializer(qs, many=True).data)


class PackageAvailabilityView(APIView):
    """
    GET /api/packages/{id}/availability/

    Returns a calendar-style availability summary for a given month.

    Query params:
        ?year=YYYY   (default: current year)
        ?month=MM    (default: current month)

    Response shape:
        {
            "year": 2026,
            "month": 3,
            "days": {
                "2026-03-10": {"available": true,  "slot_count": 2},
                "2026-03-11": {"available": false, "slot_count": 0},
                ...
            }
        }
    """
    permission_classes = [AllowAny]

    def get(self, request, pk):
        package = get_object_or_404(Package.objects.public_ready(), pk=pk)

        today = date.today()
        try:
            year = int(request.query_params.get("year", today.year))
            month = int(request.query_params.get("month", today.month))
            if not (1 <= month <= 12):
                raise ValueError
        except (TypeError, ValueError):
            year, month = today.year, today.month

        _, last_day = calendar.monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, last_day)

        slots = PackageSlot.objects.filter(
            package=package,
            is_active=True,
            start_date__gte=month_start,
            start_date__lte=month_end,
        )

        # Build slot_count per date
        slot_map: dict = {}
        for slot in slots:
            key = slot.start_date.isoformat()
            slot_map[key] = slot_map.get(key, 0) + 1

        days = {}
        current = month_start
        while current <= month_end:
            key = current.isoformat()
            count = slot_map.get(key, 0)
            days[key] = {"available": count > 0, "slot_count": count}
            current += timedelta(days=1)

        return Response({"year": year, "month": month, "days": days})
