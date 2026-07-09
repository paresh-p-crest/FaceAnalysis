"""Unified backend text AI — narrative, protocol, and Beauty Assistant."""

from __future__ import annotations


from .answer_summary import format_answers_summary
from .config import (
    ASSISTANT_RECENT_TURNS,
    ASSISTANT_SUMMARY_REFRESH_EVERY,
    PROTOCOL_FEATURE_IDS,
)
from .llm_client import chat_json_completion, chat_text_completion

STRICT_NON_SURGICAL_RULES = (
    "STRICT SAFETY RULES (always follow):\n"
    "- Coach ONLY on non-surgical skincare, grooming, lifestyle, nutrition, sleep, hydration, and SPF.\n"
    "- Use ONLY data supplied in this prompt. Never invent measurements, scores, ages, or diagnoses.\n"
    "- NEVER mention or recommend: surgery, injectables, fillers, Botox, lasers, prescriptions, "
    "clinical procedures, weight-loss drugs, or in-clinic treatments.\n"
    "- Refuse off-topic questions. Redirect to report-grounded routine coaching.\n"
    "- Do not discuss other people, politics, general chat, or unrelated products.\n"
    "- If data is missing, say what is missing and suggest a safe non-surgical next step."
)

ASSISTANT_SYSTEM_PROMPT = (
    "You are MyFace Beauty Assistant. Your ONLY role is coaching non-surgical skincare, grooming, "
    "and lifestyle routines based on THIS client's stored facial analysis report.\n\n"
    + STRICT_NON_SURGICAL_RULES
    + "\n\nKeep answers concise, practical, and premium-client friendly (under 120 words unless listing a routine)."
)

NARRATIVE_SYSTEM_PROMPT = (
    "You are MyFace's clinical aesthetic report writer. "
    "You write concise, careful explanations from deterministic MediaPipe/OpenCV results.\n"
    + STRICT_NON_SURGICAL_RULES
    + "\n\nReturn only valid JSON."
)

PROTOCOL_SYSTEM_PROMPT = (
    "You are an expert aesthetic analyst generating a personalized non-surgical facial improvement protocol.\n"
    + STRICT_NON_SURGICAL_RULES
    + "\n\nReturn ONLY valid JSON."
)

PROTOCOL_NARRATIVE_SYSTEM_PREFIX = (
    "You are an expert aesthetic analyst writing a Qoves-style personalised non-surgical facial protocol.\n"
    + STRICT_NON_SURGICAL_RULES
    + "\n\nRecommend only over-the-counter skincare actives, grooming, lifestyle, nutrition, and exercise. "
    "Do NOT name lasers, injectables, fillers, surgery, or in-clinic procedures.\n"
    "Return ONLY valid JSON."
)


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


def cv_report_summary(cv_report: Optional[dict], metrics: Optional[dict]) -> str:
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


def _profile_summary(answers: dict) -> str:
    profile = format_answers_summary(answers or {})
    return (
        f"Goals: {profile['goals']}; "
        f"Skin concerns: {profile['concerns']}; "
        f"Skin type: {profile['skinType']}; "
        f"Routine: {profile['skincareRoutine']}; "
        f"Sleep: {(answers or {}).get('sleepQuality', 'N/A')}; "
        f"Water: {(answers or {}).get('waterIntake', 'N/A')}; "
        f"Sun exposure: {(answers or {}).get('sunExposure', 'N/A')}."
    )


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


def _narrative_content(ai_narrative: Any) -> Optional[dict]:
    if not ai_narrative:
        return None
    if isinstance(ai_narrative, dict):
        return ai_narrative.get("content") or ai_narrative
    return None


def _compact_narrative(content: Optional[dict]) -> str:
    if not content or not isinstance(content, dict):
        return "Not available."
    parts = []
    if content.get("summary"):
        parts.append(f"Summary: {content['summary']}")
    for key, label in (
        ("strengths", "Strengths"),
        ("focusAreas", "Focus areas"),
        ("recommendations", "Recommendations"),
    ):
        items = content.get(key) or []
        if items:
            parts.append(f"{label}: " + "; ".join(str(item) for item in items[:4]))
    return "\n".join(parts) or "Not available."


def _compact_protocol_data(protocol_data: Any) -> str:
    if not protocol_data or not isinstance(protocol_data, dict):
        return "Not available."
    lines = []
    if protocol_data.get("summary"):
        lines.append(f"Summary: {protocol_data['summary']}")
    for rec in (protocol_data.get("recommendations") or [])[:6]:
        if not isinstance(rec, dict):
            continue
        lines.append(
            f"- [{rec.get('priority', 'medium')}] {rec.get('title', 'Recommendation')}: "
            f"{(rec.get('description') or '')[:180]}"
        )
    return "\n".join(lines) or "Not available."


def _compact_protocol_narrative(protocol_narrative: Any) -> str:
    if not protocol_narrative or not isinstance(protocol_narrative, dict):
        return "Not available."
    lines = []
    if protocol_narrative.get("summary"):
        lines.append(f"Overview: {protocol_narrative['summary']}")
    features = protocol_narrative.get("features") or {}
    for feature_id in PROTOCOL_FEATURE_IDS:
        feature = features.get(feature_id) or {}
        summary = feature.get("summary")
        if summary:
            lines.append(f"{feature_id}: {summary}")
    closing = protocol_narrative.get("closing") or []
    if closing:
        lines.append("Closing: " + " ".join(str(p)[:120] for p in closing[:2]))
    return "\n".join(lines) or "Not available."


def build_report_context(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    ai_narrative: Any = None,
    protocol_data: Any = None,
    protocol_narrative: Any = None,
) -> str:
    """Full static context for first assistant turn and summary refresh."""
    parts = [
        f"Client profile: {_profile_summary(answers)}",
        f"CV report metrics:\n{cv_report_summary(cv_report, metrics)}",
        f"Executive AI narrative:\n{_compact_narrative(_narrative_content(ai_narrative))}",
        f"Protocol recommendations:\n{_compact_protocol_data(protocol_data)}",
        f"Protocol narrative:\n{_compact_protocol_narrative(protocol_narrative)}",
    ]
    return "\n\n".join(parts)


def template_protocol(cv_report: Optional[dict]) -> dict:
    """Non-AI protocol fallback grounded in cvReport scores."""
    recommendations = []
    report = cv_report or {}

    if (report.get("jawChin") or {}).get("score", 100) < 80:
        recommendations.append(
            {
                "title": "Facial muscle exercises",
                "description": "Jawline and neck stretches for 10 minutes daily can support lower-face definition alongside posture work.",
                "priority": "high",
                "category": "exercise",
            }
        )
    if (report.get("symmetry") or {}).get("score", 100) < 80:
        recommendations.append(
            {
                "title": "Sleep position awareness",
                "description": "Back sleeping reduces overnight facial pressure that can accentuate asymmetry over time.",
                "priority": "medium",
                "category": "lifestyle",
            }
        )
    if (report.get("skin") or {}).get("score", 100) < 85:
        recommendations.append(
            {
                "title": "Skincare routine optimization",
                "description": "Daily SPF 30+, gentle cleanser, and a consistent evening moisturizer support measurable skin quality gains.",
                "priority": "high",
                "category": "skincare",
            }
        )

    recommendations.extend(
        [
            {
                "title": "Daily sunscreen",
                "description": "Broad-spectrum SPF 30+ every morning is the highest-impact non-surgical anti-aging habit.",
                "priority": "high",
                "category": "skincare",
            },
            {
                "title": "Hydration and nutrition",
                "description": "Adequate water, omega-3s, and reduced processed sugar support skin clarity from within.",
                "priority": "medium",
                "category": "nutrition",
            },
            {
                "title": "Quality sleep",
                "description": "Seven to nine hours of consistent sleep supports recovery, under-eye appearance, and skin repair.",
                "priority": "medium",
                "category": "lifestyle",
            },
        ]
    )

    return {
        "summary": "A personalized non-surgical protocol based on your stored facial analysis scores.",
        "recommendations": recommendations,
    }


def _fallback_assistant_answer(question: str, cv_report: dict, answers: dict) -> str:
    summary_bits = []
    overall = cv_report.get("overall") or {}
    if overall.get("score") is not None:
        summary_bits.append(f"overall score {overall.get('score')}/100")
    for label, key in (
        ("symmetry", "symmetry"),
        ("skin", "skin"),
        ("jaw/chin", "jawChin"),
    ):
        score = (cv_report.get(key) or {}).get("score")
        if score is not None:
            summary_bits.append(f"{label} {score}/100")
    measured = ", ".join(summary_bits[:4]) or "your stored facial analysis"
    q = question.lower()
    if any(word in q for word in ("surgery", "filler", "botox", "laser", "inject")):
        return (
            "I can only coach non-surgical skincare, grooming, and lifestyle routines from your MyFace report. "
            "Please ask about SPF, cleansing, hydration, sleep, or grooming habits tied to your measured focus areas."
        )
    if "skin" in q:
        focus = "Prioritize daily SPF, gentle cleansing, consistent moisturizer, and steady hydration."
    elif "hair" in q or "style" in q:
        face_shape = (cv_report.get("faceShape") or {}).get("shape", "your measured face shape")
        focus = f"Choose cuts that complement {face_shape} and keep framing balanced around the forehead and jawline."
    else:
        focus = "Start with your lowest-scoring measured areas and reassess after 30 days with the same photo protocol."
    return (
        f"Based on {measured}, {focus} "
        "I use only your stored MyFace measurements and do not create new scores or diagnose conditions."
    )


def generate_cv_narrative(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict] = None,
    api_key: Optional[str] = None,
) -> dict:
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    profile = format_answers_summary(answers or {})
    cv_summary = cv_report_summary(cv_report, metrics)
    priorities = ", ".join(_lowest_scoring_features(cv_report)) or "balanced maintenance"

    user_content = (
        "Create a concise JSON narrative for this MyFace report.\n\n"
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
        "- Keep every bullet under 22 words.\n\n"
        f"Client profile:\n"
        f"- Goals: {profile['goals']}\n"
        f"- Skin concerns: {profile['concerns']}\n"
        f"- Skin type: {profile['skinType']}\n"
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


def generate_protocol(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict] = None,
    api_key: Optional[str] = None,
) -> dict:
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    profile = format_answers_summary(answers or {})
    cv_summary = cv_report_summary(cv_report, metrics)

    user_content = (
        "Produce JSON with schema:\n"
        "{\n"
        '  "summary": "1-2 sentence overview",\n'
        '  "recommendations": [\n'
        '    {"title": "...", "description": "...", "priority": "high|medium|low", '
        '"category": "skincare|lifestyle|exercise|grooming|nutrition"}\n'
        "  ]\n"
        "}\n\n"
        "Generate 5-8 non-surgical recommendations prioritized by lowest scores.\n\n"
        f"Goals: {profile['goals']}\n"
        f"Skin concerns: {profile['concerns']}\n"
        f"Skin type: {profile['skinType']}\n"
        f"Age: {profile['age']}\n"
        f"Gender: {profile['gender']}\n\n"
        f"CV scores:\n{cv_summary}"
    )

    result = chat_json_completion(
        messages=[
            {"role": "system", "content": PROTOCOL_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        temperature=0.5,
        max_tokens=1200,
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


def _protocol_narrative_schema() -> str:
    feature_example = (
        '{"subsections": [{"title": "...", "body": "80-120 word paragraph"}], "summary": "one line"}'
    )
    features = ", ".join(f'"{fid}": {feature_example}' for fid in PROTOCOL_FEATURE_IDS)
    return (
        '{"summary": "2-3 sentences", "closing": ["paragraph 1", "paragraph 2", "paragraph 3", "paragraph 4"], '
        f'"features": {{{features}}}}}'
    )


def generate_protocol_narrative(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict] = None,
    api_key: Optional[str] = None,
) -> dict:
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    profile = format_answers_summary(answers or {})
    cv_summary = cv_report_summary(cv_report, metrics)
    feature_list = ", ".join(PROTOCOL_FEATURE_IDS)

    system_content = (
        f"{PROTOCOL_NARRATIVE_SYSTEM_PREFIX}\n\n"
        f"All feature keys required: {feature_list}.\n"
        f"Schema:\n{_protocol_narrative_schema()}\n\n"
        "Rules:\n"
        "- Each subsection body: 80-120 words, dense narrative (not bullets).\n"
        "- Name OTC actives with frequencies: salicylic acid, vitamin C, retinol, SPF 50.\n"
        "- Eyes feature MUST have 4 subsections: Eyebrows, Eyelashes, Eyes, Under eye.\n"
        "- Reference actual CV scores only.\n"
        "- closing: 4 dense non-surgical paragraphs."
    )

    user_content = (
        f"Goals: {profile['goals']}\n"
        f"Skin concerns: {profile['concerns']}\n"
        f"Skin type: {profile['skinType']}\n"
        f"Routine: {profile['skincareRoutine']}\n"
        f"Age: {profile['age']}\n"
        f"Gender: {profile['gender']}\n\n"
        f"CV Analysis:\n{cv_summary}"
    )

    result = chat_json_completion(
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ],
        temperature=0.45,
        max_tokens=4000,
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


def _count_user_messages(messages: list[dict]) -> int:
    return sum(1 for message in messages if message.get("role") == "user")


def _recent_turns(messages: list[dict], limit: int = ASSISTANT_RECENT_TURNS) -> list[dict]:
    turns = []
    for message in messages[-limit:]:
        role = message.get("role")
        content = message.get("content")
        if role in ("user", "assistant") and content:
            turns.append({"role": role, "content": content})
    return turns


def summarize_assistant_session(
    *,
    report_context: str,
    messages: list[dict],
    api_key: Optional[str] = None,
) -> dict:
    transcript = []
    for message in messages:
        role = message.get("role")
        content = message.get("content")
        if role in ("user", "assistant") and content:
            transcript.append(f"{role}: {content}")
    if not transcript:
        return {"content": None, "error": "No messages to summarize."}

    user_content = (
        "Summarize this Beauty Assistant session for future context compression.\n"
        "Max 200 words. Capture goals, topics discussed, and non-surgical recommendations given.\n"
        "Do not add new advice.\n\n"
        f"Report reference (do not expand beyond this):\n{report_context[:1200]}\n\n"
        "Conversation:\n" + "\n".join(transcript)
    )

    result = chat_text_completion(
        messages=[
            {
                "role": "system",
                "content": "You compress coaching conversations. Output plain text only.",
            },
            {"role": "user", "content": user_content},
        ],
        temperature=0.2,
        max_tokens=350,
        api_key_override=api_key,
    )
    return result


def answer_beauty_question(
    *,
    question: str,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    history: Optional[list[dict]] = None,
    ai_narrative: Any = None,
    protocol_data: Any = None,
    protocol_narrative: Any = None,
    session_summary: Optional[str] = None,
    summary_at_user_count: int = 0,
    api_key: Optional[str] = None,
) -> dict:
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    prior_user_count = _count_user_messages(history or [])
    report_context = build_report_context(
        answers=answers,
        cv_report=cv_report,
        metrics=metrics,
        ai_narrative=ai_narrative,
        protocol_data=protocol_data,
        protocol_narrative=protocol_narrative,
    )

    use_summary = bool(session_summary) and prior_user_count >= 1
    recent = _recent_turns(history or [])

    if use_summary:
        context_block = (
            f"Session summary (covers earlier coaching):\n{session_summary}\n\n"
            "Answer using the summary and recent turns only. "
            "Stay on report-grounded non-surgical routine coaching."
        )
    else:
        context_block = (
            f"Stored MyFace report context:\n{report_context}\n\n"
            "Answer using this context only."
        )

    messages = [
        {"role": "system", "content": ASSISTANT_SYSTEM_PROMPT},
        {"role": "user", "content": context_block},
        *recent,
        {"role": "user", "content": question},
    ]

    result = chat_text_completion(
        messages=messages,
        temperature=0.25,
        max_tokens=550,
        api_key_override=api_key,
    )

    if result.get("error") or not result.get("content"):
        return {
            "content": _fallback_assistant_answer(question, cv_report, answers),
            "source": "template",
            "model": None,
            "error": result.get("error"),
            "should_refresh_summary": False,
            "session_summary": session_summary,
            "summary_at_user_count": summary_at_user_count,
        }

    new_user_count = prior_user_count + 1
    should_refresh = (
        new_user_count == 1
        or (session_summary and new_user_count - summary_at_user_count >= ASSISTANT_SUMMARY_REFRESH_EVERY)
        or (session_summary and new_user_count >= ASSISTANT_SUMMARY_REFRESH_EVERY and summary_at_user_count == 0)
    )

    updated_summary = session_summary
    updated_summary_at = summary_at_user_count

    if should_refresh:
        combined = list(history or []) + [
            {"role": "user", "content": question},
            {"role": "assistant", "content": result["content"]},
        ]
        summary_result = summarize_assistant_session(
            report_context=report_context,
            messages=combined,
            api_key=api_key,
        )
        if summary_result.get("content"):
            updated_summary = summary_result["content"]
            updated_summary_at = new_user_count

    return {
        "content": result["content"],
        "source": result.get("source"),
        "model": result.get("model"),
        "error": None,
        "session_summary": updated_summary,
        "summary_at_user_count": updated_summary_at,
        "should_refresh_summary": should_refresh,
    }
