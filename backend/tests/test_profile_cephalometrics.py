"""Unit tests for profile_cephalometrics.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.profile_cephalometrics import analyze_profile


def _profile_landmarks():
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    lms[10] = {"x": 0.5, "y": 0.2, "z": 0}   # glabella
    lms[6] = {"x": 0.52, "y": 0.30, "z": 0}  # nasion
    lms[2] = {"x": 0.5, "y": 0.45, "z": 0}   # subnasale
    lms[1] = {"x": 0.55, "y": 0.42, "z": 0}  # pronasale
    lms[152] = {"x": 0.52, "y": 0.75, "z": 0}  # pogonion
    lms[13] = {"x": 0.53, "y": 0.48, "z": 0}
    lms[14] = {"x": 0.53, "y": 0.52, "z": 0}
    # Right-profile visible ear (person's RIGHT mesh) — shorter than nose → Ear < Nose
    for idx in (234, 127, 132, 93, 58, 172, 136, 150):
        lms[idx] = {"x": 0.28, "y": 0.35, "z": 0}
    lms[234]["y"] = 0.32
    lms[150]["y"] = 0.39
    lms[98] = {"x": 0.52, "y": 0.48, "z": 0}
    return lms


def test_facial_convexity_near_orthognathic():
    result = analyze_profile(_profile_landmarks(), "rightProfile")
    assert result is not None
    angle = result["measurements"]["facialConvexityDeg"]
    assert 150 < angle < 190
    assert result["classification"]["convexity"] in ("orthognathic", "convex", "concave")


def test_naso_aural_ear_shorter_than_nose_on_profile():
    result = analyze_profile(_profile_landmarks(), "rightProfile")
    assert result is not None
    ratio = result["measurements"]["nasoAuralRatio"]
    assert ratio < 0.95
    assert result["classification"]["nasoAural"] == "Ear < Nose"
    assert result["overlay"]["nasoAural"]["horizontal"]


def test_naso_aural_prefers_silhouette_ear_span_over_facemesh():
    """FaceMesh ear junction span is tiny; silhouette helix→lobe should dominate."""
    import cv2
    import numpy as np

    # Synthetic right-facing profile: tall rear ear band + shorter nose bump
    img = np.full((400, 300, 3), 240, dtype=np.uint8)
    cv2.ellipse(img, (130, 210), (55, 130), 0, 0, 360, (50, 50, 50), -1)  # head
    cv2.ellipse(img, (185, 175), (28, 32), 0, 0, 360, (50, 50, 50), -1)  # nose
    # Tall vertical ear on the rear (left) side
    cv2.rectangle(img, (55, 110), (95, 250), (40, 40, 40), -1)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok

    lms = _profile_landmarks()
    # Collapse FaceMesh ear span to a tiny band (the old bug) — person's right ear on rightProfile
    for idx in (234, 127, 132, 93, 58, 172, 136, 150):
        lms[idx] = {"x": 0.3, "y": 0.40, "z": 0}
    lms[234]["y"] = 0.39
    lms[150]["y"] = 0.41

    mesh_only = analyze_profile(lms, "rightProfile")
    with_sil = analyze_profile(lms, "rightProfile", image_bytes=buf.tobytes())
    assert mesh_only is not None and with_sil is not None
    # Silhouette path should report a larger ear/nose ratio than collapsed FaceMesh ears
    assert with_sil["measurements"]["nasoAuralRatio"] > mesh_only["measurements"]["nasoAuralRatio"]
    assert with_sil["landmarkSource"] in ("silhouette", "silhouette+facemesh")


def test_profile_extended_angles_present():
    result = analyze_profile(_profile_landmarks(), "rightProfile")
    meas = result["measurements"]
    assert "nasofrontalAngleDeg" in meas
    assert "dorsalHumpDeviation" in meas
    assert "profileGonialAngleDeg" in meas
    assert meas["nasolabialAngleDeg"] > 0
