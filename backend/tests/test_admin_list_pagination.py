"""Admin list pagination helpers (no DB)."""

from backend.models import AssessmentStatus
from backend.repositories.assessment_repository import _list_clauses


def test_list_clauses_default_is_not_deleted_only():
    clauses = _list_clauses()
    assert len(clauses) == 1


def test_list_clauses_approved_includes_published():
    clauses = _list_clauses(status="approved")
    values = list(clauses[1].right.value)
    assert AssessmentStatus.approved in values
    assert AssessmentStatus.published in values


def test_list_clauses_pending_review():
    clauses = _list_clauses(status="pending_review")
    assert len(clauses) == 2
    assert clauses[1].right.value is AssessmentStatus.pending_review
