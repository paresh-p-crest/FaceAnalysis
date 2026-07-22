from backend.report_status import assessment_is_submitted


def test_draft_without_pipeline_not_submitted():
    assert assessment_is_submitted({"status": "draft", "pipeline": None}) is False
    assert assessment_is_submitted({"status": "Draft", "pipeline": None}) is False


def test_submitted_has_pipeline():
    assert assessment_is_submitted({
        "status": "pending_review",
        "pipeline": {"status": "queued"},
    }) is True


def test_draft_with_pipeline_still_not_submitted():
    assert assessment_is_submitted({
        "status": "draft",
        "pipeline": {"status": "queued"},
    }) is False
