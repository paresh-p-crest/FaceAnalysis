"""Beauty Assistant chat grounded on stored cvReport data."""

from __future__ import annotations

import os
from typing import Optional

from openai import OpenAI

from .config import OPENAI_REPORT_MODEL
from .openai_client import _cv_report_summary


ASSISTANT_SYSTEM_PROMPT = (
    "You are AuraScan Beauty Assistant. You answer questions using only the supplied "
    "MediaPipe/OpenCV cvReport, metrics, questionnaire answers, and previous chat turns. "
    "Never invent new measurements, scores, diagnoses, or treatment outcomes. "
    "Do not recommend surgery, injectables, prescriptions, or medical diagnosis. "
    "If the report does not contain enough data, say what is missing and suggest a safe next step. "
    "Keep answers concise, practical, and premium-client friendly."
)


def _profile_summary(answers: dict) -> str:
    return (
        f"Goals: {answers.get('goals', 'N/A')}; "
        f"Skin concerns: {answers.get('skinConcerns', 'N/A')}; "
        f"Skin type: {answers.get('skinType', 'N/A')}; "
        f"Sleep: {answers.get('sleepQuality', 'N/A')}; "
        f"Water: {answers.get('waterIntake', 'N/A')}; "
        f"Sun exposure: {answers.get('sunExposure', 'N/A')}."
    )


def _fallback_answer(question: str, cv_report: dict, metrics: Optional[dict], answers: dict) -> str:
    summary_bits = []
    overall = cv_report.get("overall") or {}
    if overall.get("score") is not None:
        summary_bits.append(f"overall score {overall.get('score')}/100")
    for label, key in (
        ("symmetry", "symmetry"),
        ("proportions", "proportions"),
        ("skin", "skin"),
        ("jaw/chin", "jawChin"),
        ("nose", "nose"),
        ("lips", "lips"),
    ):
        score = (cv_report.get(key) or {}).get("score")
        if score is not None:
            summary_bits.append(f"{label} {score}/100")
    measured = ", ".join(summary_bits[:6]) or "the stored facial analysis"
    q = question.lower()
    if "skin" in q:
        focus = "For skin, prioritize daily SPF, gentle cleansing, consistent moisturizer, and avoiding harsh exfoliation unless a professional advises it."
    elif "hair" in q or "style" in q:
        face_shape = (cv_report.get("faceShape") or {}).get("shape", "your measured face shape")
        focus = f"For hair styling, choose cuts that complement {face_shape}; keep volume and framing balanced around the forehead and jawline."
    elif "aging" in q or "younger" in q:
        focus = "For healthy aging, focus on sleep consistency, SPF, hydration, strength training, and a simple retinoid discussion with a licensed professional if appropriate."
    elif "improve" in q or "best" in q:
        focus = "Start with the lowest scoring measured areas, then reassess after 30 days using the same photo protocol."
    else:
        focus = "Ask about a specific area such as skin, hair, symmetry, jawline, or proportions for more targeted guidance."
    return (
        f"Based on {measured}, {focus} "
        "I am using only the stored AuraScan measurements here, so I will not create new scores or diagnose conditions."
    )


def answer_beauty_question(
    *,
    question: str,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    history: Optional[list[dict]] = None,
) -> dict:
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return {
            "content": _fallback_answer(question, cv_report, metrics, answers),
            "source": "template",
            "model": None,
            "error": None,
        }

    report_summary = _cv_report_summary(cv_report, metrics)
    profile = _profile_summary(answers or {})
    recent_turns = []
    for message in (history or [])[-8:]:
        role = message.get("role")
        content = message.get("content")
        if role in ("user", "assistant") and content:
            recent_turns.append({"role": role, "content": content})

    messages = [
        {"role": "system", "content": ASSISTANT_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Stored AuraScan context:\n"
                f"Client profile: {profile}\n\n"
                f"cvReport/metrics:\n{report_summary}\n\n"
                "Answer future questions from this context only."
            ),
        },
        *recent_turns,
        {"role": "user", "content": question},
    ]

    try:
        client = OpenAI(api_key=key)
        response = client.chat.completions.create(
            model=OPENAI_REPORT_MODEL,
            messages=messages,
            temperature=0.25,
            max_tokens=550,
        )
        content = response.choices[0].message.content
        if not content:
            return {"content": None, "source": None, "error": "Empty response from OpenAI"}
        return {"content": content, "source": "openai", "model": OPENAI_REPORT_MODEL, "error": None}
    except Exception as exc:
        return {
            "content": _fallback_answer(question, cv_report, metrics, answers),
            "source": "template",
            "model": None,
            "error": str(exc) or "OpenAI assistant unavailable.",
        }
