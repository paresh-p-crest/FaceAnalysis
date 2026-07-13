"""LangGraph-style ReAct Beauty Assistant agent with report fetch tools."""

from __future__ import annotations

import json
from typing import Any, Optional

from .assistant_tools import OPENAI_TOOL_DEFINITIONS, AssessmentTools
from .config import ASSISTANT_RECENT_TURNS, ASSISTANT_SUMMARY_REFRESH_EVERY
from .llm_client import chat_text_completion
from .report_sections import protocol_bundle_summary
from .text_ai_service import (
    ASSISTANT_SYSTEM_PROMPT,
    _count_user_messages,
    _recent_turns,
    summarize_assistant_session,
)

MAX_TOOL_ROUNDS = 3


def _build_seed_context(assessment: dict) -> str:
    analysis = assessment.get("analysis") or {}
    cv = analysis.get("cvReport") or {}
    overall = cv.get("overall") or {}
    answers = assessment.get("answers") or {}
    name = answers.get("name") or answers.get("fullName") or "Client"
    goals = answers.get("goals") or []
    if isinstance(goals, list):
        goals_str = ", ".join(str(g) for g in goals[:3])
    else:
        goals_str = str(goals)

    low_scores = []
    for label, key in (
        ("symmetry", "symmetry"),
        ("skin", "skin"),
        ("nose", "nose"),
        ("jaw", "jaw"),
        ("hair", "hair"),
    ):
        score = (cv.get(key) or {}).get("score")
        if isinstance(score, (int, float)):
            low_scores.append((score, label))
    low_scores.sort(key=lambda x: x[0])
    lowest = ", ".join(f"{lbl} {sc}/100" for sc, lbl in low_scores[:3])

    not_measured = [
        "iris/eye color (sclera metrics only)",
        "hair density/color without top-of-head photo",
    ]
    bundle_meta = protocol_bundle_summary(assessment)
    tool_index = ", ".join(bundle_meta.get("toolIndex") or [])[:500]

    return (
        f"You are speaking with {name}\n"
        f"Goals: {goals_str or 'N/A'}\n"
        f"Overall harmony: {overall.get('score', 'N/A')}/100\n"
        f"Lowest areas: {lowest or 'N/A'}\n"
        f"Not measured: {'; '.join(not_measured)}\n"
        f"Available tools: {tool_index}\n"
        "Use tools to fetch report sections before answering factual or protocol questions. "
        "Always reply in second person (you/your) with no technical implementation details."
    )


def _run_tool_loop(
    tools: AssessmentTools,
    messages: list[dict],
    *,
    api_key: Optional[str] = None,
) -> dict:
    working = list(messages)
    source = None
    model = None

    for _ in range(MAX_TOOL_ROUNDS):
        result = chat_text_completion(
            messages=working,
            temperature=0.25,
            max_tokens=1000,
            tools=OPENAI_TOOL_DEFINITIONS,
            api_key_override=api_key,
            label="beauty_assistant/tools",
        )
        if result.get("error") and not result.get("tool_calls"):
            return result

        source = result.get("source") or source
        model = result.get("model") or model
        tool_calls = result.get("tool_calls")

        if not tool_calls:
            if result.get("content"):
                return {
                    "content": result["content"],
                    "source": source,
                    "model": model,
                    "error": None,
                }
            return {"content": None, "source": source, "model": model, "error": "Empty assistant response"}

        assistant_msg: dict[str, Any] = {"role": "assistant", "content": result.get("content") or ""}
        assistant_msg["tool_calls"] = [
            {
                "id": tc["id"],
                "type": "function",
                "function": {"name": tc["name"], "arguments": tc["arguments"]},
            }
            for tc in tool_calls
        ]
        working.append(assistant_msg)

        for tc in tool_calls:
            try:
                args = json.loads(tc["arguments"] or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_result = tools.dispatch(tc["name"], args)
            working.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": tool_result[:8000],
                }
            )

    final = chat_text_completion(
        messages=working,
        temperature=0.25,
        max_tokens=1000,
        api_key_override=api_key,
        label="beauty_assistant/final",
    )
    return {
        "content": final.get("content"),
        "source": final.get("source") or source,
        "model": final.get("model") or model,
        "error": final.get("error"),
    }


def run_assistant_agent(
    *,
    question: str,
    assessment: dict,
    history: Optional[list[dict]] = None,
    session_summary: Optional[str] = None,
    summary_at_user_count: int = 0,
    api_key: Optional[str] = None,
) -> dict:
    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    if not cv_report:
        return {"content": None, "source": None, "error": "cvReport is required."}

    prior_user_count = _count_user_messages(history or [])
    seed = _build_seed_context(assessment)
    use_summary = bool(session_summary) and prior_user_count >= 1
    recent = _recent_turns(history or [])

    system = (
        ASSISTANT_SYSTEM_PROMPT
        + "\n\nYou have tools to fetch report sections. "
        "For factual questions (scores, colors, measurements), call get_cv_feature or get_cv_assessment first. "
        "For routine/protocol coaching, call get_protocol_feature, get_protocol_overview, or get_protocol_closing. "
        "Never invent metrics. If not measured, say so clearly."
    )

    if use_summary:
        context_block = (
            f"Session context:\n{seed}\n\n"
            f"Session summary:\n{session_summary}\n\n"
            "Use summary + tools for this reply."
        )
    else:
        context_block = f"Report seed:\n{seed}"

    messages: list[dict] = [{"role": "system", "content": system}]
    for turn in recent:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append(
        {
            "role": "user",
            "content": f"{context_block}\n\nUser question: {question}",
        }
    )

    tools = AssessmentTools(assessment)
    result = _run_tool_loop(tools, messages, api_key=api_key)

    if not result.get("content"):
        # Do not invent a template reply — surface failure to the API layer.
        return {
            "content": None,
            "source": result.get("source"),
            "model": result.get("model"),
            "error": result.get("error") or "Beauty Assistant is not working right now.",
            "session_summary": None,
            "should_refresh_summary": False,
            "summary_at_user_count": summary_at_user_count,
        }

    should_refresh = (
        prior_user_count > 0
        and (prior_user_count - summary_at_user_count) >= ASSISTANT_SUMMARY_REFRESH_EVERY
    )
    session_summary_out = None
    if should_refresh:
        all_messages = list(history or []) + [
            {"role": "user", "content": question},
            {"role": "assistant", "content": result["content"]},
        ]
        summary_result = summarize_assistant_session(
            report_context=seed,
            messages=all_messages,
            api_key=api_key,
        )
        if summary_result.get("content"):
            session_summary_out = summary_result["content"]

    return {
        "content": result["content"],
        "source": result.get("source"),
        "model": result.get("model"),
        "error": None,
        "session_summary": session_summary_out,
        "should_refresh_summary": bool(session_summary_out),
        "summary_at_user_count": prior_user_count + 1 if session_summary_out else summary_at_user_count,
    }
