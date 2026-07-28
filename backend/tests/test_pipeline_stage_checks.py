"""Tests for pipeline stage completion helpers."""

from backend.clinical_guardrails import is_template_feature_narrative
from backend.config import FEATURE_NARRATIVE_IDS
from backend.pipeline_stage_checks import (
    ai_visuals_stage_complete,
    narratives_stage_complete,
    parsing_stage_complete,
    projected_after_stage_complete,
)
from backend.protocol_service import is_narratives_complete


def _feature_narrative(text: str) -> dict:
    return {
        "featureId": "hair",
        "summary": text,
        "description": text,
        "subsections": [{"title": "Care", "body": text, "evidenceTier": "lifestyle"}],
    }


def _template_feature() -> dict:
    return {
        "featureId": "hair",
        "summary": "Prioritize the subject's measured presentation. Focus on grooming, topical care.",
        "description": "",
        "subsections": [],
    }


def _complete_narratives_assessment(**overrides) -> dict:
    features = {fid: _feature_narrative(f"Detailed narrative for {fid} with enough text.") for fid in FEATURE_NARRATIVE_IDS}
    pn_features = {fid: f"Protocol copy for {fid} with sufficient length here." for fid in FEATURE_NARRATIVE_IDS}
    base = {
        "id": "test-id",
        "aiNarrative": {"content": {"summary": "Executive overview of facial harmony and key priorities."}},
        "protocolNarrative": {
            "summary": "This protocol summarizes measured findings across all aesthetic features.",
            "closing": ["Maintain consistent skincare and follow-up as recommended."],
            "features": pn_features,
        },
        "featureNarratives": features,
    }
    base.update(overrides)
    return base


class TestNarrativesStageComplete:
    def test_complete_narratives(self):
        assessment = _complete_narratives_assessment()
        assert narratives_stage_complete(assessment) is True
        assert is_narratives_complete(assessment) is True

    def test_missing_executive_narrative(self):
        assessment = _complete_narratives_assessment(aiNarrative=None)
        assert narratives_stage_complete(assessment) is False

    def test_template_feature_narrative(self):
        features = {fid: _feature_narrative(f"Text for {fid}.") for fid in FEATURE_NARRATIVE_IDS}
        features["smile"] = _template_feature()
        assessment = _complete_narratives_assessment(featureNarratives=features)
        assert is_template_feature_narrative(features["smile"])
        assert narratives_stage_complete(assessment) is False

    def test_missing_feature_in_feature_narratives(self):
        features = {fid: _feature_narrative(f"Text for {fid}.") for fid in FEATURE_NARRATIVE_IDS}
        del features["ears"]
        assessment = _complete_narratives_assessment(featureNarratives=features)
        assert narratives_stage_complete(assessment) is False


class TestProjectedAfterStageComplete:
    def test_skipped_when_disabled(self, monkeypatch):
        monkeypatch.setenv("PROJECTED_AFTER_ENABLED", "false")
        assert projected_after_stage_complete({"projectedAfter": {"status": "pending"}}) is True

    def test_ready_status_with_file(self, monkeypatch):
        monkeypatch.setenv("PROJECTED_AFTER_ENABLED", "true")
        monkeypatch.setattr(
            "backend.pipeline_stage_checks.load_projected_full",
            lambda _aid, _meta: b"jpeg",
        )
        assessment = {"id": "a1", "projectedAfter": {"status": "ready"}}
        assert projected_after_stage_complete(assessment) is True

    def test_pending_status(self, monkeypatch):
        monkeypatch.setenv("PROJECTED_AFTER_ENABLED", "true")
        assert projected_after_stage_complete({"projectedAfter": {"status": "pending"}}) is False


class TestAiVisualsStageComplete:
    def test_complete_visuals(self, monkeypatch):
        monkeypatch.setattr(
            "backend.pipeline_stage_checks._style_specs_for_type",
            lambda vtype, _cv, _ans: [type("S", (), {"style_id": f"{vtype}-1"})()],
        )
        assessment = {
            "aiVisuals": {
                "variants": [
                    {"type": "hair", "styleId": "hair-1", "status": "generated", "imageSrc": "/u1"},
                    {"type": "outfit", "styleId": "outfit-1", "status": "generated", "imageSrc": "/u2"},
                    {"type": "aging", "styleId": "aging-1", "status": "generated", "imageSrc": "/u3"},
                ],
            }
        }
        assert ai_visuals_stage_complete(assessment, {"overall": {}}, {}) is True

    def test_complete_without_outfit_baseline(self, monkeypatch):
        """outfitBaseline not required while white-tee generation is disabled."""
        monkeypatch.setattr(
            "backend.pipeline_stage_checks._style_specs_for_type",
            lambda vtype, _cv, _ans: [type("S", (), {"style_id": f"{vtype}-1"})()],
        )
        assessment = {
            "aiVisuals": {
                "variants": [
                    {"type": "hair", "styleId": "hair-1", "status": "generated", "imageSrc": "/u1"},
                    {"type": "outfit", "styleId": "outfit-1", "status": "generated", "imageSrc": "/u2"},
                    {"type": "aging", "styleId": "aging-1", "status": "generated", "imageSrc": "/u3"},
                ],
            }
        }
        assert ai_visuals_stage_complete(assessment, {"overall": {}}, {}) is True

    def test_variant_pending(self, monkeypatch):
        monkeypatch.setattr(
            "backend.pipeline_stage_checks._style_specs_for_type",
            lambda vtype, _cv, _ans: [type("S", (), {"style_id": f"{vtype}-1"})()],
        )
        assessment = {
            "aiVisuals": {
                "variants": [
                    {"type": "hair", "styleId": "hair-1", "status": "pending", "imageSrc": None},
                ],
            }
        }
        assert ai_visuals_stage_complete(assessment, {"overall": {}}, {}) is False


class TestParsingStageComplete:
    def test_complete_parsing(self):
        assessment = {
            "featureParsing": {
                "status": "ready",
                "crops": {"forehead": {"publicUrl": "/c"}},
            }
        }
        assert parsing_stage_complete(assessment) is True

    def test_missing_crops(self):
        assessment = {"featureParsing": {"status": "ready", "crops": {}}}
        assert parsing_stage_complete(assessment) is False
