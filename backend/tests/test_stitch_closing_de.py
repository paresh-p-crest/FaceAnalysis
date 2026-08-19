from backend.narrative_translation import stitch_closing_paragraphs_de


def test_stitch_closing_de_is_native_german_not_denglisch():
    paras = stitch_closing_paragraphs_de(
        {},
        {"content": {"summary": "Skip me generic based on stored measurements."}},
        "Client",
        cv_report={"overall": {"scoreLabel": "Average"}},
    )
    blob = " ".join(paras)
    assert "assessment shows" not in blob
    assert "Du's" not in blob
    assert "for du" not in blob.lower()
    assert "A practical 30-day" not in blob
    assert "Repeat analysis" not in blob
    assert "durchschnittlich" in blob
    assert "Bildungsinhalt" in blob
    assert "SPF 50" in blob
