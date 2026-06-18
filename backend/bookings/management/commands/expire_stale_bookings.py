from django.core.management.base import BaseCommand
from bookings.services.booking_service import expire_stale_bookings


class Command(BaseCommand):
    help = "Expire pending_payment bookings whose payment window has passed."

    def handle(self, *args, **options):
        count = expire_stale_bookings()
        self.stdout.write(
            self.style.SUCCESS(f"Expired {count} stale booking(s).")
        )
