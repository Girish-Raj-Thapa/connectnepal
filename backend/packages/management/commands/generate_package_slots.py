from django.core.management.base import BaseCommand, CommandError

from packages.models import Package
from packages.services.package_schedule_service import (
    generate_slots_for_package,
    generate_slots_for_all_packages,
)


class Command(BaseCommand):
    help = (
        "Idempotently generate PackageSlots from PackageSchedule templates. "
        "Safe to run multiple times — existing slots are never overwritten."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--package",
            type=int,
            metavar="ID",
            help="Generate slots for a single package ID only (default: all packages)",
        )
        parser.add_argument(
            "--days",
            type=int,
            metavar="N",
            help="Override the advance_days horizon (default: each schedule's own advance_days)",
        )

    def handle(self, *args, **options):
        package_id = options.get("package")
        days_ahead = options.get("days")

        if package_id:
            try:
                package = Package.objects.get(pk=package_id)
            except Package.DoesNotExist:
                raise CommandError(f"Package {package_id} does not exist.")
            created = generate_slots_for_package(package, days_ahead=days_ahead)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Package {package_id} ({package.title}): created {created} slot(s)."
                )
            )
        else:
            created = generate_slots_for_all_packages(days_ahead=days_ahead)
            self.stdout.write(
                self.style.SUCCESS(f"All packages: created {created} slot(s) total.")
            )
