import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from PIL import Image, ImageOps
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile

logger = logging.getLogger(__name__)


def _normalize_image_for_output(img: Image.Image, output_format: str) -> Image.Image:
    """Convert a Pillow image into a mode suitable for the target format."""
    output_format = output_format.upper()

    has_alpha = (
        "A" in img.getbands()
        or (img.mode == "P" and "transparency" in img.info)
    )

    if output_format == "JPEG":
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img

    if output_format == "WEBP":
        if has_alpha and img.mode != "RGBA":
            return img.convert("RGBA")
        if not has_alpha and img.mode != "RGB":
            return img.convert("RGB")
        return img

    raise ValueError(f"Unsupported output format: {output_format}")


def _save_image_to_memory(img: Image.Image, output_format: str, quality: int) -> tuple[BytesIO, str, str]:
    """Encode an image to memory and return buffer, extension, and content type."""
    output_format = output_format.upper()
    buffer = BytesIO()

    if output_format == "JPEG":
        img.save(buffer, format="JPEG", quality=quality, optimize=True)
        extension = "jpg"
        content_type = "image/jpeg"
    elif output_format == "WEBP":
        img.save(buffer, format="WEBP", quality=quality, method=6)
        extension = "webp"
        content_type = "image/webp"
    else:
        raise ValueError(f"Unsupported output format: {output_format}")

    buffer.seek(0)
    return buffer, extension, content_type


def delete_file_field(field) -> None:
    """
    Delete the file referenced by a Django FieldFile (ImageField / FileField value).

    Safe to call from post_delete / pre_save signals:
    - Does nothing if the field is empty (blank=True fields, null photos).
    - Catches and logs all storage errors so a failed deletion never crashes
      a request or Celery task.

    Args:
        field: The FieldFile instance (e.g. instance.profile_photo,
               instance.image).  NOT the model field descriptor.
    """
    if not field:
        return
    try:
        field.delete(save=False)
    except Exception:
        logger.exception("Failed to delete file '%s' from storage", field.name)


def validate_file(file, max_size_mb=None, allowed_types=None):
    """
    Validate file size and MIME type.

    Args:
        file: UploadedFile instance
        max_size_mb: Maximum file size in MB (default from settings)
        allowed_types: List of allowed MIME types (default from settings)

    Raises:
        ValidationError: If file is invalid
    """
    max_size_mb = max_size_mb or getattr(settings, 'FILE_MAX_SIZE_MB', 2)
    allowed_types = allowed_types or getattr(
        settings, 'ALLOWED_IMAGE_TYPES',
        ['image/jpeg', 'image/png', 'image/webp']
    )

    max_bytes = max_size_mb * 1024 * 1024
    if file.size > max_bytes:
        raise DjangoValidationError(
            f"File size exceeds maximum allowed size of {max_size_mb}MB."
        )

    if file.content_type not in allowed_types:
        raise DjangoValidationError(
            f"File type '{file.content_type}' is not allowed. "
            f"Allowed types: {', '.join(allowed_types)}"
        )


def compress_image(file, quality=80, max_dimension=1920, output_format="JPEG"):
    """
    Compress and resize image.

    Args:
        file: UploadedFile instance
        quality: Output quality (1-100)
        max_dimension: Maximum width/height in pixels
        output_format: Encoded output format, e.g. "JPEG" or "WEBP"

    Returns:
        Compressed InMemoryUploadedFile
    """
    if hasattr(file, 'seek'):
        file.seek(0)
    img = Image.open(file)
    img = _normalize_image_for_output(img, output_format)

    # Resize if larger than max dimension
    if max(img.size) > max_dimension:
        img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

    # Save to buffer
    buffer, extension, content_type = _save_image_to_memory(img, output_format, quality)

    # Get original filename without extension
    original_name = file.name.rsplit('.', 1)[0] if '.' in file.name else file.name

    return InMemoryUploadedFile(
        file=buffer,
        field_name=getattr(file, 'field_name', 'file'),
        name=f"{original_name}.{extension}",
        content_type=content_type,
        size=buffer.getbuffer().nbytes,
        charset=None,
    )


def create_thumbnail(file, size=(400, 300), quality=75, output_format="WEBP"):
    """
    Create a card-sized thumbnail from an image file.

    The thumbnail is center-cropped to the target aspect ratio so list/grid
    cards remain consistent and lightweight.
    """
    if hasattr(file, 'seek'):
        file.seek(0)
    img = Image.open(file)
    img = _normalize_image_for_output(img, output_format)

    thumb = ImageOps.fit(img, size, Image.Resampling.LANCZOS)

    buffer, extension, content_type = _save_image_to_memory(thumb, output_format, quality)

    original_name = file.name.rsplit('.', 1)[0] if '.' in file.name else file.name

    return InMemoryUploadedFile(
        file=buffer,
        field_name=getattr(file, 'field_name', 'file'),
        name=f"{original_name}_thumb.{extension}",
        content_type=content_type,
        size=buffer.getbuffer().nbytes,
        charset=None,
    )


def get_file_extension(filename):
    """Get file extension from filename."""
    if '.' in filename:
        return filename.rsplit('.', 1)[1].lower()
    return ''
