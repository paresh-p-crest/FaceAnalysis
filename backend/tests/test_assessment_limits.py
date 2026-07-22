"""Tests for per-user assessment slot limits."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from backend.assessment_limits import (
    ASSESSMENT_LIMIT_DETAIL,
    MAX_SUBMITTED_ASSESSMENTS_PER_USER,
    require_assessment_slot,
)


def test_admin_bypasses_limit():
    asyncio.run(require_assessment_slot({"id": "u1", "role": "admin"}))


def test_allows_when_under_limit():
    with patch(
        "backend.assessment_limits.count_submitted_assessments_for_user",
        new_callable=AsyncMock,
        return_value=1,
    ):
        asyncio.run(require_assessment_slot({"id": "u1", "role": "user"}))


def test_blocks_when_at_limit():
    with patch(
        "backend.assessment_limits.count_submitted_assessments_for_user",
        new_callable=AsyncMock,
        return_value=MAX_SUBMITTED_ASSESSMENTS_PER_USER,
    ):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(require_assessment_slot({"id": "u1", "role": "user"}))
        assert exc.value.status_code == 403
        assert exc.value.detail == ASSESSMENT_LIMIT_DETAIL


def test_allows_idempotent_resubmit_of_submitted_assessment():
    with patch(
        "backend.assessment_limits.get_assessment_by_id",
        new_callable=AsyncMock,
        return_value={"id": "a1", "status": "pending_review", "pipeline": {"status": "ready"}},
    ):
        asyncio.run(
            require_assessment_slot(
                {"id": "u1", "role": "user"},
                assessment_id="a1",
            )
        )


def test_blocks_orphan_draft_when_at_limit():
    with patch(
        "backend.assessment_limits.get_assessment_by_id",
        new_callable=AsyncMock,
        return_value={"id": "draft1", "status": "draft", "pipeline": None},
    ), patch(
        "backend.assessment_limits.count_submitted_assessments_for_user",
        new_callable=AsyncMock,
        return_value=MAX_SUBMITTED_ASSESSMENTS_PER_USER,
    ):
        with pytest.raises(HTTPException) as exc:
            asyncio.run(
                require_assessment_slot(
                    {"id": "u1", "role": "user"},
                    assessment_id="draft1",
                )
            )
        assert exc.value.status_code == 403
