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


def test_clamp_str_does_not_cut_mid_word():
    from backend.narrative_orchestrator import _clamp_str

    long = (
        "The subject should use a gentle hydrating cleanser and ceramide-rich moisturizer nightly "
        "and include targeted periocular hydration for high eyelid exposure and minimal under-eye changes."
    )
    out = _clamp_str(long, 80)
    assert len(out) <= 80
    assert not out.endswith("unde")
    # Ends on sentence or word boundary relative to source
    assert out[-1] in ".!?" or long[len(out) : len(out) + 1] in ("", " ")


def test_clamp_treatment_phases_detail_word_safe():
    from backend.narrative_orchestrator import _clamp_treatment_phases_raw
    from backend.narrative_schemas import TREATMENT_PHASE_DETAIL_MAX

    detail = ("word " * 100).strip()
    raw = {
        "phase01": {
            "title": "Foundation",
            "duration": "8 weeks",
            "items": [{"name": "SPF", "detail": detail}],
        },
        "phase02": {"title": "P2", "duration": "12 weeks", "items": [{"name": "A", "detail": "Ok."}]},
        "phase03": {"title": "P3", "duration": "Ongoing", "items": [{"name": "B", "detail": "Ok."}]},
        "summary": "Baseline plan.",
    }
    clamped = _clamp_treatment_phases_raw(raw)
    d = clamped["phase01"]["items"][0]["detail"]
    assert len(d) <= TREATMENT_PHASE_DETAIL_MAX
    assert not d.endswith("wor")
