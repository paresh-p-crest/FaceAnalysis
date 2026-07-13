"""Tests for LLM provider resolution (OpenAI / Groq / OpenRouter)."""

from unittest.mock import patch

from backend.llm_client import get_chat_llm, resolve_llm_provider


def test_resolve_explicit_openrouter(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    assert resolve_llm_provider() == "openrouter"


def test_resolve_auto_openrouter_when_only_openrouter_key(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    assert resolve_llm_provider() == "openrouter"


def test_resolve_groq_wins_over_openrouter_when_both_keys(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "gsk-test")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    assert resolve_llm_provider() == "groq"


def test_get_chat_llm_openrouter_missing_key(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    result = get_chat_llm()
    assert result.get("error")
    assert "OPENROUTER_API_KEY" in result["error"]


def test_get_chat_llm_openrouter_client(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
    monkeypatch.setenv("PUBLIC_APP_URL", "https://example.com")

    with patch("backend.llm_client.OpenAI") as mock_openai:
        result = get_chat_llm()

    assert result.get("error") is None
    assert result["source"] == "openrouter"
    assert result["model"] == "meta-llama/llama-3.3-70b-instruct:free"
    mock_openai.assert_called_once()
    kwargs = mock_openai.call_args.kwargs
    assert kwargs["api_key"] == "sk-or-test"
    assert kwargs["base_url"] == "https://openrouter.ai/api/v1"
    assert kwargs["default_headers"]["HTTP-Referer"] == "https://example.com"
    assert kwargs["default_headers"]["X-Title"] == "MyFace"
