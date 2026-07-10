"""Tests for LLM usage extraction and formatting helpers."""

from types import SimpleNamespace

from backend.llm_client import _fmt_duration, _fmt_tokens, _usage_from_response


def test_usage_from_response_reads_openai_style_usage():
    response = SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=1200, completion_tokens=340, total_tokens=1540)
    )
    assert _usage_from_response(response) == {
        "prompt_tokens": 1200,
        "completion_tokens": 340,
        "total_tokens": 1540,
    }


def test_usage_from_response_sums_when_total_missing():
    response = SimpleNamespace(
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5, total_tokens=None)
    )
    assert _usage_from_response(response)["total_tokens"] == 15


def test_usage_from_response_handles_missing_usage():
    assert _usage_from_response(SimpleNamespace()) == {
        "prompt_tokens": None,
        "completion_tokens": None,
        "total_tokens": None,
    }


def test_fmt_tokens_and_duration():
    assert _fmt_tokens(1540) == "1,540"
    assert _fmt_tokens(None) == "—"
    assert _fmt_duration(0.42) == "420ms"
    assert _fmt_duration(1.234) == "1.23s"
