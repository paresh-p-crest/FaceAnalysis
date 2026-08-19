"""Prompt/few-shot regressions for ADR-049 diction (not QOVES treatment copy)."""

from backend.recommendation_rules import NULL_PATH_FEATURE_GUIDE
from backend.text_ai_service import NARRATIVE_VOICE_RULES, STRICT_NON_SURGICAL_RULES
from backend.narrative_orchestrator import FEATURE_NARRATIVE_SYSTEM


def test_voice_is_feature_led_not_subject_presents():
    assert "FEATURE as the grammatical subject" in NARRATIVE_VOICE_RULES
    assert "never as" in NARRATIVE_VOICE_RULES
    assert "presents/demonstrates/exhibits" in NARRATIVE_VOICE_RULES


def test_feature_system_is_not_clinical_protocol_writer():
    assert "clinical aesthetic protocol writer" not in FEATURE_NARRATIVE_SYSTEM
    assert "personalized aesthetic report writer" in FEATURE_NARRATIVE_SYSTEM


def test_null_path_fewshots_are_not_formulaic_or_qoves_clinic():
    banned = ("botox", "ipl", "thermage", "hifu", "endolift", "filler", "transverse span", "malar projection")
    formula = "already good, so no changes"
    for fid, guide in NULL_PATH_FEATURE_GUIDE.items():
        text = guide["fewshot"].lower()
        for term in banned:
            assert term not in text, f"{fid} fewshot contains {term}"
        assert formula not in text
        assert "the subject presents" not in text
        assert "the subject's" not in text
        assert not text.startswith("the subject ")


def test_grounding_keeps_technical_tokens():
    assert "alar" in NULL_PATH_FEATURE_GUIDE["nose"]["terms"]
    assert "malar" in NULL_PATH_FEATURE_GUIDE["cheeks"]["terms"]
    assert "vermilion" in NULL_PATH_FEATURE_GUIDE["lips"]["terms"]
    assert "bridge" in NULL_PATH_FEATURE_GUIDE["nose"]["terms"]
    assert "jawline" in NULL_PATH_FEATURE_GUIDE["jaw"]["terms"]


def test_non_surgical_ban_list_still_names_energy_devices():
    blob = STRICT_NON_SURGICAL_RULES.lower()
    for term in ("botox", "ipl", "hifu", "thermage", "endolift", "microneedling"):
        assert term in blob
