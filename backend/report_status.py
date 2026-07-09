"""Report workflow status helpers — canonical storage + display labels."""

from __future__ import annotations

from typing import Any, Optional

WORKFLOW_STATUSES = frozenset({"pending_review", "approved"})
PDF_ALLOWED_STATUSES = frozenset({"approved", "published"})

STATUS_LABELS = {
    "pending_review": "Pending Review",
    "approved": "Approved",
    "published": "Approved",
    "draft": "Draft",
}


def normalize_report_status(status: Optional[str]) -> str:
    value = str(status or "pending_review").strip().lower().replace(" ", "_")
    if value in ("approved", "published"):
        return "approved"
    if value in ("pending_review", "pendingreview", "pending"):
        return "pending_review"
    if value == "draft":
        return "draft"
    return "pending_review"


def format_report_status(status: Optional[str]) -> str:
    return STATUS_LABELS.get(normalize_report_status(status), "Pending Review")


def parse_status_input(status: str) -> str:
    canonical = normalize_report_status(status)
    if canonical not in WORKFLOW_STATUSES:
        raise ValueError(f"Status must be one of: {', '.join(format_report_status(s) for s in WORKFLOW_STATUSES)}")
    return canonical


def is_pdf_allowed_status(status: Optional[str]) -> bool:
    return normalize_report_status(status) in PDF_ALLOWED_STATUSES


def serialize_assessment(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    from .serialization import to_json_safe

    safe = to_json_safe(doc)
    if isinstance(safe, dict) and "status" in safe:
        safe["status"] = format_report_status(safe["status"])
    return safe


def serialize_assessments(items: list[dict]) -> list[Any]:
    return [serialize_assessment(item) for item in items]
