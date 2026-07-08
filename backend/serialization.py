"""Serialization helpers for API and MongoDB-safe analysis payloads."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Any


def to_json_safe(value: Any) -> Any:
    """Recursively convert analysis payload values to JSON/BSON-safe types."""
    if isinstance(value, bytes):
        encoded = base64.b64encode(value).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: to_json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [to_json_safe(item) for item in value]
    return value
