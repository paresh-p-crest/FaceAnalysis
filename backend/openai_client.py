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
