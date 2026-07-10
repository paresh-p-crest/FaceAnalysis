"""Shared image decoding helpers for API routes."""

from __future__ import annotations

import base64
import binascii
import re

_DATA_URL_RE = re.compile(r"^data:image/[\w+.-]+;base64,", re.IGNORECASE)


def decode_image(image_base64: str) -> bytes:
    """Decode base64 image string to bytes (supports data URLs)."""
    if not image_base64 or not isinstance(image_base64, str):
        raise ValueError("image payload is empty")
    payload = image_base64.strip()
    if _DATA_URL_RE.match(payload):
        payload = payload.split(",", 1)[1]
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("could not decode base64 image data") from exc


def decode_photo_dict(photos: dict) -> dict:
    """Decode base64 photo dict values to bytes."""
    decoded = {}
    for key, val in photos.items():
        if isinstance(val, str) and val:
            try:
                decoded[key] = decode_image(val)
            except ValueError:
                pass
    return decoded
