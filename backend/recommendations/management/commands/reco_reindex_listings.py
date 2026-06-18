import logging
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from listings.models import Listing
from recommendations.models import ListingFeatureSnapshot, RecommendationModelVersion
from recommendations.services.artifact_loader import artifact_loader, ArtifactLoadError
from recommendations.services.cache_versioning_service import bump_catalog_generation
from recommendations.services.preprocessing import preprocess_listing_batch
from recommendations.services.vectorizer import vectorize_batch

logger = logging.getLogger('recommendations')

BATCH_SIZE = 100


class Command(BaseCommand):
    help = (
        "Full reindex: compute embeddings for all visible listings and store "
        "them in ListingFeatureSnapshot. Requires an active "
        "RecommendationModelVersion and artifact files in the configured directory."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=BATCH_SIZE,
            metavar='N',
            help=f"Number of listings to process per batch (default: {BATCH_SIZE})",
        )
        parser.add_argument(
            '--model-version',
            type=str,
            metavar='LABEL',
            help=(
                "Reindex against a specific model version label. "
                "If not specified, uses the currently active version."
            ),
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Run preprocessing and vectorization but do not write to DB.",
        )

    def handle(self, *args, **options):
        batch_size = options['batch_size']
        version_label = options.get('model_version')
        dry_run = options['dry_run']

        # 1. Resolve model version
        if version_label:
            try:
                model_version = RecommendationModelVersion.objects.get(
                    version_label=version_label
                )
            except RecommendationModelVersion.DoesNotExist:
                raise CommandError(
                    f"Model version '{version_label}' not found. "
                    f"Create it in admin first."
                )
        else:
            model_version = RecommendationModelVersion.objects.filter(
                is_active=True
            ).first()
            if model_version is None:
                raise CommandError(
                    "No active RecommendationModelVersion found. "
                    "Create and activate one in admin first."
                )

        self.stdout.write(
            f"Using model version: {model_version.version_label} "
            f"(pk={model_version.pk}, active={model_version.is_active})"
        )

        # 2. Validate artifacts load
        try:
            bundle = artifact_loader.get_bundle()
        except ArtifactLoadError as e:
            raise CommandError(f"Failed to load artifacts: {e}")

        self.stdout.write(
            f"Artifact bundle loaded: sklearn={bundle.sklearn_version}, "
            f"dim={bundle.vector_dimension}"
        )

        # 3. Query all visible listings
        listings_qs = Listing.objects.filter(
            is_active=True,
            is_bookable=True,
        ).select_related('host', 'host__user').order_by('pk')

        total_count = listings_qs.count()
        if total_count == 0:
            self.stdout.write(self.style.WARNING("No visible listings found. Nothing to index."))
            return

        self.stdout.write(f"Found {total_count} visible listings to index.")

        # 4. Process in batches
        indexed = 0
        errors = 0
        start_time = time.time()

        for offset in range(0, total_count, batch_size):
            batch = list(listings_qs[offset:offset + batch_size])
            if not batch:
                break

            try:
                preprocessed = preprocess_listing_batch(batch)
                vectors = vectorize_batch(preprocessed)
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(
                        f"Batch {offset}-{offset + len(batch)} failed: {e}"
                    )
                )
                errors += len(batch)
                continue

            if dry_run:
                indexed += len(batch)
                self.stdout.write(
                    f"  [DRY RUN] Batch {offset}-{offset + len(batch)}: "
                    f"{len(vectors)} vectors computed (not saved)."
                )
                continue

            # Bulk upsert via update_or_create in a transaction
            with transaction.atomic():
                for listing, vector in zip(batch, vectors):
                    ListingFeatureSnapshot.objects.update_or_create(
                        listing_id=listing.pk,
                        model_version=model_version,
                        vector_type='content',
                        defaults={
                            'embedding': vector.tolist(),
                            'metadata': {},
                        },
                    )

            indexed += len(batch)
            elapsed = time.time() - start_time
            rate = indexed / elapsed if elapsed > 0 else 0
            self.stdout.write(
                f"  Batch {offset}-{offset + len(batch)}: "
                f"{indexed}/{total_count} indexed ({rate:.1f} listings/sec)"
            )

        elapsed = time.time() - start_time

        # 5. Clean up stale snapshots (listings that are no longer visible)
        if not dry_run:
            stale_deleted, _ = ListingFeatureSnapshot.objects.filter(
                model_version=model_version,
                vector_type='content',
            ).exclude(
                listing__in=listings_qs
            ).delete()
            if stale_deleted:
                self.stdout.write(
                    f"  Cleaned up {stale_deleted} stale snapshot(s)."
                )

            if indexed or stale_deleted:
                catalog_generation = bump_catalog_generation()
                self.stdout.write(
                    f"  Bumped recommendation catalog generation to {catalog_generation}."
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Reindex complete: {indexed} indexed, {errors} errors, "
                f"{elapsed:.1f}s elapsed."
            )
        )
        
