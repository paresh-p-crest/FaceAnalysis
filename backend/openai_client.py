"""Port of openai.js — OpenAI API client for report generation.

Uses the openai Python SDK (httpx-based) to generate personalized
facial analysis reports from the same system/user prompt structure.
"""

from __future__ import annotations
import os
from typing import Optional

from openai import OpenAI

from .config import OPENAI_REPORT_MODEL
from .build_aws_report import format_answers_summary
from .llm_client import chat_json_completion, get_chat_llm


def _metrics_block(metrics: Optional[dict]) -> str:
    if not metrics:
        return ""
    lines = [
        f"Real CV measurements ({metrics.get('source', 'unknown')}):",
        f"- Symmetry: {metrics.get('symmetry', 'N/A')}%",
        f"- Harmony: {metrics.get('harmonyScore', 'N/A')}/100",
        f"- Proportionality: {metrics.get('proportionality', 'N/A')}%",
        f"- Visual age estimate: {metrics.get('visualAge', 'N/A')}",
        f"- Facial thirds (U/M/L): {metrics.get('upperThird', 'N/A')}/{metrics.get('middleThird', 'N/A')}/{metrics.get('lowerThird', 'N/A')}",
        f"- Jawline angle: {metrics.get('jawlineAngle', 'N/A')}°",
    ]
    if metrics.get("pose"):
        lines.append(f"- Pose: {metrics['pose']}")
    if metrics.get("quality"):
        lines.append(f"- Quality: {metrics['quality']}")
    lines.append("Use these real measured values in the report.")
    return "\n".join(lines)


def _score_line(label: str, data: Optional[dict]) -> Optional[str]:
    if not data:
        return None
    score = data.get("score")
    score_label = data.get("scoreLabel")
    details = []
    for key in (
        "shape",
        "widthHeightRatio",
        "upperThird",
        "middleThird",
        "lowerThird",
        "widthLengthRatio",
        "fullness",
        "jawShape",
        "chinType",
        "tone",
        "texture",
        "clarity",
    ):
        value = data.get(key)
        if value not in (None, ""):
            details.append(f"{key}: {value}")
    prefix = f"{label}: "
    if score is not None:
        prefix += f"{score}/100"
        if score_label:
            prefix += f" ({score_label})"
    else:
        prefix += "measured"
    if details:
        prefix += f" - {', '.join(details[:5])}"
    return prefix


def _cv_report_summary(cv_report: Optional[dict], metrics: Optional[dict]) -> str:
    if not cv_report:
        return "No structured cvReport available."

    lines = []
    overall = cv_report.get("overall") or {}
    if overall:
        lines.append(
            f"Overall: {overall.get('score', 'N/A')}/100 ({overall.get('scoreLabel', 'N/A')})"
        )

    for label, key in (
        ("Face shape", "faceShape"),
        ("Symmetry", "symmetry"),
        ("Proportions", "proportions"),
        ("Jaw and chin", "jawChin"),
        ("Nose", "nose"),
        ("Lips", "lips"),
        ("Skin", "skin"),
        ("Dimorphism", "dimorphism"),
        ("Averageness", "averageness"),
    ):
        line = _score_line(label, cv_report.get(key))
        if line:
            lines.append(line)

    if metrics:
        lines.extend(
            [
                f"Harmony score: {metrics.get('harmonyScore', 'N/A')}/100",
                f"Symmetry metric: {metrics.get('symmetry', 'N/A')}%",
                f"Proportionality metric: {metrics.get('proportionality', 'N/A')}%",
                f"Visual age estimate: {metrics.get('visualAge', 'N/A')}",
            ]
        )

    return "\n".join(lines)


def _lowest_scoring_features(cv_report: dict) -> list[str]:
    candidates = []
    for label, key in (
        ("symmetry", "symmetry"),
        ("proportions", "proportions"),
        ("jaw/chin", "jawChin"),
        ("nose", "nose"),
        ("lips", "lips"),
        ("skin", "skin"),
    ):
        score = (cv_report.get(key) or {}).get("score")
        if isinstance(score, (int, float)):
            candidates.append((score, label))
    return [label for _, label in sorted(candidates)[:3]]


SYSTEM_PROMPT = (
    "You are an expert aesthetic analyst writing a professional facial analysis report.\n"
    "Write in clean Markdown with sections: Executive Summary, Structural Analysis "
    "(proportions, symmetry, jawline, eyes, nose), Skin Quality, Top Strengths (3), "
    "Improvement Areas (3), Personalized 30-Day Protocol.\n"
    "Be specific, clinical yet accessible. Reference their questionnaire answers. "
    "Keep it 600-900 words.\n"
    "Do NOT use golden ratio mythology. Focus on proportionality, symmetry, and "
    "evidence-based non-surgical recommendations."
)


def generate_report(
    answers: dict,
    image_preview: Optional[str] = None,
    cv_metrics: Optional[dict] = None,
    cv_error: Optional[str] = None,
    face_details: Optional[dict] = None,
    protocol_warnings: Optional[list] = None,
    eye_analysis: Optional[dict] = None,
    api_key: Optional[str] = None,
) -> dict:
    """Generate a facial analysis report.

    Args:
        answers: User questionnaire answers.
        image_preview: Optional base64 data URL of the image.
        cv_metrics: Pre-computed CV metrics.
        cv_error: Any error from CV analysis.
        face_details: AWS face details (if AWS path).
        protocol_warnings: Protocol violation warnings.
        eye_analysis: Eye analysis results.
        api_key: OpenAI API key (falls back to env var).

    Returns:
        {"content": str|None, "source": str|None, "error": str|None}
    """
    if cv_error:
        return {"content": None, "source": None, "error": f"Analysis failed: {cv_error}"}

    if not cv_metrics:
        return {"content": None, "source": None, "error": "No analysis data available. Check credentials."}

    key = api_key or os.environ.get("OPENAI_API_KEY", "")
    if not key:
        return {"content": None, "source": None, "error": "OpenAI API key not set."}

    client = OpenAI(api_key=key)
    profile = format_answers_summary(answers)
    metrics_text = _metrics_block(cv_metrics)

    user_content = (
        f"Generate a facial analysis report for a client with these profile details:\n"
        f"- Goals: {profile['goals']}\n"
        f"- Skin concerns: {profile['concerns']}\n"
        f"- Concern severity: {profile['severity']}\n"
        f"- Ethnic heritage: {profile['ethnicity']}\n"
        f"- Skin type: {profile['skinType']}\n"
        f"- Skincare routine: {profile['skincareRoutine']}\n"
        f"- Occupation / environment: {profile['occupation']}\n"
        f"- Smoking: {profile['smoking']}\n"
        f"- Medical conditions: {profile['medicalConditions']}\n"
        f"- Age range: {profile['age']}\n"
        f"- Gender: {profile['gender']}\n\n"
        f"{metrics_text}"
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    try:
        response = client.chat.completions.create(
            model=OPENAI_REPORT_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1500,
        )
        content = response.choices[0].message.content
        if not content:
            return {"content": None, "source": None, "error": "Empty response from OpenAI"}
        return {"content": content, "source": "openai", "error": None}
    except Exception as e:
        return {"content": None, "source": None, "error": str(e) or "OpenAI report generation failed."}


NARRATIVE_SYSTEM_PROMPT = (
    "You are AuraScan's clinical aesthetic report writer. "
    "You write concise, careful explanations from deterministic MediaPipe/OpenCV results. "
    "Never invent, alter, or estimate measurements. Never recommend surgery, injectables, "
    "medical diagnosis, or guaranteed outcomes. Return only valid JSON."
)


def generate_cv_narrative(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict] = None,
    api_key: Optional[str] = None,
) -> dict:
    """Generate narrative copy grounded only in stored cvReport/metrics."""
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    llm = get_chat_llm(api_key_override=api_key)
    if llm.get("error"):
        return {"content": None, "source": None, "error": llm["error"]}

    profile = format_answers_summary(answers or {})
    cv_summary = _cv_report_summary(cv_report, metrics)
    priorities = ", ".join(_lowest_scoring_features(cv_report)) or "balanced maintenance"

    user_content = (
        "Create a concise JSON narrative for this AuraScan report.\n\n"
        "Required JSON schema:\n"
        "{\n"
        '  "summary": "2-3 sentences for the executive summary",\n'
        '  "strengths": ["3 short bullets grounded in scores"],\n'
        '  "focusAreas": ["3 short bullets grounded in the lowest measured areas"],\n'
        '  "recommendations": ["4 practical non-surgical recommendations"],\n'
        '  "disclaimer": "One sentence explaining this is educational and based on CV measurements"\n'
        "}\n\n"
        "Rules:\n"
        "- Mention numeric scores only if they appear below.\n"
        "- Do not create new measurements, ratios, ages, or scores.\n"
        "- Use plain, premium client-facing language.\n"
        "- Keep every bullet under 22 words.\n\n"
        f"Client profile:\n"
        f"- Goals: {profile['goals']}\n"
        f"- Skin concerns: {profile['concerns']}\n"
        f"- Severity: {profile['severity']}\n"
        f"- Skin type: {profile['skinType']}\n"
        f"- Routine: {profile['skincareRoutine']}\n"
        f"- Lifestyle/environment: {profile['occupation']}\n"
        f"- Sleep: {(answers or {}).get('sleepQuality', 'N/A')}\n"
        f"- Water intake: {(answers or {}).get('waterIntake', 'N/A')}\n"
        f"- Sun exposure: {(answers or {}).get('sunExposure', 'N/A')}\n\n"
        f"Lowest measured priorities: {priorities}\n\n"
        f"Stored CV report metrics:\n{cv_summary}"
    )

    result = chat_json_completion(
        messages=[
            {"role": "system", "content": NARRATIVE_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.35,
        max_tokens=900,
        api_key_override=api_key,
    )
    if result.get("error"):
        return {"content": None, "source": None, "error": result["error"]}
    return {
        "content": result["content"],
        "source": result["source"],
        "model": result["model"],
        "error": None,
    }
