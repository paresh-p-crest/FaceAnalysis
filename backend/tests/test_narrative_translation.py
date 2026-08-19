import asyncio
import pytest
from unittest.mock import patch, MagicMock

from backend.llm_client import chat_structured_completion
from backend.narrative_translation import (
    _batch_max_tokens,
    _reassemble_indexed_list,
    _translate_closing_paragraphs,
    _translate_executive_content,
    _translate_feature_narrative_llm,
    _translate_flat_batch,
    build_flat_translation_schema,
)


def test_build_flat_translation_schema():
    keys = ["summary", "subsection_0", "subsection_1"]
    schema = build_flat_translation_schema(keys)
    assert schema["type"] == "object"
    assert schema["properties"] == {
        "summary": {"type": "string"},
        "subsection_0": {"type": "string"},
        "subsection_1": {"type": "string"},
    }
    assert schema["required"] == keys
    assert schema["additionalProperties"] is False


def test_batch_max_tokens_scaling():
    from backend.config import LLM_MAX_OUTPUT_TOKENS

    assert _batch_max_tokens(1) == LLM_MAX_OUTPUT_TOKENS
    assert _batch_max_tokens(4) == max(LLM_MAX_OUTPUT_TOKENS, 8000)
    assert _batch_max_tokens(6) == max(LLM_MAX_OUTPUT_TOKENS, 12000)
    assert _batch_max_tokens(20) == 16000
    assert _batch_max_tokens(50) == 16000


def test_reassemble_indexed_list_gap_handling():
    de_map = {
        "strength_0": "Stärke A",
        "strength_2": "Stärke C",
    }
    en_fallback = ["Strength A", "Strength B", "Strength C"]
    res = _reassemble_indexed_list(de_map, "strength", 3, en_fallback, label="test_strengths")
    assert res == ["Stärke A", "Strength B", "Stärke C"]


def test_feature_flat_roundtrip():
    narrative_en = {
        "summary": "The chin is balanced.",
        "subsections": [
            {"title": "Chin", "body": "Your chin shows balanced height."},
            {"title": "Further Enhancement", "body": "Subtle definition recommended."},
        ],
    }

    mock_resp = {
        "content": {
            "summary": "Das Kinn ist ausgewogen.",
            "subsection_0": "Dein Kinn zeigt eine ausgewogene Höhe.",
            "subsection_1": "Dezente Definition empfohlen.",
        },
        "error": None,
    }

    async def _run():
        with patch("backend.narrative_translation.chat_structured_completion", return_value=mock_resp) as mock_llm:
            res = await _translate_feature_narrative_llm(narrative_en, "chin")
            assert mock_llm.call_count == 1
            assert mock_llm.call_args.kwargs["require_strict"] is True
            assert res["summary"] == "Das Kinn ist ausgewogen."
            assert len(res["subsections"]) == 2
            assert res["subsections"][0]["title"] == "Chin"  # EN title kept
            assert res["subsections"][0]["body"] == "Dein Kinn zeigt eine ausgewogene Höhe."
            assert res["subsections"][1]["title"] == "Further Enhancement"
            assert res["subsections"][1]["body"] == "Dezente Definition empfohlen."

    asyncio.run(_run())


def test_key_mismatch_retry_and_success():
    en_fields = {"summary": "Overview text.", "paragraph_0": "First paragraph."}
    bad_resp = {"content": {"summary": "Übersicht"}, "error": None}  # missing paragraph_0
    good_resp = {
        "content": {"summary": "Übersicht", "paragraph_0": "Erster Absatzziffer."},
        "error": None,
    }

    async def _run():
        with patch("backend.narrative_translation.chat_structured_completion", side_effect=[bad_resp, good_resp]) as mock_llm:
            res = await _translate_flat_batch(en_fields, label="test_mismatch", schema_name="test_schema")
            assert mock_llm.call_count == 2
            assert res["summary"] == "Übersicht"
            assert res["paragraph_0"] == "Erster Absatzziffer."

    asyncio.run(_run())


def test_retry_exhaustion_triggers_fallback():
    closing_en = ["First paragraph text.", "Second paragraph text."]
    bad_resp = {"content": {"paragraph_0": "Erster Absatz"}, "error": None}

    async def _run():
        with patch("backend.narrative_translation.chat_structured_completion", return_value=bad_resp), \
             patch("backend.narrative_translation.translate_text_en_to_de", side_effect=["Erster Text.", "Zweiter Text."]) as mock_text:
            res = await _translate_closing_paragraphs(closing_en)
            assert mock_text.call_count == 2
            assert res == ["Erster Text.", "Zweiter Text."]

    asyncio.run(_run())


def test_require_strict_api_error_json_object_fallback():
    """Verify require_strict=True API error triggers chat_structured_completion json_object fallback."""
    fake_client = MagicMock()
    # First call (strict json_schema) raises Exception; second call (json_object) succeeds
    mock_choice = MagicMock()
    mock_choice.message.content = '{"translated": "hallo"}'
    fake_response = MagicMock()
    fake_response.choices = [mock_choice]

    def mock_chat_create(*args, **kwargs):
        if kwargs.get("response_format", {}).get("type") == "json_schema":
            raise RuntimeError("400 Model does not support strict json_schema")
        return fake_response, {"total_tokens": 10}, 0.1

    with patch("backend.llm_client.get_chat_llm", return_value={"client": fake_client, "model": "test-model", "source": "openrouter", "error": None}), \
         patch("backend.llm_client._chat_create", side_effect=mock_chat_create) as mock_create:
        res = chat_structured_completion(
            schema_name="test_schema",
            json_schema={"type": "object"},
            messages=[],
            temperature=0.1,
            max_tokens=100,
            require_strict=True,
        )
        assert mock_create.call_count == 2
        assert mock_create.call_args_list[0].kwargs["response_format"]["type"] == "json_schema"
        assert mock_create.call_args_list[0].kwargs["response_format"]["json_schema"]["strict"] is True
        assert mock_create.call_args_list[1].kwargs["response_format"]["type"] == "json_object"
        assert res["content"] == {"translated": "hallo"}


def test_de_sanitize_keeps_umlauts():
    from backend.narrative_translation import finalize_de_text
    from backend.clinical_guardrails import sanitize_report_ascii, sanitize_report_latin1

    src = "Höhe, Größe, weiß, Maß"
    assert sanitize_report_latin1(src) == src
    assert "ö" not in sanitize_report_ascii(src)
    assert finalize_de_text(src) == src


def test_exact_glossary_not_substring_base():
    from backend.narrative_translation import apply_exact_de_glossary, find_en_leaks, localize_de_decimals

    assert apply_exact_de_glossary("alar base wide") == "Nasenflügelbasis wide"
    assert "Basis" not in apply_exact_de_glossary("the base of the chin")
    assert localize_de_decimals("Width-length 1.29 and SPF 30+") == "Width-length 1,29 and SPF 30+"
    leftover = find_en_leaks("Die alar base ist breit.")
    assert leftover


def test_translation_prompt_localizes_not_preserves_english():
    from backend.narrative_translation import NARRATIVE_TRANSLATION_SYSTEM_PROMPT

    assert "Preserve medical/technical terms" not in NARRATIVE_TRANSLATION_SYSTEM_PROMPT
    assert "Localize" in NARRATIVE_TRANSLATION_SYSTEM_PROMPT
    assert "Nasenflügelbasis" in NARRATIVE_TRANSLATION_SYSTEM_PROMPT
    assert "Querbreite" in NARRATIVE_TRANSLATION_SYSTEM_PROMPT
    assert "Augenbrauen" in NARRATIVE_TRANSLATION_SYSTEM_PROMPT
