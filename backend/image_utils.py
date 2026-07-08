"""Shared image decoding helpers for API routes."""

from __future__ import annotations

import base64


def decode_image(image_base64: str) -> bytes:
    """Decode base64 image string to bytes (supports data URLs)."""
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64)


def decode_photo_dict(photos: dict) -> dict:
    """Decode base64 photo dict values to bytes."""
    decoded = {}
    for key, val in photos.items():
        if isinstance(val, str) and val:
            try:
                decoded[key] = decode_image(val)
            except Exception:
                pass
    return decoded
