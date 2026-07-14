"""Serialization helpers for API and database-safe analysis payloads."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Any


def _is_numpy_type(value: Any) -> bool:
    module = type(value).__module__ or ""
    return module == "numpy" or module.startswith("numpy.")


def to_json_safe(value: Any) -> Any:
    """Recursively convert analysis payload values to JSON/BSON-safe types."""
    if value is None:
        return None

    # NumPy scalars subclass Python bool/int/float — convert before isinstance checks.
    if _is_numpy_type(value):
        if hasattr(value, "tolist") and type(value).__name__ == "ndarray":
            return to_json_safe(value.tolist())
        if hasattr(value, "item"):
            return to_json_safe(value.item())
        return str(value)

    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        encoded = base64.b64encode(value).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: to_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_json_safe(item) for item in value]
    return value
