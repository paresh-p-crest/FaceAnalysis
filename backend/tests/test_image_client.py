"""Tests for the provider-agnostic image client (no network)."""

from __future__ import annotations

import asyncio
import os
from contextlib import contextmanager

from backend import image_client


@contextmanager
def _env(**overrides):
    """Temporarily set/clear env vars, restoring afterwards."""
    saved = {k: os.environ.get(k) for k in overrides}
    try:
        for k, v in overrides.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        yield
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def test_resolve_image_provider_explicit_and_key_fallback():
    with _env(IMAGE_PROVIDER="openrouter", LLM_PROVIDER=None, OPENROUTER_API_KEY=None):
        assert image_client.resolve_image_provider() == "openrouter"
    with _env(IMAGE_PROVIDER=None, LLM_PROVIDER="openai", OPENROUTER_API_KEY="x"):
        assert image_client.resolve_image_provider() == "openai"
    # LLM_PROVIDER=groq is not image-capable → fall back to key presence.
    with _env(IMAGE_PROVIDER=None, LLM_PROVIDER="groq", OPENROUTER_API_KEY="x"):
        assert image_client.resolve_image_provider() == "openrouter"
    with _env(IMAGE_PROVIDER=None, LLM_PROVIDER=None, OPENROUTER_API_KEY=None):
        assert image_client.resolve_image_provider() == "openai"


def test_image_model_defaults_per_provider():
    with _env(OPENAI_IMAGE_MODEL=None):
        assert image_client.image_model("openai") == image_client.DEFAULT_OPENAI_IMAGE_MODEL
    with _env(OPENROUTER_IMAGE_MODEL=None):
        assert image_client.image_model("openrouter") == image_client.DEFAULT_OPENROUTER_IMAGE_MODEL
    with _env(OPENROUTER_IMAGE_MODEL="black-forest-labs/flux.2-pro"):
        assert image_client.image_model("openrouter") == "black-forest-labs/flux.2-pro"


def test_has_image_api_key_per_provider():
    with _env(OPENAI_API_KEY="sk-x", OPENROUTER_API_KEY=None):
        assert image_client.has_image_api_key("openai") is True
        assert image_client.has_image_api_key("openrouter") is False


def test_content_type_for_magic_bytes():
    assert image_client._content_type_for(b"\x89PNG\r\n\x1a\n")[1] == "image/png"
    assert image_client._content_type_for(b"RIFF....WEBP")[1] == "image/webp"
    assert image_client._content_type_for(b"\xff\xd8\xff\xe0")[1] == "image/jpeg"


def test_extract_openrouter_image_url():
    payload = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "images": [{"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAB"}}],
                }
            }
        ]
    }
    assert image_client._extract_openrouter_image_url(payload) == "data:image/png;base64,AAAB"
    assert image_client._extract_openrouter_image_url({"choices": [{"message": {}}]}) is None
    assert image_client._extract_openrouter_image_url({}) is None


def test_generate_image_edit_soft_errors_without_network():
    # Too-small source → soft error, no provider call.
    result = asyncio.run(image_client.generate_image_edit("prompt", b"tiny"))
    assert result["imageBytes"] is None
    assert result["error"]

    # Valid-size bytes but no key → soft error naming the provider.
    big = b"\xff\xd8\xff\xe0" + b"0" * 200
    with _env(IMAGE_PROVIDER="openrouter", LLM_PROVIDER=None, OPENROUTER_API_KEY=None):
        result = asyncio.run(image_client.generate_image_edit("prompt", big))
    assert result["imageBytes"] is None
    assert "OpenRouter" in (result["error"] or "")
    assert result["provider"] == "openrouter"


if __name__ == "__main__":
    test_resolve_image_provider_explicit_and_key_fallback()
    test_image_model_defaults_per_provider()
    test_has_image_api_key_per_provider()
    test_content_type_for_magic_bytes()
    test_extract_openrouter_image_url()
    test_generate_image_edit_soft_errors_without_network()
    print("all image_client tests passed")
