from django.core.management.base import BaseCommand, CommandError

from accounts.models import TravellerDetail
from recommendations.models import RecommendationModelVersion
from recommendations.tasks import rebuild_user_behavior_profile_snapshot_task


class Command(BaseCommand):
    help = (
        "Queue behavior snapshot rebuilds for traveller users so /for-you/ "
        "does not start cold after deployment or a model-version change."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            help='Queue a rebuild for one specific traveller user.',
        )
        parser.add_argument(
            '--model-version',
            type=str,
            metavar='LABEL',
            help=(
                "Queue rebuilds for a specific RecommendationModelVersion label. "
                "Defaults to the active model version."
            ),
        )
        parser.add_argument(
            '--limit',
            type=int,
            metavar='N',
            help='Queue rebuilds for only the first N traveller users.',
        )

    def handle(self, *args, **options):
        model_version = self._resolve_model_version(options.get('model_version'))
        qs = TravellerDetail.objects.order_by('user_id').values_list('user_id', flat=True)

        user_id = options.get('user_id')
        if user_id is not None:
            qs = qs.filter(user_id=user_id)

        limit = options.get('limit')
        if limit:
            qs = qs[:limit]

        user_ids = list(qs)
        if not user_ids:
            self.stdout.write(self.style.WARNING('No traveller users matched the selection.'))
            return

        for target_user_id in user_ids:
            rebuild_user_behavior_profile_snapshot_task.delay(
                user_id=target_user_id,
                model_version_id=model_version.pk,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Queued {len(user_ids)} behavior snapshot rebuild task(s) "
                f"for model version {model_version.version_label}."
            )
        )

    def _resolve_model_version(self, version_label: str | None) -> RecommendationModelVersion:
        if version_label:
            try:
                return RecommendationModelVersion.objects.get(version_label=version_label)
            except RecommendationModelVersion.DoesNotExist as exc:
                raise CommandError(
                    f"Model version '{version_label}' not found."
                ) from exc

        model_version = RecommendationModelVersion.objects.filter(is_active=True).first()
        if model_version is None:
            raise CommandError(
                "No active RecommendationModelVersion found. "
                "Create and activate one in admin first."
            )
        return model_version
