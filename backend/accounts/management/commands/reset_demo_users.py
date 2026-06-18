import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import HostDocument


SAFE_ENV_NAMES = {
    "local",
    "dev",
    "development",
    "staging",
    "test",
    "testing",
    "ci",
}


class Command(BaseCommand):
    help = (
        "Delete demo persona users by email. "
        "Use this when you want a clean reseed cycle."
    )

    def add_arguments(self, parser):
        parser.add_argument("--super-email", default="super@connectnepal.com")
        parser.add_argument("--admin-email", default="admin@connectnepal.com")
        parser.add_argument("--traveller-email", default="traveller@connectnepal.com")
        parser.add_argument("--host-email", default="host@connectnepal.com")
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Required confirmation flag for deletion.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview deletion and rollback all DB changes.",
        )
        parser.add_argument(
            "--allow-prod",
            action="store_true",
            help="Allow command in non-dev environments (dangerous).",
        )

    def handle(self, *args, **opts):
        self._enforce_safety(allow_prod=opts["allow_prod"])

        if not opts["yes"]:
            raise CommandError("Deletion requires --yes.")

        emails = {
            self._normalize_email(opts["super_email"]),
            self._normalize_email(opts["admin_email"]),
            self._normalize_email(opts["traveller_email"]),
            self._normalize_email(opts["host_email"]),
        }

        User = get_user_model()
        users_qs = User.objects.filter(email__in=emails)
        users = list(users_qs.values_list("id", "email"))
        if not users:
            self.stdout.write(self.style.WARNING("No matching demo users found."))
            return

        user_ids = [user_id for user_id, _ in users]
        file_names = list(
            HostDocument.objects.filter(host__user_id__in=user_ids)
            .exclude(file_path="")
            .values_list("file_path", flat=True)
        )

        with transaction.atomic():
            deleted_total, deleted_breakdown = users_qs.delete()

            for file_name in file_names:
                transaction.on_commit(
                    lambda name=file_name: default_storage.delete(name)
                )

            if opts["dry_run"]:
                transaction.set_rollback(True)

        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING("DRY RUN complete (no changes persisted)."))
        else:
            self.stdout.write(self.style.SUCCESS("Demo users deleted."))

        self.stdout.write(f"Matched users: {len(users)}")
        self.stdout.write(f"Deleted ORM rows: {deleted_total}")
        self.stdout.write(f"Deleted docs queued: {len(file_names)}")
        self.stdout.write(f"Breakdown: {deleted_breakdown}")

    def _enforce_safety(self, *, allow_prod):
        env_name = (
            os.getenv("DJANGO_ENV")
            or os.getenv("APP_ENV")
            or os.getenv("ENV")
            or os.getenv("ENVIRONMENT")
            or ""
        ).strip().lower()

        if settings.DEBUG or env_name in SAFE_ENV_NAMES:
            return

        if allow_prod:
            self.stderr.write(
                self.style.WARNING(
                    "Running reset command in non-dev environment because --allow-prod was provided."
                )
            )
            return

        raise CommandError(
            "Refusing to delete demo users in this environment. "
            "Use --allow-prod only if you intentionally want this."
        )

    @staticmethod
    def _normalize_email(value):
        return value.lower().strip()
