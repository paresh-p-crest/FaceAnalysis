"""Dimorphism display clamp by genderPreference."""

from backend.cv_report import dimorphism_metrics


def _landmarks_squareish():
    """Minimal landmark set with a wide jaw bias (indices used by dimorphism_metrics)."""
    # Default roughly centered face; widen jaw corners for masculine jaw read.
    pts = {i: {"x": 0.5, "y": 0.5, "z": 0.0} for i in range(500)}
    pts[10] = {"x": 0.5, "y": 0.15, "z": 0.0}  # forehead
    pts[152] = {"x": 0.5, "y": 0.9, "z": 0.0}  # chin
    pts[234] = {"x": 0.15, "y": 0.55, "z": 0.0}  # jaw L
    pts[454] = {"x": 0.85, "y": 0.55, "z": 0.0}  # jaw R
    pts[127] = {"x": 0.25, "y": 0.45, "z": -0.02}
    pts[356] = {"x": 0.75, "y": 0.45, "z": -0.02}
    pts[1] = {"x": 0.5, "y": 0.5, "z": 0.0}
    pts[6] = {"x": 0.5, "y": 0.4, "z": 0.0}
    pts[61] = {"x": 0.4, "y": 0.65, "z": 0.0}
    pts[291] = {"x": 0.6, "y": 0.65, "z": 0.0}
    pts[13] = {"x": 0.5, "y": 0.62, "z": 0.0}
    pts[14] = {"x": 0.5, "y": 0.68, "z": 0.0}
    pts[105] = {"x": 0.35, "y": 0.32, "z": 0.0}
    pts[334] = {"x": 0.65, "y": 0.32, "z": 0.0}
    pts[70] = {"x": 0.38, "y": 0.35, "z": 0.0}
    pts[300] = {"x": 0.62, "y": 0.35, "z": 0.0}
    pts[33] = {"x": 0.35, "y": 0.38, "z": 0.0}
    pts[263] = {"x": 0.65, "y": 0.38, "z": 0.0}
    pts[107] = {"x": 0.35, "y": 0.28, "z": 0.0}
    pts[52] = {"x": 0.35, "y": 0.34, "z": 0.0}
    pts[336] = {"x": 0.65, "y": 0.28, "z": 0.0}
    pts[282] = {"x": 0.65, "y": 0.34, "z": 0.0}
    pts[48] = {"x": 0.42, "y": 0.52, "z": 0.0}
    pts[278] = {"x": 0.58, "y": 0.52, "z": 0.0}
    pts[0] = {"x": 0.5, "y": 0.58, "z": 0.0}
    pts[17] = {"x": 0.5, "y": 0.72, "z": 0.0}
    pts[148] = {"x": 0.4, "y": 0.85, "z": 0.0}
    pts[377] = {"x": 0.6, "y": 0.85, "z": 0.0}
    pts[159] = {"x": 0.35, "y": 0.36, "z": 0.0}
    pts[145] = {"x": 0.35, "y": 0.4, "z": 0.0}
    pts[386] = {"x": 0.65, "y": 0.36, "z": 0.0}
    pts[374] = {"x": 0.65, "y": 0.4, "z": 0.0}
    return [pts[i] for i in range(500)]


def test_dimorphism_feminine_pref_clamps_masculine_labels():
    landmarks = _landmarks_squareish()
    unclamped = dimorphism_metrics(landmarks, None, {"genderPreference": "no-preference"})
    clamped = dimorphism_metrics(landmarks, None, {"genderPreference": "feminine"})

    jaw_u = next(f for f in unclamped["features"] if f["name"] == "Jaw")
    jaw_c = next(f for f in clamped["features"] if f["name"] == "Jaw")

    # Metrics text preserved (width / angle phrases).
    assert "width" in jaw_c["explanation"]
    assert "mandibular angle" in jaw_c["explanation"]

    assert jaw_c["score"] <= 59
    assert "masculine" not in jaw_c["label"].lower()
    if jaw_u["score"] >= 60:
        assert "Room for improvement toward a softer, more feminine jaw" in jaw_c["explanation"]

    assert clamped["overallScore"] <= 59
    assert "masculine" not in clamped["overallLabel"].lower()


def test_dimorphism_masculine_pref_clamps_feminine_labels():
    landmarks = _landmarks_squareish()
    # Force a feminine-leaning overall by using empty-ish landmarks clustered (moderate/fem).
    # Soften jaw width.
    landmarks[234] = {"x": 0.35, "y": 0.55, "z": 0.0}
    landmarks[454] = {"x": 0.65, "y": 0.55, "z": 0.0}

    unclamped = dimorphism_metrics(landmarks, None, {})
    clamped = dimorphism_metrics(landmarks, None, {"genderPreference": "masculine"})

    assert clamped["overallScore"] >= 40
    for f in clamped["features"]:
        assert f["score"] >= 40
        assert f["label"] in ("Moderate", "Masculine", "Very Masculine")

    # If any raw feature was feminine (<40), room-for-improvement appears.
    raw_features = {f["name"]: f for f in unclamped["features"]}
    for f in clamped["features"]:
        if raw_features[f["name"]]["score"] < 40:
            assert "Room for improvement toward a stronger, more masculine" in f["explanation"]


def test_dimorphism_no_preference_unclamped():
    landmarks = _landmarks_squareish()
    report = dimorphism_metrics(landmarks, None, {"genderPreference": "no-preference"})
    # May be masculine; must not invent room-for-improvement without preference.
    assert "Room for improvement" not in report["explanation"]
    for f in report["features"]:
        assert "Room for improvement" not in f["explanation"]


def test_dimorphism_grow_beard_fallback_masculine():
    landmarks = _landmarks_squareish()
    report = dimorphism_metrics(landmarks, None, {"growBeard": "yes"})
    assert report["overallScore"] >= 40
    for f in report["features"]:
        assert f["score"] >= 40
