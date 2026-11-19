"""Image validation, sanitization, decompression bomb guard, and metadata stripping."""
import hashlib
import io
from typing import Tuple
from fastapi import HTTPException, status
from PIL import Image, ImageOps
from app.core.config import settings

# Enforce decompression bomb limit globally on Pillow
Image.MAX_IMAGE_PIXELS = settings.PILLOW_MAX_IMAGE_PIXELS


def detect_and_verify_magic_bytes(raw_bytes: bytes) -> str:
    """Detect image format strictly from initial magic bytes.
    
    Supported:
    - JPEG: \\xFF\\xD8\\xFF
    - PNG:  \\x89PNG\\r\\n\\x1a\\n
    - WebP: RIFF....WEBP
    """
    if len(raw_bytes) < 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is too small to be a valid image."
        )

    if raw_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    elif raw_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    elif raw_bytes.startswith(b"RIFF") and raw_bytes[8:12] == b"WEBP":
        return "image/webp"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported or invalid file signature. Allowed formats: JPEG, PNG, WebP."
    )


def validate_and_sanitize_image(
    raw_bytes: bytes,
    max_size_bytes: int = settings.MAX_ATTACHMENT_SIZE_BYTES,
    max_dimension_px: int = settings.MAX_IMAGE_DIMENSION_PX,
) -> Tuple[bytes, str, str, int]:
    """Validate, sanitize, strip EXIF metadata, and re-encode image.

    Returns:
        Tuple of (sanitized_bytes, mime_type, sha256, size_bytes)
    """
    # 1. Size constraint check
    if len(raw_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Image size ({len(raw_bytes)} bytes) exceeds the maximum allowed limit of {max_size_bytes} bytes."
        )

    if len(raw_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 2. Magic byte verification
    detected_mime = detect_and_verify_magic_bytes(raw_bytes)

    # 3. Pillow integrity check & decompression bomb guard
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img_verify:
            img_verify.verify()
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image pixel count exceeds safe decompression limits."
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or invalid image structure: {str(exc)}"
        )

    # 4. Re-open to process, transpose EXIF orientation, and strip metadata
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            # Respect orientation before stripping EXIF
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            width, height = img.size
            if width > max_dimension_px or height > max_dimension_px:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Image dimensions ({width}x{height}) exceed maximum allowed dimension of {max_dimension_px}px."
                )

            # Re-encode to clean in-memory buffer without metadata
            output_io = io.BytesIO()
            if detected_mime == "image/jpeg":
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                img.save(output_io, format="JPEG", quality=90, optimize=True)
            elif detected_mime == "image/png":
                img.save(output_io, format="PNG", optimize=True)
            elif detected_mime == "image/webp":
                img.save(output_io, format="WEBP", quality=90, method=4)

            sanitized_bytes = output_io.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process and sanitize image: {str(exc)}"
        )

    # 5. Compute SHA-256 strictly over the sanitized bytes to be stored
    sha256 = hashlib.sha256(sanitized_bytes).hexdigest()
    size_bytes = len(sanitized_bytes)

    return sanitized_bytes, detected_mime, sha256, size_bytes

