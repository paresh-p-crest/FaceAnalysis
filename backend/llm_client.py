"""LLM provider config — OpenAI or Groq (OpenAI-compatible API)."""

from __future__ import annotations

import json
import os
import re
from typing import Optional

from openai import OpenAI

from .config import GROQ_MODEL, OPENAI_REPORT_MODEL


def resolve_llm_provider() -> str:
    explicit = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if explicit in ("openai", "groq"):
        return explicit
    if os.environ.get("GROQ_API_KEY", "").strip():
        return "groq"
    return "openai"


def get_chat_llm(*, api_key_override: Optional[str] = None) -> dict:
    """Return {client, model, source} or {error}."""
    provider = resolve_llm_provider()

    if provider == "groq":
        key = (api_key_override or os.environ.get("GROQ_API_KEY", "")).strip()
        if not key:
            return {
                "error": "Groq API key not set. Add GROQ_API_KEY to backend/.env and set LLM_PROVIDER=groq."
            }
        return {
            "client": OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1"),
            "model": os.environ.get("GROQ_MODEL", GROQ_MODEL).strip() or GROQ_MODEL,
            "source": "groq",
            "error": None,
        }

    key = (api_key_override or os.environ.get("OPENAI_API_KEY", "")).strip()
    if not key:
        return {
            "error": "OpenAI API key not set. Add OPENAI_API_KEY to backend/.env or switch to Groq."
        }
    return {
        "client": OpenAI(api_key=key),
        "model": os.environ.get("OPENAI_REPORT_MODEL", OPENAI_REPORT_MODEL).strip() or OPENAI_REPORT_MODEL,
        "source": "openai",
        "error": None,
    }


def _extract_json_object(raw: str) -> dict:
    text = (raw or "").strip()
    if not text:
        raise ValueError("Empty LLM response")
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


def chat_structured_completion(
    *,
    schema_name: str,
    json_schema: dict,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    api_key_override: Optional[str] = None,
) -> dict:
    """Chat completion with OpenAI strict json_schema; Groq falls back to json_object."""
    llm = get_chat_llm(api_key_override=api_key_override)
    if llm.get("error"):
        return {"content": None, "source": None, "model": None, "error": llm["error"]}

    client = llm["client"]
    model = llm["model"]
    source = llm["source"]

    def _parse_response(raw: str) -> dict:
        return _extract_json_object(raw)

    if source == "openai":
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": schema_name,
                        "strict": True,
                        "schema": json_schema,
                    },
                },
            )
            raw = response.choices[0].message.content
            content = _parse_response(raw)
            return {"content": content, "source": source, "model": model, "error": None}
        except Exception as schema_error:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"},
                )
                raw = response.choices[0].message.content
                content = _parse_response(raw)
                return {"content": content, "source": source, "model": model, "error": None}
            except Exception as fallback_error:
                detail = str(fallback_error) or str(schema_error)
                return {
                    "content": None,
                    "source": source,
                    "model": model,
                    "error": detail or "Structured LLM completion failed.",
                }

    # Groq or other providers — json_object only
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        content = _parse_response(raw)
        return {"content": content, "source": source, "model": model, "error": None}
    except Exception as exc:
        return {
            "content": None,
            "source": source,
            "model": model,
            "error": str(exc) or "Structured LLM completion failed.",
        }


def chat_json_completion(
    *,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    api_key_override: Optional[str] = None,
) -> dict:
    """Run a chat completion and parse a JSON object from the response."""
    llm = get_chat_llm(api_key_override=api_key_override)
    if llm.get("error"):
        return {"content": None, "source": None, "model": None, "error": llm["error"]}

    client = llm["client"]
    model = llm["model"]
    source = llm["source"]

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        content = _extract_json_object(raw)
        return {"content": content, "source": source, "model": model, "error": None}
    except Exception as json_mode_error:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            raw = response.choices[0].message.content
            content = _extract_json_object(raw)
            return {"content": content, "source": source, "model": model, "error": None}
        except Exception as fallback_error:
            detail = str(fallback_error) or str(json_mode_error)
            return {
                "content": None,
                "source": None,
                "model": model,
                "error": detail or "LLM narrative generation failed.",
            }


def chat_text_completion(
    *,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    api_key_override: Optional[str] = None,
    tools: Optional[list[dict]] = None,
) -> dict:
    """Run a chat completion and return plain text (or tool_calls in metadata)."""
    llm = get_chat_llm(api_key_override=api_key_override)
    if llm.get("error"):
        return {"content": None, "source": None, "model": None, "error": llm["error"], "tool_calls": None}

    client = llm["client"]
    model = llm["model"]
    source = llm["source"]

    try:
        kwargs: dict = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"
        response = client.chat.completions.create(**kwargs)
        message = response.choices[0].message
        tool_calls = None
        if message.tool_calls:
            tool_calls = [
                {
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
                for tc in message.tool_calls
            ]
        content = (message.content or "").strip()
        if not content and not tool_calls:
            return {"content": None, "source": source, "model": model, "error": "Empty LLM response", "tool_calls": None}
        return {
            "content": content or None,
            "source": source,
            "model": model,
            "error": None,
            "tool_calls": tool_calls,
        }
    except Exception as exc:
        return {
            "content": None,
            "source": source,
            "model": model,
            "error": str(exc) or "LLM text generation failed.",
            "tool_calls": None,
        }
