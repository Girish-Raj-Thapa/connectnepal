from django.db import transaction
from django.urls import reverse

from accounts.models import Account, TravellerDetail, HostDetail, HostDocument
from utils.exceptions import ValidationError
from utils.files import validate_file, compress_image


def get_next_step_url(user: Account) -> str | None:
    """Get the URL for the user's next onboarding step."""
    if user.has_completed_onboarding:
        return None

    if user.role == Account.Role.TRAVELLER:
        urls = {
            0: reverse("accounts:traveller-basic-profile"),
            1: reverse("accounts:traveller-preferences"),
        }
    elif user.role == Account.Role.HOST:
        urls = {
            0: reverse("accounts:host-basic-profile"),
            1: reverse("accounts:host-business-info"),
        }
    else:
        return None

    return urls.get(user.onboarding_step)


def validate_step_order(user: Account, required_step: int) -> None:
    """Ensure user has completed prerequisite steps."""
    if user.onboarding_step < required_step:
        raise ValidationError(
            detail=f"Please complete step {required_step} first.",
            code="step_order_violation"
        )


def _compress_profile_photo(serializer) -> None:
    profile_photo = serializer.validated_data.get("profile_photo")
    if not profile_photo:
        return

    validate_file(profile_photo)
    serializer.validated_data["profile_photo"] = compress_image(
        profile_photo,
        output_format="WEBP",
    )


@transaction.atomic
def complete_traveller_basic_profile(user: Account, serializer) -> Account:
    """
    Complete traveller onboarding step 1.
    Updates basic profile and advances onboarding step.
    """
    _compress_profile_photo(serializer)
    serializer.save(onboarding_step=1)
    return user


@transaction.atomic
def complete_traveller_preferences(user: Account, data: dict) -> TravellerDetail:
    """
    Complete traveller onboarding step 2.
    Creates TravellerDetail and marks onboarding complete.
    """
    validate_step_order(user, required_step=1)

    traveller_detail, _ = TravellerDetail.objects.update_or_create(
        user=user,
        defaults={
            "emergency_contact": data.get("emergency_contact", ""),
            "preferred_activities": data.get("preferred_activities", []),
            "preferred_min_budget": data.get("preferred_min_budget"),
            "preferred_max_budget": data.get("preferred_max_budget"),
            "preferred_trip_style": data.get("preferred_trip_style", ""),
        },
    )

    user.has_completed_onboarding = True
    user.onboarding_step = 2
    user.save(update_fields=['has_completed_onboarding', 'onboarding_step'])

    return traveller_detail


@transaction.atomic
def complete_host_basic_profile(user: Account, serializer) -> Account:
    """
    Complete host onboarding step 1.
    Updates basic profile and advances onboarding step.
    """
    _compress_profile_photo(serializer)
    serializer.save(onboarding_step=1)
    return user


@transaction.atomic
def complete_host_business_info(user: Account, data: dict) -> HostDetail:
    """
    Complete host onboarding step 2.
    Creates HostDetail and marks onboarding complete.
    """
    validate_step_order(user, required_step=1)

    host_detail, _ = HostDetail.objects.update_or_create(
        user=user,
        defaults={
            "business_name": data.get("business_name"),
            "business_address": data.get("business_address"),
            "business_phone": data.get("business_phone", ""),
            "about_service": data.get("about_service", ""),
        },
    )

    user.has_completed_onboarding = True
    user.onboarding_step = 2
    user.save(update_fields=['has_completed_onboarding', 'onboarding_step'])

    return host_detail


@transaction.atomic
def upload_host_documents(host_detail: HostDetail, validated_data: dict) -> dict:
    """
    Process and persist host verification documents.

    Iterates over the three document types, validates and compresses each
    uploaded file, then upserts the HostDocument row. If all three documents
    are present after this batch, the host's verification_status is advanced
    to PENDING automatically.

    Args:
        host_detail: The HostDetail instance for the uploading host.
        validated_data: Validated data dict from HostDocumentUploadSerializer.

    Returns:
        dict with uploaded_count, total_documents, verification_status.
    """
    document_types = {
        "citizenship_file": HostDocument.DocumentType.CITIZENSHIP,
        "pan_file": HostDocument.DocumentType.PAN,
        "business_license_file": HostDocument.DocumentType.BUSINESS_LICENSE,
    }

    uploaded_count = 0
    for field_name, doc_type in document_types.items():
        file = validated_data.get(field_name)
        if file:
            validate_file(file)
            compressed = compress_image(file)
            HostDocument.objects.update_or_create(
                host=host_detail,
                document_type=doc_type,
                defaults={"file_path": compressed},
            )
            uploaded_count += 1

    total_docs = HostDocument.objects.filter(host=host_detail).count()
    if total_docs == 3:
        host_detail.verification_status = HostDetail.VerificationStatus.PENDING
        host_detail.save(update_fields=['verification_status'])

    return {
        "uploaded_count": uploaded_count,
        "total_documents": total_docs,
        "verification_status": host_detail.verification_status,
    }
