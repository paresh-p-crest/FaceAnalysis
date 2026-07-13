"""Assessment-grounded tools for Beauty Assistant agent."""

from __future__ import annotations

import json
from typing import Optional

from .answer_summary import format_answers_summary
from .config import FEATURE_NARRATIVE_IDS, PROTOCOL_FEATURE_IDS
from .protocol_service import load_protocol_bundle
from .report_sections import (
    ASSESSMENT_SECTION_IDS,
    INTERACTIVE_FEATURE_IDS,
    format_cv_assessment_section,
    format_cv_feature_section,
    format_protocol_feature,
)


class AssessmentTools:
    """Tool implementations reading a single assessment bundle."""

    def __init__(self, assessment: dict):
        self.assessment = assessment
        analysis = assessment.get("analysis") or {}
        self.cv_report = analysis.get("cvReport") or {}
        self.eye_analysis = analysis.get("eyeAnalysis")
        self.answers = assessment.get("answers") or {}
        self.metrics = analysis.get("metrics")
        bundle = load_protocol_bundle(assessment.get("id", ""), assessment) or {}
        self.protocol_narrative = bundle.get("protocolNarrative") or assessment.get("protocolNarrative")
        self.feature_narratives = bundle.get("featureNarratives") or assessment.get("featureNarratives") or {}

    def get_questionnaire(self) -> str:
        profile = format_answers_summary(self.answers)
        return json.dumps(profile, default=str)

    def get_executive_narrative(self) -> str:
        narrative = self.assessment.get("aiNarrative") or {}
        content = narrative.get("content") if isinstance(narrative, dict) else narrative
        return json.dumps(content or {}, default=str)

    def get_protocol_overview(self) -> str:
        pn = self.protocol_narrative or {}
        scores = []
        for fid in PROTOCOL_FEATURE_IDS:
            data = self.cv_report.get(fid) or self.cv_report.get("jawChin" if fid in ("jaw", "chin") else fid)
            if isinstance(data, dict) and data.get("score") is not None:
                scores.append(f"{fid}: {data['score']}/100")
        return json.dumps(
            {"summary": pn.get("summary"), "featureScores": scores},
            default=str,
        )

    def get_protocol_closing(self) -> str:
        closing = (self.protocol_narrative or {}).get("closing") or []
        return json.dumps(closing, default=str)

    def get_cv_assessment(self, section_id: str) -> str:
        if section_id not in ASSESSMENT_SECTION_IDS:
            return f"Unknown assessment section: {section_id}"
        return format_cv_assessment_section(self.cv_report, section_id)

    def get_cv_feature(self, feature_id: str, subsection: Optional[str] = None) -> str:
        if feature_id not in INTERACTIVE_FEATURE_IDS:
            return f"Unknown feature: {feature_id}"
        text = format_cv_feature_section(self.cv_report, feature_id, self.eye_analysis)
        if subsection:
            return f"[subsection filter: {subsection}]\n{text}"
        return text

    def get_protocol_feature(self, feature_id: str, subsection: Optional[str] = None) -> str:
        if feature_id not in FEATURE_NARRATIVE_IDS:
            return f"Unknown protocol feature: {feature_id}"
        text = format_protocol_feature(feature_id, self.feature_narratives, self.protocol_narrative)
        if subsection:
            return f"[subsection filter: {subsection}]\n{text}"
        return text

    def dispatch(self, name: str, arguments: dict) -> str:
        if name == "get_questionnaire":
            return self.get_questionnaire()
        if name == "get_executive_narrative":
            return self.get_executive_narrative()
        if name == "get_protocol_overview":
            return self.get_protocol_overview()
        if name == "get_protocol_closing":
            return self.get_protocol_closing()
        if name == "get_cv_assessment":
            return self.get_cv_assessment(arguments.get("section_id", ""))
        if name == "get_cv_feature":
            return self.get_cv_feature(arguments.get("feature_id", ""), arguments.get("subsection"))
        if name == "get_protocol_feature":
            return self.get_protocol_feature(arguments.get("feature_id", ""), arguments.get("subsection"))
        return f"Unknown tool: {name}"


OPENAI_TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "get_questionnaire", "description": "Full client questionnaire summary", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_executive_narrative", "description": "Executive AI narrative (summary, strengths, focus)", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_protocol_overview", "description": "Protocol overview summary and feature scores", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_protocol_closing", "description": "Closing protocol paragraphs", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {
        "type": "function",
        "function": {
            "name": "get_cv_assessment",
            "description": "CV assessment section: dimorphism, averageness, proportions, symmetry, faceShape",
            "parameters": {
                "type": "object",
                "properties": {"section_id": {"type": "string", "enum": list(ASSESSMENT_SECTION_IDS)}},
                "required": ["section_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cv_feature",
            "description": "Measured CV facts for a facial feature (interactive report)",
            "parameters": {
                "type": "object",
                "properties": {
                    "feature_id": {"type": "string", "enum": list(INTERACTIVE_FEATURE_IDS)},
                    "subsection": {"type": "string"},
                },
                "required": ["feature_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_protocol_feature",
            "description": "PDF protocol coaching narrative for a feature",
            "parameters": {
                "type": "object",
                "properties": {
                    "feature_id": {"type": "string", "enum": list(FEATURE_NARRATIVE_IDS)},
                    "subsection": {"type": "string"},
                },
                "required": ["feature_id"],
                "additionalProperties": False,
            },
        },
    },
]
