"""Tests for LLM provider resolution (OpenAI / Groq / OpenRouter)."""

from unittest.mock import patch

from backend.llm_client import (
    _reasoning_kwargs,
    get_chat_llm,
    resolve_llm_provider,
    uses_strict_json_schema,
)


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


def test_uses_strict_json_schema_openai():
    assert uses_strict_json_schema("openai", "gpt-5.6-luna") is True


def test_uses_strict_json_schema_openrouter_allowlist():
    assert uses_strict_json_schema("openrouter", "openai/gpt-5.6-luna") is True
    assert uses_strict_json_schema("openrouter", "google/gemma-4-26b-a4b-it:free") is True
    assert uses_strict_json_schema("openrouter", "meta-llama/llama-3.3-70b-instruct:free") is False


def test_reasoning_kwargs_only_gpt56_luna():
    assert _reasoning_kwargs("openrouter", "openai/gpt-5.6-luna", "high") == {
        "extra_body": {"reasoning": {"effort": "high"}}
    }
    assert _reasoning_kwargs("openai", "gpt-5.6-luna", "high") == {"reasoning_effort": "high"}
    assert _reasoning_kwargs("openrouter", "google/gemma-4-26b-a4b-it:free", "high") == {}
    assert _reasoning_kwargs("openrouter", "openai/gpt-5-mini", "high") == {}
    assert _reasoning_kwargs("openai", "gpt-5-mini", "high") == {}
    assert _reasoning_kwargs("openai", "gpt-4o-mini", "high") == {}
    assert _reasoning_kwargs("openrouter", "openai/gpt-5.6-luna", None) == {}


def test_uses_strict_json_schema_groq():
    assert uses_strict_json_schema("groq", "llama-3.3-70b-versatile") is False


def test_chat_structured_openrouter_gpt56_luna_uses_json_schema_and_reasoning(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-5.6-luna")

    mock_response = type("R", (), {"choices": [type("C", (), {"message": type("M", (), {"content": '{"ok": true}'})()})()]})()
    captured = {}

    def fake_chat_create(client, *, source, op, label, **kwargs):
        captured.update(kwargs)
        return mock_response, {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}, 0.01

    with patch("backend.llm_client.OpenAI"), patch("backend.llm_client._chat_create", side_effect=fake_chat_create):
        from backend.llm_client import chat_structured_completion

        result = chat_structured_completion(
            schema_name="test_schema",
            json_schema={"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]},
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.2,
            max_tokens=100,
            reasoning_effort="high",
        )

    assert result["error"] is None
    assert result["content"] == {"ok": True}
    assert captured["response_format"]["type"] == "json_schema"
    assert captured["response_format"]["json_schema"]["strict"] is True
    assert captured["extra_body"] == {"reasoning": {"effort": "high"}}


def test_chat_structured_openrouter_free_llama_uses_json_object(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")

    mock_response = type("R", (), {"choices": [type("C", (), {"message": type("M", (), {"content": '{"ok": true}'})()})()]})()
    captured = {}

    def fake_chat_create(client, *, source, op, label, **kwargs):
        captured.update(kwargs)
        return mock_response, {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}, 0.01

    with patch("backend.llm_client.OpenAI"), patch("backend.llm_client._chat_create", side_effect=fake_chat_create):
        from backend.llm_client import chat_structured_completion

        result = chat_structured_completion(
            schema_name="test_schema",
            json_schema={"type": "object"},
            messages=[{"role": "user", "content": "hi"}],
            temperature=0.2,
            max_tokens=100,
        )

    assert result["error"] is None
    assert captured["response_format"] == {"type": "json_object"}
    assert "extra_body" not in captured
    assert "reasoning_effort" not in captured
