"""Soft-delete contract for assessments vs package limit count."""

import inspect

from backend.repositories import assessment_repository as repo
from backend.repositories import payment_repository as payments
from backend.routers import media as media_router
from backend import pipeline_stages, pipeline_worker


_MUTATORS = (
    repo.update_assessment_status,
    repo.update_assessment_admin_review,
    repo.update_assessment_analysis,
    repo.set_assessment_photos,
    repo.upsert_assessment_photo,
    repo.remove_assessment_photo,
    repo.finalize_assessment_for_processing,
    repo.update_assessment_ai_narrative,
    repo.update_assessment_ai_visuals,
    repo.update_assessment_protocol,
    repo.update_assessment_pipeline,
    repo.update_assessment_feature_parsing,
    repo.update_assessment_projected_after,
    repo.update_assessment_projected_analysis,
    repo.requeue_failed_pipeline,
)


def test_count_submitted_excludes_soft_deleted_by_default():
    """Package limit counts active submitted rows only (soft-delete frees a slot)."""
    src = inspect.getsource(repo.count_submitted_assessments_for_user)
    assert "include_deleted" in src
    assert "deleted_at" in src


def test_lifetime_count_can_include_soft_deleted():
    """Access unlock may count soft-deleted via include_deleted=True."""
    src = inspect.getsource(repo.count_submitted_assessments_for_user)
    assert "include_deleted" in src


def test_lists_and_get_exclude_soft_deleted():
    list_src = inspect.getsource(repo.list_assessments_for_user)
    admin_src = inspect.getsource(repo.list_assessments)
    draft_src = inspect.getsource(repo.get_latest_draft_for_user)
    get_src = inspect.getsource(repo.get_assessment_by_id)
    active_src = inspect.getsource(repo._is_active)
    for src in (list_src, admin_src, draft_src):
        assert "deleted_at" in src
    assert "_is_active" in get_src
    assert "deleted_at" in active_src


def test_delete_assessment_is_soft():
    src = inspect.getsource(repo.delete_assessment)
    assert "deleted_at" in src
    assert "session.delete" not in src


def test_mutators_refuse_soft_deleted():
    """Every writer must no-op when the row is soft-deleted (_is_active guard)."""
    for fn in _MUTATORS:
        src = inspect.getsource(fn)
        assert "not _is_active" in src, f"{fn.__name__} missing soft-delete guard"


def test_media_route_gates_soft_deleted_assessment_keys():
    src = inspect.getsource(media_router.get_media)
    helper = inspect.getsource(media_router._require_active_assessment_for_key)
    assert "_require_active_assessment_for_key" in src
    assert "get_assessment_by_id" in helper


def test_payment_fallback_active_only():
    src = inspect.getsource(payments.user_has_completed_payment)
    assert "deleted_at" in src


def test_pipeline_aborts_when_assessment_gone():
    worker_src = inspect.getsource(pipeline_worker._process_assessment)
    assert "soft-deleted" in worker_src
    assert "or assessment)" not in worker_src
    assert "or assessment," not in worker_src
    stages_src = inspect.getsource(pipeline_stages._require_live_assessment)
    assert "soft-deleted" in stages_src
    # No continue-on-stale after stage writes
    assert "or refreshed" not in inspect.getsource(pipeline_stages)
