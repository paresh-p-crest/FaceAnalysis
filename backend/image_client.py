"""Provider-agnostic image generation client (image-to-image edit).

One entry point (``generate_image_edit``) that abstracts two very different
provider surfaces:

- **OpenAI**: multipart ``POST /v1/images/edits`` (``gpt-image-1``), b64 in ``data[0]``.
- **OpenRouter**: ``POST /v1/chat/completions`` with the source image in the user
  message and ``modalities: ["image", "text"]``; the edited image comes back as a
  data URL in ``choices[0].message.images[0].image_url.url``.

Provider selection mirrors ``llm_client.resolve_llm_provider``: ``IMAGE_PROVIDER``
→ ``LLM_PROVIDER`` → key presence. Never raises for expected failures (missing
key, timeout, non-2xx) — callers branch on the returned ``error``.
"""

from __future__ import annotations

import base64
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1"
DEFAULT_OPENROUTER_IMAGE_MODEL = "google/gemini-2.5-flash-image"

_IMAGE_PROVIDERS = frozenset({"openai", "openrouter"})


def resolve_image_provider() -> str:
    """openai | openrouter — IMAGE_PROVIDER, then LLM_PROVIDER, then key presence."""
    for env in ("IMAGE_PROVIDER", "LLM_PROVIDER"):
        value = os.environ.get(env, "").strip().lower()
        if value in _IMAGE_PROVIDERS:
            return value
    if os.environ.get("OPENROUTER_API_KEY", "").strip():
        return "openrouter"
    return "openai"


def image_model(provider: Optional[str] = None) -> str:
    provider = provider or resolve_image_provider()
    if provider == "openrouter":
        return (
            os.environ.get("OPENROUTER_IMAGE_MODEL", DEFAULT_OPENROUTER_IMAGE_MODEL).strip()
            or DEFAULT_OPENROUTER_IMAGE_MODEL
        )
    return (
        os.environ.get("OPENAI_IMAGE_MODEL", DEFAULT_OPENAI_IMAGE_MODEL).strip()
        or DEFAULT_OPENAI_IMAGE_MODEL
    )


def image_api_key(provider: Optional[str] = None) -> str:
    provider = provider or resolve_image_provider()
    if provider == "openrouter":
        return os.environ.get("OPENROUTER_API_KEY", "").strip()
    return os.environ.get("OPENAI_API_KEY", "").strip()


def has_image_api_key(provider: Optional[str] = None) -> bool:
    return bool(image_api_key(provider))


def _content_type_for(image_bytes: bytes) -> tuple[str, str]:
    """(filename, content_type) from magic bytes."""
    if image_bytes.startswith(b"\x89PNG"):
        return "portrait.png", "image/png"
    if image_bytes.startswith(b"RIFF"):
        return "portrait.webp", "image/webp"
    return "portrait.jpg", "image/jpeg"


def _err(provider: str, model: str, message: Optional[str]) -> dict:
    return {"b64": None, "imageBytes": None, "dataUrl": None, "error": message, "provider": provider, "model": model}


async def generate_image_edit(
    prompt: str,
    image_bytes: bytes,
    *,
    size: str = "1024x1024",
    quality: str = "medium",
    timeout: float = 180.0,
    log_label: str = "image edit",
) -> dict:
    """Edit ``image_bytes`` per ``prompt`` with the active provider.

    Returns ``{"b64", "imageBytes", "dataUrl", "error", "provider", "model"}``.
    """
    provider = resolve_image_provider()
    model = image_model(provider)
    if not image_bytes or len(image_bytes) < 100:
        return _err(provider, model, "Source portrait is missing or too small.")
    if provider == "openrouter":
        return await _openrouter_edit(prompt, image_bytes, timeout=timeout, log_label=log_label)
    return await _openai_edit(prompt, image_bytes, size=size, quality=quality, timeout=timeout, log_label=log_label)


async def _openai_edit(
    prompt: str,
    image_bytes: bytes,
    *,
    size: str,
    quality: str,
    timeout: float,
    log_label: str,
) -> dict:
    model = image_model("openai")
    key = image_api_key("openai")
    if not key:
        return _err("openai", model, "OpenAI API key not set.")

    filename, content_type = _content_type_for(image_bytes)
    files = {"image": (filename, image_bytes, content_type)}
    data = {"model": model, "prompt": prompt, "size": size, "quality": quality}

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                OPENAI_IMAGE_EDITS_URL,
                headers={"Authorization": f"Bearer {key}"},
                data=data,
                files=files,
            )
    except httpx.TimeoutException:
        logger.warning("%s timed out (openai model=%s duration=%.2fs)", log_label, model, time.perf_counter() - started)
        return _err("openai", model, "Image generation timed out. Try again.")
    except Exception as exc:  # noqa: BLE001 — surface as soft error
        logger.warning("%s request failed (openai model=%s): %s", log_label, model, exc)
        return _err("openai", model, str(exc) or "Image generation request failed.")

    duration = time.perf_counter() - started
    try:
        payload = response.json()
    except Exception:
        payload = {}

    if response.status_code >= 400:
        message = (
            (payload.get("error") or {}).get("message") if isinstance(payload, dict) else None
        ) or f"OpenAI image generation failed ({response.status_code})."
        logger.warning("%s error (openai model=%s status=%s duration=%.2fs): %s", log_label, model, response.status_code, duration, message)
        return _err("openai", model, message)

    b64 = (payload.get("data") or [{}])[0].get("b64_json")
    if not b64:
        logger.warning("%s returned no b64_json (openai model=%s duration=%.2fs)", log_label, model, duration)
        return _err("openai", model, "OpenAI returned no image data.")

    return _ok("openai", model, b64, "image/png", log_label, len(image_bytes), duration)


async def _openrouter_edit(
    prompt: str,
    image_bytes: bytes,
    *,
    timeout: float,
    log_label: str,
) -> dict:
    model = image_model("openrouter")
    key = image_api_key("openrouter")
    if not key:
        return _err("openrouter", model, "OpenRouter API key not set.")

    _, content_type = _content_type_for(image_bytes)
    source_data_url = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    referer = (
        os.environ.get("OPENROUTER_HTTP_REFERER", "").strip()
        or os.environ.get("PUBLIC_APP_URL", "").strip()
        or "http://localhost:3000"
    )
    title = os.environ.get("OPENROUTER_APP_TITLE", "").strip() or "MyFace"
    payload_body = {
        "model": model,
        "modalities": ["image", "text"],
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": source_data_url}},
                ],
            }
        ],
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": title,
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(OPENROUTER_CHAT_URL, headers=headers, json=payload_body)
    except httpx.TimeoutException:
        logger.warning("%s timed out (openrouter model=%s duration=%.2fs)", log_label, model, time.perf_counter() - started)
        return _err("openrouter", model, "Image generation timed out. Try again.")
    except Exception as exc:  # noqa: BLE001 — surface as soft error
        logger.warning("%s request failed (openrouter model=%s): %s", log_label, model, exc)
        return _err("openrouter", model, str(exc) or "Image generation request failed.")

    duration = time.perf_counter() - started
    try:
        payload = response.json()
    except Exception:
        payload = {}

    if response.status_code >= 400:
        message = (
            (payload.get("error") or {}).get("message") if isinstance(payload, dict) else None
        ) or f"OpenRouter image generation failed ({response.status_code})."
        logger.warning("%s error (openrouter model=%s status=%s duration=%.2fs): %s", log_label, model, response.status_code, duration, message)
        return _err("openrouter", model, message)

    data_url = _extract_openrouter_image_url(payload)
    if not data_url:
        logger.warning("%s returned no image (openrouter model=%s duration=%.2fs)", log_label, model, duration)
        return _err("openrouter", model, "OpenRouter returned no image data.")

    b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
    return _ok("openrouter", model, b64, None, log_label, len(image_bytes), duration, data_url=data_url)


def _extract_openrouter_image_url(payload: dict) -> Optional[str]:
    """choices[0].message.images[0].image_url.url — the edited image as a data URL."""
    if not isinstance(payload, dict):
        return None
    choices = payload.get("choices") or []
    if not choices:
        return None
    message = (choices[0] or {}).get("message") or {}
    images = message.get("images") or []
    if not images:
        return None
    image_url = (images[0] or {}).get("image_url") or {}
    url = image_url.get("url")
    return url if isinstance(url, str) and url.strip() else None


def _ok(
    provider: str,
    model: str,
    b64: str,
    mime: Optional[str],
    log_label: str,
    bytes_in: int,
    duration: float,
    *,
    data_url: Optional[str] = None,
) -> dict:
    try:
        image_out: Optional[bytes] = base64.b64decode(b64)
    except Exception:
        image_out = None
    if not data_url:
        data_url = f"data:{mime or 'image/png'};base64,{b64}"
    logger.info("%s OK (%s model=%s bytes_in=%s duration=%.2fs)", log_label, provider, model, bytes_in, duration)
    return {"b64": b64, "imageBytes": image_out, "dataUrl": data_url, "error": None, "provider": provider, "model": model}
