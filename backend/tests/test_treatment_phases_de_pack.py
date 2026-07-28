"""Treatment-phase DE pack/unpack + call-count helpers."""

from backend.narrative_schemas import FEATURE_SUBSECTION_TITLES
from backend.narrative_translation import (
    _apply_phase_field_map,
    _pack_phase_fields,
    _unpack_phase_fields,
    count_treatment_phase_de_calls,
)


def test_pack_unpack_phase_roundtrip():
    phase = {
        "title": "Foundation",
        "duration": "Weeks 1-4",
        "items": [
            {"name": "SPF", "detail": "Apply broad-spectrum SPF 50 daily."},
            {"name": "Sleep", "detail": "Aim for consistent sleep timing."},
        ],
    }
    packed, tags = _pack_phase_fields(phase)
    assert tags == [
        "title",
        "duration",
        "item.0.name",
        "item.0.detail",
        "item.1.name",
        "item.1.detail",
    ]
    assert "<<title>>" in packed
    # Simulate a DE response with same tags
    de_blob = (
        "<<title>>\nGrundlage\n\n"
        "<<duration>>\nWochen 1-4\n\n"
        "<<item.0.name>>\nSPF\n\n"
        "<<item.0.detail>>\nTrage täglich breitbandigen SPF 50 auf.\n\n"
        "<<item.1.name>>\nSchlaf\n\n"
        "<<item.1.detail>>\nAchte auf einen gleichmässigen Schlafrhythmus."
    )
    field_map = _unpack_phase_fields(de_blob, tags)
    out = _apply_phase_field_map(phase, field_map)
    assert out["title"] == "Grundlage"
    assert out["duration"] == "Wochen 1-4"
    assert out["items"][0]["name"] == "SPF"
    assert "SPF 50" in out["items"][0]["detail"]
    assert out["items"][1]["name"] == "Schlaf"


def test_count_treatment_phase_de_calls_full():
    phases = {
        "summary": "Overall plan summary.",
        "phase01": {
            "title": "P1",
            "duration": "4 weeks",
            "items": [{"name": "A", "detail": "Do A."}],
        },
        "phase02": {
            "title": "P2",
            "duration": "4 weeks",
            "items": [
                {"name": "B", "detail": "Do B."},
                {"name": "C", "detail": "Do C."},
            ],
        },
        "phase03": {
            "title": "P3",
            "duration": "4 weeks",
            "items": [
                {"name": "D", "detail": "Do D."},
                {"name": "E", "detail": "Do E."},
                {"name": "F", "detail": "Do F."},
            ],
        },
    }
    # Was 1 + 2*3 + 2*(1+2+3) = 1+6+12 = 19 per-field; now 1 summary + 3 phases.
    assert count_treatment_phase_de_calls(phases) == 4


def test_feature_subsection_body_total_for_call_math():
    # Documents DE feature body call surface used in docs counts.
    total_bodies = sum(len(v) for v in FEATURE_SUBSECTION_TITLES.values())
    assert total_bodies == 20  # 11 features including smile
