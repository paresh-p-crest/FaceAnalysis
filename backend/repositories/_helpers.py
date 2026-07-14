"""Shared helpers for repository serialization (API camelCase + UUID strings)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional


def parse_uuid(value: str | uuid.UUID | None) -> Optional[uuid.UUID]:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None


def iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def enum_val(value: Any) -> Any:
    return value.value if hasattr(value, "value") else value
