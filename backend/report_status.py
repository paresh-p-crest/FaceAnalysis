"""Report workflow status helpers — canonical storage + display labels."""

from __future__ import annotations

from typing import Any, Optional

from .dev_config import dev_auto_approve_reports

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
    if dev_auto_approve_reports():
        return True
    return normalize_report_status(status) in PDF_ALLOWED_STATUSES


def serialize_assessment(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    from .serialization import to_json_safe
    from .pipeline_status import format_pipeline_for_api

    safe = to_json_safe(doc)
    if isinstance(safe, dict) and "status" in safe:
        safe["status"] = format_report_status(safe["status"])
    if isinstance(safe, dict) and safe.get("pipeline"):
        safe["pipeline"] = format_pipeline_for_api(safe["pipeline"])
    if isinstance(safe, dict):
        pipeline = doc.get("pipeline") if doc else None
        safe["processing"] = (
            isinstance(pipeline, dict) and pipeline.get("status") in ("queued", "running")
        )
    return safe


def _prune_analysis_for_summary(analysis: Optional[dict]) -> dict:
    if not isinstance(analysis, dict):
        return {}
    cv = analysis.get("cvReport") if isinstance(analysis.get("cvReport"), dict) else {}
    metrics = analysis.get("metrics") if isinstance(analysis.get("metrics"), dict) else {}
    pruned_cv: dict = {}
    overall = cv.get("overall") if isinstance(cv.get("overall"), dict) else None
    if overall and overall.get("score") is not None:
        pruned_cv["overall"] = {"score": overall.get("score")}
    for key in ("symmetry", "proportions", "skin", "structure"):
        section = cv.get(key)
        if isinstance(section, dict) and section.get("score") is not None:
            pruned_cv[key] = {"score": section.get("score")}
    pruned_metrics = {
        key: metrics[key]
        for key in ("harmonyScore", "symmetryScore", "proportionsScore", "skinScore", "jawlineScore")
        if metrics.get(key) is not None
    }
    out: dict = {}
    if pruned_cv:
        out["cvReport"] = pruned_cv
    if pruned_metrics:
        out["metrics"] = pruned_metrics
    return out


def serialize_assessment_summary(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    from .serialization import to_json_safe
    from .pipeline_status import format_pipeline_for_api

    safe = to_json_safe(doc)
    if not isinstance(safe, dict):
        return safe
    analysis = _prune_analysis_for_summary(safe.get("analysis"))
    return {
        "id": safe.get("id"),
        "userId": safe.get("userId"),
        "status": format_report_status(safe.get("status")),
        "provider": safe.get("provider"),
        "scanId": safe.get("scanId"),
        "createdAt": safe.get("createdAt"),
        "updatedAt": safe.get("updatedAt"),
        "pipeline": format_pipeline_for_api(safe.get("pipeline")) if safe.get("pipeline") else None,
        "processing": (
            isinstance(safe.get("pipeline"), dict)
            and safe.get("pipeline", {}).get("status") in ("queued", "running")
        ),
        "analysis": analysis,
    }


def serialize_assessments(items: list[dict], *, summary: bool = False) -> list[Any]:
    serializer = serialize_assessment_summary if summary else serialize_assessment
    return [serializer(item) for item in items]
