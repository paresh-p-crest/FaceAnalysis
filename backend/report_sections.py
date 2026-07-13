"""Format stored assessment sections for PDF bundle, admin review, and assistant tools."""

from __future__ import annotations

import json
from typing import Any, Optional

from .config import FEATURE_NARRATIVE_IDS, PROTOCOL_FEATURE_IDS
from .feature_context import build_feature_context, feature_context_as_prompt_text
from .protocol_page_schema import PROTOCOL_PAGE_META, subsection_titles_for_feature

INTERACTIVE_FEATURE_IDS = (
    "eyebrows",
    "eyes",
    "nose",
    "lips",
    "cheeks",
    "jaw",
    "chin",
    "hair",
    "smile",
    "neck",
    "ears",
    "skin",
)

ASSESSMENT_SECTION_IDS = ("dimorphism", "averageness", "proportions", "symmetry", "faceShape")


def format_cv_assessment_section(cv_report: dict, section_id: str) -> str:
    data = (cv_report or {}).get(section_id)
    if not data:
        return f"No data for section {section_id}."
    clean = {k: v for k, v in data.items() if k not in ("imageSrc", "symmetryDots") and not str(k).startswith("overlay")}
    return json.dumps(clean, default=str, indent=2)[:4000]


def format_cv_feature_section(
    cv_report: dict,
    feature_id: str,
    eye_analysis: Optional[dict] = None,
) -> str:
    if feature_id in FEATURE_NARRATIVE_IDS:
        ctx = build_feature_context(
            feature_id,
            cv_report=cv_report,
            eye_analysis=eye_analysis,
            answers={},
        )
        return feature_context_as_prompt_text(ctx)
    key = feature_id
    if feature_id == "eyebrows":
        data = cv_report.get("eyebrows")
    elif feature_id == "eyes":
        return json.dumps(eye_analysis or {}, default=str)[:4000]
    else:
        data = cv_report.get(key)
    if not data:
        return f"No CV data for {feature_id}."
    clean = {k: v for k, v in data.items() if "image" not in k.lower() and not str(v).startswith("data:")}
    return json.dumps(clean, default=str, indent=2)[:4000]


def format_protocol_feature(
    feature_id: str,
    feature_narratives: Optional[dict],
    protocol_narrative: Optional[dict],
) -> str:
    fn = (feature_narratives or {}).get(feature_id)
    if not fn and protocol_narrative:
        fn = (protocol_narrative.get("features") or {}).get(feature_id)
    if not fn:
        return f"No protocol narrative for {feature_id}."
    lines = [
        f"Summary: {fn.get('summary', '')}",
        f"Description: {fn.get('description', '')}",
        f"Measured facts: {json.dumps(fn.get('measuredFacts') or [])}",
    ]
    for sub in fn.get("subsections") or []:
        lines.append(f"\n## {sub.get('title')}\n{sub.get('body')}")
    return "\n".join(lines)[:8000]


def build_assistant_tool_index() -> list[str]:
    tools = [
        "get_questionnaire",
        "get_executive_narrative",
        "get_protocol_overview",
        "get_protocol_closing",
    ]
    for sid in ASSESSMENT_SECTION_IDS:
        tools.append(f"get_cv_assessment:{sid}")
    for fid in INTERACTIVE_FEATURE_IDS:
        tools.append(f"get_cv_feature:{fid}")
    for fid in FEATURE_NARRATIVE_IDS:
        tools.append(f"get_protocol_feature:{fid}")
    return tools


def protocol_bundle_summary(assessment: dict) -> dict:
    analysis = assessment.get("analysis") or {}
    cv = analysis.get("cvReport") or {}
    overall = cv.get("overall") or {}
    return {
        "pages": PROTOCOL_PAGE_META,
        "overallScore": overall.get("score"),
        "featureIds": list(PROTOCOL_FEATURE_IDS),
        "narrativeFeatureIds": list(FEATURE_NARRATIVE_IDS),
        "subsectionTitles": {fid: subsection_titles_for_feature(fid) for fid in FEATURE_NARRATIVE_IDS},
        "toolIndex": build_assistant_tool_index(),
    }
