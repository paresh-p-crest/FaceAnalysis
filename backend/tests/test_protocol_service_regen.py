import asyncio
from unittest.mock import AsyncMock, patch

from backend.protocol_service import (
    refresh_protocol_closing_for_assessment,
    regenerate_protocol_section,
)


def test_regenerate_feature_section_preserves_protocol_payload():
    assessment = {
        "id": "a-1",
        "analysis": {"cvReport": {"overall": {"scoreLabel": "balanced"}}},
        "answers": {},
        "featureNarratives": {
            "chin": {"summary": "old chin", "subsections": [{"title": "Chin", "body": "old"}]},
            "hair": {"summary": "hair", "subsections": [{"title": "Hair Style", "body": "ok"}]},
        },
        "protocolNarrative": {
            "summary": "old summary",
            "closing": ["old closing"],
            "features": {"chin": {"summary": "old chin"}},
            "treatmentPhases": {"phase01": {"title": "P1", "duration": "8 weeks", "items": [{"name": "A", "detail": "B"}]}, "phase02": {"title": "P2", "duration": "12 weeks", "items": [{"name": "A", "detail": "B"}]}, "phase03": {"title": "P3", "duration": "ongoing", "items": [{"name": "A", "detail": "B"}]}, "summary": "plan", "origin": "llm"},
            "de": {"summary": "alte zusammenfassung", "closing": ["alt"]},
            "customMeta": {"keep": True},
            "source": "orchestrator",
            "model": "gpt-x",
            "summaryOrigin": "llm",
            "closingOrigin": "llm",
        },
    }

    built = {
        "summary": "old summary",
        "closing": ["old closing"],
        "features": {"chin": {"summary": "new chin"}, "hair": {"summary": "hair"}},
        "treatmentPhases": assessment["protocolNarrative"]["treatmentPhases"],
        "source": "admin_section",
        "model": None,
        "summaryOrigin": "llm",
        "closingOrigin": "llm",
    }

    async def _run():
        with (
            patch(
                "backend.narrative_orchestrator.generate_feature_narrative_async",
                new=AsyncMock(return_value={"summary": "new chin", "subsections": [{"title": "Chin", "body": "new"}]}),
            ),
            patch(
                "backend.narrative_orchestrator.build_protocol_narrative_compat",
                return_value=built,
            ),
            patch(
                "backend.protocol_service.translate_protocol_section_de",
                new=AsyncMock(side_effect=lambda a, _s: a),
            ),
            patch(
                "backend.protocol_service.persist_protocol_bundle",
                new=AsyncMock(
                    side_effect=lambda _id, protocol_narrative, feature_narratives: {
                        "protocolNarrative": protocol_narrative,
                        "featureNarratives": feature_narratives,
                    }
                ),
            ),
        ):
            out = await regenerate_protocol_section(assessment, "chin")
            pn = out["protocolNarrative"]
            assert pn["de"] == {"summary": "alte zusammenfassung", "closing": ["alt"]}
            assert pn["customMeta"] == {"keep": True}
            assert pn["model"] == "gpt-x"
            assert pn["source"] == "admin_section"
            assert pn["features"]["chin"]["summary"] == "new chin"
            assert out["featureNarratives"]["chin"]["summary"] == "new chin"

    asyncio.run(_run())


def test_refresh_closing_preserves_protocol_payload_when_rebuild_needed():
    assessment = {
        "id": "a-2",
        "analysis": {"cvReport": {"overall": {"scoreLabel": "balanced"}}},
        "answers": {},
        "aiNarrative": {},
        "featureNarratives": {
            "chin": {"summary": "chin", "subsections": [{"title": "Chin", "body": "x"}]},
        },
        "protocolNarrative": {
            "summary": "old summary",
            "closing": ["old closing"],
            # no "features" key -> triggers rebuild branch
            "treatmentPhases": {"phase01": {"title": "P1", "duration": "8 weeks", "items": [{"name": "A", "detail": "B"}]}, "phase02": {"title": "P2", "duration": "12 weeks", "items": [{"name": "A", "detail": "B"}]}, "phase03": {"title": "P3", "duration": "ongoing", "items": [{"name": "A", "detail": "B"}]}, "summary": "plan", "origin": "llm"},
            "de": {"summary": "alte zusammenfassung", "closing": ["alt"]},
            "customMeta": {"keep": True},
            "source": "orchestrator",
            "model": "gpt-x",
            "summaryOrigin": "llm",
            "closingOrigin": "llm",
        },
    }

    rebuilt = {
        "summary": "old summary",
        "closing": ["new closing"],
        "features": {"chin": {"summary": "chin"}},
        "treatmentPhases": assessment["protocolNarrative"]["treatmentPhases"],
        "source": "orchestrator",
        "model": "gpt-x",
        "summaryOrigin": "llm",
        "closingOrigin": "llm",
    }

    async def _run():
        with (
            patch(
                "backend.narrative_orchestrator.generate_closing_synthesis_async",
                new=AsyncMock(return_value=["new closing"]),
            ),
            patch(
                "backend.narrative_orchestrator.build_protocol_narrative_compat",
                return_value=rebuilt,
            ),
            patch(
                "backend.protocol_service.translate_protocol_section_de",
                new=AsyncMock(side_effect=lambda a, _s: a),
            ),
            patch(
                "backend.protocol_service.persist_protocol_bundle",
                new=AsyncMock(
                    side_effect=lambda _id, protocol_narrative, feature_narratives: {
                        "protocolNarrative": protocol_narrative,
                        "featureNarratives": feature_narratives,
                    }
                ),
            ),
        ):
            out = await refresh_protocol_closing_for_assessment(assessment)
            pn = out["protocolNarrative"]
            assert pn["closing"] == ["new closing"]
            assert pn["de"] == {"summary": "alte zusammenfassung", "closing": ["alt"]}
            assert pn["customMeta"] == {"keep": True}
            assert pn["treatmentPhases"]["summary"] == "plan"

    asyncio.run(_run())
