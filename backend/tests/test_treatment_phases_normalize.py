"""Treatment-phase key alias normalization before Pydantic validate."""

from backend.narrative_orchestrator import _clamp_treatment_phases_raw, _normalize_treatment_phase_keys


def test_normalize_phase_key_aliases():
    raw = {
        "Phase 01": {"title": "Foundation care path", "duration": "Weeks 1-4", "items": [{"name": "SPF", "detail": "Daily SPF 50"}]},
        "phase_02": {"title": "Regeneration phase", "duration": "Weeks 5-12", "items": [{"name": "Retinol", "detail": "Night use"}]},
        "phase_3": {"title": "Long-term structure", "duration": "Month 4+", "items": [{"name": "Review", "detail": "Clinician check"}]},
        "summary": "Staged non-surgical plan for measured priorities.",
    }
    norm = _normalize_treatment_phase_keys(raw)
    assert "phase01" in norm
    assert "phase02" in norm
    assert "phase03" in norm
    assert "Phase 01" not in norm
    assert "phase_02" not in norm


def test_clamp_accepts_aliased_keys():
    raw = {
        "Phase 01": {
            "title": "Foundation topicals path",
            "duration": "Weeks 1 to 4",
            "items": [
                {"name": "SPF daily", "detail": "Broad-spectrum SPF 50 every morning"},
                {"name": "Cleanser", "detail": "Gentle twice-daily cleanse"},
            ],
        },
        "phase_02": {
            "title": "Supervised regen phase",
            "duration": "Weeks 5 to 12",
            "items": [
                {"name": "Retinol", "detail": "Low-dose evening application"},
                {"name": "Barrier", "detail": "Ceramide moisturizer nightly"},
            ],
        },
        "phase 03": {
            "title": "Long-term optimisation",
            "duration": "Month 4 onward",
            "items": [
                {"name": "Review", "detail": "Reassess priorities each quarter"},
                {"name": "Maintain", "detail": "Keep SPF and actives consistent"},
            ],
        },
        "summary": "Baseline status and staged non-surgical plan for priority regions.",
    }
    clamped = _clamp_treatment_phases_raw(raw)
    assert set(clamped.keys()) >= {"phase01", "phase02", "phase03", "summary"}
    assert clamped["phase01"]["title"].startswith("Foundation")
