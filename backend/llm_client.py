"""LLM provider config — OpenAI, Groq, or OpenRouter (OpenAI-compatible APIs)."""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
from typing import Any, Optional

from openai import OpenAI

from .config import GROQ_MODEL, OPENAI_REPORT_MODEL, OPENROUTER_MODEL

logger = logging.getLogger(__name__)

_KNOWN_PROVIDERS = frozenset({"openai", "groq", "openrouter"})
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def resolve_llm_provider() -> str:
    explicit = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if explicit in _KNOWN_PROVIDERS:
        return explicit
    if os.environ.get("GROQ_API_KEY", "").strip():
        return "groq"
    if os.environ.get("OPENROUTER_API_KEY", "").strip():
        return "openrouter"
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

    if provider == "openrouter":
        key = (api_key_override or os.environ.get("OPENROUTER_API_KEY", "")).strip()
        if not key:
            return {
                "error": (
                    "OpenRouter API key not set. Add OPENROUTER_API_KEY to .env "
                    "and set LLM_PROVIDER=openrouter."
                )
            }
        referer = (
            os.environ.get("OPENROUTER_HTTP_REFERER", "").strip()
            or os.environ.get("PUBLIC_APP_URL", "").strip()
            or "http://localhost:3000"
        )
        title = os.environ.get("OPENROUTER_APP_TITLE", "").strip() or "MyFace"
        return {
            "client": OpenAI(
                api_key=key,
                base_url=OPENROUTER_BASE_URL,
                default_headers={
                    "HTTP-Referer": referer,
                    "X-Title": title,
                },
            ),
            "model": (
                os.environ.get("OPENROUTER_MODEL", OPENROUTER_MODEL).strip() or OPENROUTER_MODEL
            ),
            "source": "openrouter",
            "error": None,
        }

    key = (api_key_override or os.environ.get("OPENAI_API_KEY", "")).strip()
    if not key:
        return {
            "error": (
                "OpenAI API key not set. Add OPENAI_API_KEY to .env, "
                "or set LLM_PROVIDER=groq|openrouter with the matching key."
            )
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


def _usage_from_response(response: Any) -> dict[str, Optional[int]]:
    usage = getattr(response, "usage", None)
    if usage is None:
        return {"prompt_tokens": None, "completion_tokens": None, "total_tokens": None}
    prompt = getattr(usage, "prompt_tokens", None)
    completion = getattr(usage, "completion_tokens", None)
    total = getattr(usage, "total_tokens", None)
    if total is None and prompt is not None and completion is not None:
        total = prompt + completion
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": total,
    }


def _fmt_tokens(value: Optional[int]) -> str:
    if value is None:
        return "—"
    return f"{value:,}"


def _fmt_duration(seconds: float) -> str:
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.2f}s"


def log_llm_usage(
    *,
    op: str,
    source: str,
    model: str,
    duration_s: float,
    usage: dict[str, Optional[int]],
    label: Optional[str] = None,
    ok: bool = True,
    error: Optional[str] = None,
) -> None:
    """Single-line token usage log for each LLM request (always prints to stderr)."""
    status = "OK" if ok else "FAIL"
    title = f"{op}" + (f"·{label}" if label else "")
    err_part = f" error={error!r}" if error else ""
    message = (
        f"[LLM] {status} {title} | {source}/{model}"
        f" | in={_fmt_tokens(usage.get('prompt_tokens'))}"
        f" out={_fmt_tokens(usage.get('completion_tokens'))}"
        f" total={_fmt_tokens(usage.get('total_tokens'))}"
        f" dur={_fmt_duration(duration_s)}{err_part}"
    )
    print(message, file=sys.stderr, flush=True)

    if ok:
        logger.info(
            "LLM %s %s/%s in=%s out=%s total=%s duration=%s",
            status,
            source,
            model,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
            usage.get("total_tokens"),
            _fmt_duration(duration_s),
        )
    else:
        logger.warning(
            "LLM %s %s/%s duration=%s error=%s",
            status,
            source,
            model,
            _fmt_duration(duration_s),
            error,
        )


def _chat_create(
    client: OpenAI,
    *,
    source: str,
    op: str,
    label: Optional[str] = None,
    **kwargs: Any,
) -> tuple[Any, dict[str, Optional[int]], float]:
    """Timed chat.completions.create with usage logging. Raises on API errors."""
    started = time.perf_counter()
    model = kwargs.get("model") or "unknown"
    try:
        response = client.chat.completions.create(**kwargs)
        duration_s = time.perf_counter() - started
        usage = _usage_from_response(response)
        log_llm_usage(
            op=op,
            source=source,
            model=model,
            duration_s=duration_s,
            usage=usage,
            label=label,
            ok=True,
        )
        return response, usage, duration_s
    except Exception as exc:
        duration_s = time.perf_counter() - started
        log_llm_usage(
            op=op,
            source=source,
            model=model,
            duration_s=duration_s,
            usage={"prompt_tokens": None, "completion_tokens": None, "total_tokens": None},
            label=label,
            ok=False,
            error=str(exc),
        )
        raise


def chat_structured_completion(
    *,
    schema_name: str,
    json_schema: dict,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    api_key_override: Optional[str] = None,
) -> dict:
    """Chat completion with OpenAI strict json_schema; Groq/OpenRouter use json_object."""
    llm = get_chat_llm(api_key_override=api_key_override)
    if llm.get("error"):
        return {"content": None, "source": None, "model": None, "error": llm["error"], "usage": None}

    client = llm["client"]
    model = llm["model"]
    source = llm["source"]
    op = "chat_structured"

    def _parse_response(raw: str) -> dict:
        return _extract_json_object(raw)

    if source == "openai":
        try:
            response, usage, duration_s = _chat_create(
                client,
                source=source,
                op=op,
                label=schema_name,
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
            return {
                "content": content,
                "source": source,
                "model": model,
                "error": None,
                "usage": usage,
                "duration_s": duration_s,
            }
        except Exception as schema_error:
            try:
                response, usage, duration_s = _chat_create(
                    client,
                    source=source,
                    op=op,
                    label=f"{schema_name}/json_object",
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    response_format={"type": "json_object"},
                )
                raw = response.choices[0].message.content
                content = _parse_response(raw)
                return {
                    "content": content,
                    "source": source,
                    "model": model,
                    "error": None,
                    "usage": usage,
                    "duration_s": duration_s,
                }
            except Exception as fallback_error:
                detail = str(fallback_error) or str(schema_error)
                return {
                    "content": None,
                    "source": source,
                    "model": model,
                    "error": detail or "Structured LLM completion failed.",
                    "usage": None,
                }

    # Groq / OpenRouter / other providers — json_object only
    try:
        response, usage, duration_s = _chat_create(
            client,
            source=source,
            op=op,
            label=schema_name,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        content = _parse_response(raw)
        return {
            "content": content,
            "source": source,
            "model": model,
            "error": None,
            "usage": usage,
            "duration_s": duration_s,
        }
    except Exception as exc:
        return {
            "content": None,
            "source": source,
            "model": model,
            "error": str(exc) or "Structured LLM completion failed.",
            "usage": None,
        }


def chat_json_completion(
    *,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    api_key_override: Optional[str] = None,
    label: Optional[str] = None,
) -> dict:
    """Run a chat completion and parse a JSON object from the response."""
    llm = get_chat_llm(api_key_override=api_key_override)
    if llm.get("error"):
        return {"content": None, "source": None, "model": None, "error": llm["error"], "usage": None}

    client = llm["client"]
    model = llm["model"]
    source = llm["source"]
    op = "chat_json"

    try:
        response, usage, duration_s = _chat_create(
            client,
            source=source,
            op=op,
            label=label,
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        content = _extract_json_object(raw)
        return {
            "content": content,
            "source": source,
            "model": model,
            "error": None,
            "usage": usage,
            "duration_s": duration_s,
        }
    except Exception as json_mode_error:
        try:
            response, usage, duration_s = _chat_create(
                client,
                source=source,
                op=op,
                label=(f"{label}/plain" if label else "plain"),
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            raw = response.choices[0].message.content
            content = _extract_json_object(raw)
            return {
                "content": content,
                "source": source,
                "model": model,
                "error": None,
                "usage": usage,
                "duration_s": duration_s,
            }
        except Exception as fallback_error:
            detail = str(fallback_error) or str(json_mode_error)
            return {
                "content": None,
                "source": None,
                "model": model,
                "error": detail or "LLM narrative generation failed.",
                "usage": None,
            }


def chat_text_completion(
    *,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    api_key_override: Optional[str] = None,
    tools: Optional[list[dict]] = None,
    label: Optional[str] = None,
) -> dict:
    """Run a chat completion and return plain text (or tool_calls in metadata)."""
    llm = get_chat_llm(api_key_override=api_key_override)
    if llm.get("error"):
        return {
            "content": None,
            "source": None,
            "model": None,
            "error": llm["error"],
            "tool_calls": None,
            "usage": None,
        }

    client = llm["client"]
    model = llm["model"]
    source = llm["source"]
    op = "chat_text"

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
        response, usage, duration_s = _chat_create(
            client,
            source=source,
            op=op,
            label=label or ("tools" if tools else None),
            **kwargs,
        )
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
            return {
                "content": None,
                "source": source,
                "model": model,
                "error": "Empty LLM response",
                "tool_calls": None,
                "usage": usage,
                "duration_s": duration_s,
            }
        return {
            "content": content or None,
            "source": source,
            "model": model,
            "error": None,
            "tool_calls": tool_calls,
            "usage": usage,
            "duration_s": duration_s,
        }
    except Exception as exc:
        return {
            "content": None,
            "source": source,
            "model": model,
            "error": str(exc) or "LLM text generation failed.",
            "tool_calls": None,
            "usage": None,
        }
