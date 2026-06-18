from django.db import IntegrityError, transaction
from django.utils.text import slugify

from accounts.models import HostDetail
from listings.constants import UNVERIFIED_HOST_TRANSACTION_LIMIT
from listings.models import Listing
from utils.exceptions import ServiceError
from utils.files import compress_image, validate_file
from ..models import Package, PackageListing
from bookings.models import BookingItem, BookingStatus

UNVERIFIED_HOST_PACKAGE_LIMIT = 1


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _generate_unique_slug(title: str) -> str:
    """
    Derive a URL-safe, unique slug from a package title.

    Starts from the base slug produced by ``slugify(title)`` and appends an
    incrementing numeric suffix (``-1``, ``-2``, …) until a slug not already
    present in the ``Package`` table is found.  The caller is responsible for
    wrapping this in an atomic transaction so that the uniqueness check and the
    subsequent ``Package.objects.create()`` are not separated by a race window.

    Args:
        title: The raw package title supplied by the host.

    Returns:
        A slug string that is unique within the ``packages_package`` table at
        the time of the call.
    """
    base = slugify(title) or "package"

    slug = base
    counter = 1
    while Package.objects.filter(slug=slug).exists():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def _create_package_with_unique_slug(host: HostDetail, data: dict) -> Package:
    """
    Create a package row while tolerating slug races from concurrent same-title creates.
    """
    last_exc = None
    for _ in range(10):
        slug = _generate_unique_slug(data["title"])
        try:
            with transaction.atomic():
                return Package.objects.create(
                    host=host,
                    slug=slug,
                    **data,
                )
        except IntegrityError as exc:
            last_exc = exc
            if Package.objects.filter(slug=slug).exists():
                continue
            raise

    raise ServiceError(
        "Could not create a unique package slug. Please retry.",
        code="slug_generation_failed",
        status_code=409,
    ) from last_exc


def _validate_and_fetch_listings(listing_ids: list, host: HostDetail) -> list:
    """
    Validate a list of listing IDs for inclusion in a host's package.

    Performs all ownership and availability checks in a single database query,
    then iterates ``listing_ids`` in the original order to build a sorted list
    of ``Listing`` instances suitable for ``bulk_create``.

    Args:
        listing_ids: Ordered list of ``Listing`` primary keys submitted by the
            host.  Order determines ``sort_order`` in the resulting
            ``PackageListing`` rows.
        host: The ``HostDetail`` of the requesting host.  Used for ownership
            validation.

    Returns:
        A list of ``Listing`` objects in the same order as ``listing_ids``.

    Raises:
        ServiceError(too_few_listings):   Fewer than 2 IDs were provided.
        ServiceError(duplicate_listing):  The same ID appears more than once.
        ServiceError(listing_not_found):  An ID does not correspond to any
            ``Listing`` row.
        ServiceError(listing_not_owned):  A listing belongs to a different host.
        ServiceError(listing_not_active): A listing is inactive or not bookable.
    """
    if len(listing_ids) < 2:
        raise ServiceError(
            "A package must include at least 2 listings.",
            code="too_few_listings",
            status_code=400,
        )

    if len(listing_ids) != len(set(listing_ids)):
        raise ServiceError(
            "Duplicate listing IDs are not allowed.",
            code="duplicate_listing",
            status_code=400,
        )

    listing_map = {listing.id: listing for listing in Listing.objects.filter(pk__in=listing_ids)}

    ordered_listings = []
    for lid in listing_ids:
        if lid not in listing_map:
            raise ServiceError(
                f"Listing {lid} not found.",
                code="listing_not_found",
                status_code=404,
            )

        listing = listing_map[lid]

        if listing.host_id != host.pk:
            raise ServiceError(
                f"Listing '{listing.title}' does not belong to your account.",
                code="listing_not_owned",
                status_code=400,
            )

        if not listing.is_active or not listing.is_bookable:
            raise ServiceError(
                f"Listing '{listing.title}' must be active and bookable to include in a package.",
                code="listing_not_active",
                status_code=400,
            )

        ordered_listings.append(listing)

    return ordered_listings


def _count_publishable_package_listings(package: Package) -> int:
    return package.package_listings.filter(
        listing__is_active=True,
        listing__is_bookable=True,
        listing__host__user__is_active=True,
    ).count()


def _compress_cover_image_data(data: dict) -> None:
    if "cover_image" not in data or not data["cover_image"]:
        return

    validate_file(data["cover_image"])
    data["cover_image"] = compress_image(data["cover_image"], output_format="WEBP")


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC SERVICE FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

@transaction.atomic
def create_package_with_listings(host: HostDetail, data: dict) -> Package:
    """
    Create a new ``Package`` and its ordered ``PackageListing`` rows atomically.

    ``listing_ids`` is popped from ``data`` before the ``Package`` row is
    created because it is not a model field—it is consumed here to produce
    ``PackageListing`` through-model rows.  If ``listing_ids`` is non-empty,
    each listing is validated for ownership and bookability before the
    ``PackageListing`` rows are bulk-created with ``sort_order`` equal to the
    index in the submitted list.

    The entire operation is wrapped in ``@transaction.atomic`` so that a
    failure in ``bulk_create`` (e.g. a FK violation) rolls back the ``Package``
    row as well.

    Args:
        host: The authenticated host creating the package.
        data: Validated data dict from ``PackageCreateSerializer``.  Contains
            all ``Package`` model fields plus an optional ``listing_ids`` list.

    Returns:
        The newly created ``Package`` instance.
    """
    listing_ids = data.pop("listing_ids", [])
    _compress_cover_image_data(data)
    package = _create_package_with_unique_slug(host, data)

    if listing_ids:
        listings = _validate_and_fetch_listings(listing_ids, host)
        PackageListing.objects.bulk_create([
            PackageListing(package=package, listing=listing, sort_order=i)
            for i, listing in enumerate(listings)
        ])

    return package


@transaction.atomic
def update_package(package: Package, data: dict) -> Package:
    """
    Partially update a ``Package``'s scalar fields (PATCH semantics).

    Enforces two business invariants before applying any changes:

    1. **No re-activation.** ``is_active=True`` is rejected because soft-delete
       is a one-way operation.  The serializer already blocks this at the input
       layer; the service is the authoritative second gate.

    2. **Publish guard.** ``is_bookable=True`` is rejected when the package
       currently has fewer than 2 ``PackageListing`` rows.  A package with no
       or only one listing must not be made bookable.

    If ``is_active=False`` is being set (soft-delete via PATCH), ``is_bookable``
    is force-set to ``False`` in the same save call so the package cannot
    remain bookable after deletion.

    Only the columns present in ``data`` are written (``update_fields``), which
    avoids clobbering concurrent changes to unrelated columns.

    Args:
        package: The ``Package`` instance to update (already fetched by the view).
        data: Validated data dict from ``PackageUpdateSerializer``.  Contains
            only the fields the client chose to send.

    Returns:
        The updated ``Package`` instance.

    Raises:
        ServiceError(cannot_reactivate):          ``is_active=True`` was requested.
        ServiceError(cannot_publish_empty_package): ``is_bookable=True`` but fewer
            than 2 listings are attached.
    """
    if data.get("is_active") is True:
        raise ServiceError(
            "A deleted package cannot be reactivated.",
            code="cannot_reactivate",
            status_code=400,
        )

    if data.get("is_bookable") is True:
        if _count_publishable_package_listings(package) < 2:
            raise ServiceError(
                "A package must have at least 2 active and bookable listings before it can be published.",
                code="cannot_publish_empty_package",
                status_code=400,
            )

        # Unverified host publish limit (False → True transition only)
        if not package.is_bookable:
            host = package.host
            if not host.is_verified:
                current_count = (
                    host.packages
                    .filter(is_active=True, is_bookable=True)
                    .exclude(pk=package.pk)
                    .count()
                )
                if current_count >= UNVERIFIED_HOST_PACKAGE_LIMIT:
                    raise ServiceError(
                        f"Unverified hosts can only publish "
                        f"{UNVERIFIED_HOST_PACKAGE_LIMIT} package(s). "
                        f"Verify your account to publish more.",
                        code="package_limit_exceeded",
                        status_code=400,
                    )

                if host.user.total_revenue >= UNVERIFIED_HOST_TRANSACTION_LIMIT:
                    raise ServiceError(
                        "You've reached your unverified transaction limit of "
                        f"NPR {UNVERIFIED_HOST_TRANSACTION_LIMIT:,.0f}. "
                        "Complete verification to publish more packages.",
                        code="transaction_limit_exceeded",
                        status_code=400,
                    )

    if data.get("is_active") is False:
        data["is_bookable"] = False

    _compress_cover_image_data(data)

    for field, value in data.items():
        setattr(package, field, value)

    package.save(update_fields=list(data.keys()) + ["updated_at"])
    return package


@transaction.atomic
def set_package_listings(package: Package, listing_ids: list, host: HostDetail) -> Package:
    """
    Bulk-replace the complete, ordered set of listings attached to a package.

    All existing ``PackageListing`` rows for the package are deleted, then new
    rows are bulk-created where ``sort_order`` equals the index of each ID in
    ``listing_ids``.  Both steps execute inside the same ``@transaction.atomic``
    block so they succeed or fail together.

    This idempotent design suits the create/edit UI, which submits the full
    desired listing state on every save rather than an incremental delta.

    Args:
        package: The ``Package`` whose listing set is being replaced.
        listing_ids: Ordered list of ``Listing`` PKs representing the new set.
            Must contain at least 2 distinct IDs owned by ``host``.
        host: The authenticated host performing the update.  Used to verify
            listing ownership.

    Returns:
        The same ``Package`` instance (unchanged; caller re-serializes it).

    Raises:
        ServiceError: Propagated from ``_validate_and_fetch_listings`` for any
            ownership, availability, or cardinality violation.
    """
    listings = _validate_and_fetch_listings(listing_ids, host)

    PackageListing.objects.filter(package=package).delete()
    PackageListing.objects.bulk_create([
        PackageListing(package=package, listing=listing, sort_order=i)
        for i, listing in enumerate(listings)
    ])

    return package


@transaction.atomic
def soft_delete_package(package: Package) -> None:
    """
    Soft-delete a package by setting ``is_active=False`` and ``is_bookable=False``.

    The package is not hard-deleted because completed bookings reference it for
    audit history, and the ``BookingItem.package`` FK uses ``on_delete=PROTECT``.
    A soft-delete preserves all historical data while preventing new bookings.

    Deletion is blocked when any ``BookingItem`` linked to this package is in a
    live state (``PENDING_PAYMENT`` or ``CONFIRMED``), because removing the
    package while a traveller's booking is active would leave their booking in
    an unresolvable state.

    Args:
        package: The ``Package`` to soft-delete.

    Raises:
        ServiceError(active_bookings_exist): One or more active or confirmed
            bookings reference this package.
    """
    active_count = BookingItem.objects.filter(
        package=package,
        booking__status__in=[BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
    ).count()

    if active_count > 0:
        raise ServiceError(
            "Cannot delete a package with active or confirmed bookings. "
            "Cancel those bookings first.",
            code="active_bookings_exist",
            status_code=400,
        )

    package.is_active = False
    package.is_bookable = False
    package.save(update_fields=["is_active", "is_bookable", "updated_at"])


def set_cover_image(package: Package, image_file) -> Package:
    """
    Upload or replace the cover image for a package.
    The old file is deleted from storage by the pre_save signal.
    """
    validate_file(image_file)
    package.cover_image = compress_image(image_file, output_format="WEBP")
    package.save(update_fields=["cover_image", "updated_at"])
    return package


def remove_cover_image(package: Package) -> None:
    """
    Remove the cover image from a package and delete the file from storage.
    """
    from utils.files import delete_file_field
    delete_file_field(package.cover_image)
    package.cover_image = None
    package.save(update_fields=["cover_image", "updated_at"])
