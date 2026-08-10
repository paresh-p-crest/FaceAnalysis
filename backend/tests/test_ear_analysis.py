"""Unit tests for ear landmarker preprocess, repair, measurements, and soft-fail."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from backend.ear_analysis import (
    EAR_LMK_COUNT,
    INPUT_SIZE,
    SOFT_BOTTOM_FRAC,
    analyze_profile_ears,
    compute_ear_measurements,
    decode_heatmaps,
    landmarks_input_to_full,
    letterbox_full_image,
    repair_contour_outliers,
    reset_ear_landmarker_cache,
)


def _synthetic_contour(cx: float = 100.0, cy: float = 120.0, rx: float = 40.0, ry: float = 60.0) -> np.ndarray:
    """20 points on an ellipse — stable ring for repair/measurement math."""
    pts = []
    for i in range(EAR_LMK_COUNT):
        ang = 2 * np.pi * i / EAR_LMK_COUNT
        pts.append([cx + rx * np.cos(ang), cy + ry * np.sin(ang)])
    return np.asarray(pts, dtype=np.float32)


def test_letterbox_and_inverse_map_roundtrip():
    rgb = np.zeros((200, 300, 3), dtype=np.uint8)
    rgb[50, 100] = (255, 0, 0)
    arr, meta = letterbox_full_image(rgb)
    assert arr.shape == (INPUT_SIZE, INPUT_SIZE, 3)
    assert meta["orig_size"] == (300, 200)
    assert meta["padded_side"] == 300
    assert meta["pad_offset"] == (0, 50)

    # A point at model-space corresponding to original (100, 50):
    # pad first → (100, 100) on 300 square → scale to 368 → (122.666, 122.666)
    scale = INPUT_SIZE / 300.0
    model_pt = np.array([[100.0 * scale, 100.0 * scale]], dtype=np.float32)
    full = landmarks_input_to_full(model_pt, meta)
    assert full.shape == (1, 2)
    np.testing.assert_allclose(full[0], [100.0, 50.0], atol=0.5)


def test_repair_contour_outliers_snaps_isolated_jump():
    pts = _synthetic_contour()
    # Yank one lobe-ish point far away (both adjacent edges become huge).
    outlier_idx = 17
    pts[outlier_idx] = pts[outlier_idx] + np.array([500.0, 500.0], dtype=np.float32)
    repaired, indices = repair_contour_outliers(pts)
    assert outlier_idx in indices
    # Midpoint of neighbors — not the wild jump.
    prev_i, next_i = (outlier_idx - 1) % EAR_LMK_COUNT, (outlier_idx + 1) % EAR_LMK_COUNT
    expected = 0.5 * (pts[prev_i] + pts[next_i])
    # After repair, pts[outlier] was mutated in the copy; use repaired.
    np.testing.assert_allclose(repaired[outlier_idx], expected, atol=1e-3)
    # Clean ring needs no further repair.
    _, again = repair_contour_outliers(repaired)
    assert again == []


def test_compute_ear_measurements_norms_and_keys():
    # Helix (2-12) near top, lobe (13-18) near bottom — hand-place for clear extents.
    pts = np.zeros((EAR_LMK_COUNT, 2), dtype=np.float32)
    # Tragus
    pts[19] = [80, 100]
    pts[0] = [85, 90]
    pts[1] = [90, 80]
    # Helix arc — top at y=40
    for i, x in enumerate(range(2, 13)):
        pts[x] = [100 + i * 5, 40 + abs(i - 5) * 3]
    pts[7] = [120, 40]  # helix top
    # Lobe — bottom at y=160, left at x=70
    for i, idx in enumerate(range(13, 19)):
        pts[idx] = [90 + i * 8, 140 + (i % 3) * 5]
    pts[15] = [70, 150]  # lobe left
    pts[16] = [95, 160]  # lobe bottom

    img_w, img_h = 400, 500
    m = compute_ear_measurements(pts, (img_w, img_h))
    assert set(m.keys()) >= {
        "verticalHeightNorm",
        "horizontalWidthNorm",
        "slantHeightNorm",
        "verticalHeightPx",
        "horizontalWidthPx",
        "slantHeightPx",
        "softBottomFrac",
        "helixTop",
        "lobeBottom",
        "lobeLeft",
    }
    assert m["softBottomFrac"] == SOFT_BOTTOM_FRAC
    assert m["helixTop"]["y"] == pytest.approx(40 / img_h, abs=1e-5)
    assert m["lobeBottom"]["y"] == pytest.approx(160 / img_h, abs=1e-5)
    assert m["lobeLeft"]["x"] == pytest.approx(70 / img_w, abs=1e-5)
    assert 0 < m["verticalHeightNorm"] < 1
    assert 0 < m["horizontalWidthNorm"] < 1
    assert 0 < m["slantHeightNorm"] < 1
    # Soft extend adds a bit past lobe bottom along lobe direction.
    assert m["verticalHeightPx"] > (160 - 40)


def test_decode_heatmaps_peaks_and_edge_frac():
    # Synthetic HWC heatmaps: channel i peaks at (10+i, 20).
    hm = np.zeros((46, 46, 55), dtype=np.float32)
    for i in range(EAR_LMK_COUNT):
        x, y = 10 + i, 20
        hm[y, x, i] = 10.0
    landmarks, conf, edge = decode_heatmaps(hm)
    assert landmarks.shape == (EAR_LMK_COUNT, 2)
    assert conf.shape == (EAR_LMK_COUNT,)
    # After upsample 46→368, peak scales ~8x; just assert interior (not edge-collapsed).
    assert edge < 0.25
    assert all(c > 0 for c in conf)


def test_analyze_profile_ears_skips_missing_poses(monkeypatch):
    reset_ear_landmarker_cache()

    class _Fake:
        def eval(self):
            return self

        def __call__(self, tensor):
            raise AssertionError("should not infer without photos")

    monkeypatch.setattr(
        "backend.ear_analysis._get_model",
        lambda: (_Fake(), "cpu"),
    )
    out = analyze_profile_ears({})
    assert out.get("earLandmarkSource") == "ear_landmarker"
    assert out["sides"]["left"]["status"] == "skipped"
    assert out["sides"]["left"]["reason"] == "pose_missing"
    assert out["sides"]["right"]["status"] == "skipped"
    reset_ear_landmarker_cache()


def test_analyze_profile_ears_soft_fail_without_weights(monkeypatch, tmp_path):
    reset_ear_landmarker_cache()
    monkeypatch.setenv("EAR_LANDMARKER_PATH", str(tmp_path / "missing.pth"))
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "false")
    out = analyze_profile_ears({"leftProfile": b"not-an-image"})
    assert out == {}
    reset_ear_landmarker_cache()


def test_ensure_weights_downloads_when_missing(monkeypatch, tmp_path):
    dest = tmp_path / "models" / "ear_landmarker.pth"
    # Fake a >1MB payload so the size gate passes.
    payload = b"x" * 1_500_000

    def _fake_retrieve(url, filename):
        Path(filename).write_bytes(payload)

    monkeypatch.setattr("backend.ear_analysis.urllib.request.urlretrieve", _fake_retrieve)
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "true")
    from backend.ear_analysis import ensure_ear_landmarker_weights

    got = ensure_ear_landmarker_weights(dest)
    assert got == dest
    assert dest.is_file()
    assert dest.stat().st_size == len(payload)


def test_ensure_weights_soft_fails_on_download_error(monkeypatch, tmp_path):
    dest = tmp_path / "ear_landmarker.pth"

    def _boom(url, filename):
        raise OSError("network down")

    monkeypatch.setattr("backend.ear_analysis.urllib.request.urlretrieve", _boom)
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "true")
    from backend.ear_analysis import ensure_ear_landmarker_weights

    assert ensure_ear_landmarker_weights(dest) is None
    assert not dest.is_file()


def test_enrich_keeps_facemesh_ear_fields_when_landmarker_empty(monkeypatch):
    """Merge is additive: FaceMesh earSize survives an empty landmarker return."""
    from backend.analyze_face import _enrich_cv_report

    monkeypatch.setattr("backend.analyze_face.analyze_profile_ears", lambda photos: {})
    monkeypatch.setattr(
        "backend.analyze_face.build_profile_report",
        lambda views, photos, feature_crops: {},
    )
    monkeypatch.setattr("backend.analyze_face.build_quarter_report", lambda views: {})
    monkeypatch.setattr("backend.analyze_face.analyze_smile_photo", lambda *a, **k: {})
    monkeypatch.setattr("backend.analyze_face.analyze_hair_photo", lambda *a, **k: {})

    cv = {"ears": {"earSize": "1.10", "sizeDifference": "2.0", "score": 80}}
    out = _enrich_cv_report(cv, {}, {}, {"views": {}, "posesAnalyzed": []})
    assert out["ears"]["earSize"] == "1.10"
    assert out["ears"]["sizeDifference"] == "2.0"
    assert "sides" not in out["ears"]


def test_enrich_merges_sides_additively(monkeypatch):
    from backend.analyze_face import _enrich_cv_report

    payload = {
        "earLandmarkSource": "ear_landmarker",
        "sides": {
            "left": {"poseId": "leftProfile", "status": "ready", "landmarks": []},
            "right": {"poseId": "rightProfile", "status": "skipped", "reason": "pose_missing"},
        },
    }
    monkeypatch.setattr("backend.analyze_face.analyze_profile_ears", lambda photos: payload)
    monkeypatch.setattr(
        "backend.analyze_face.build_profile_report",
        lambda views, photos, feature_crops: {},
    )
    monkeypatch.setattr("backend.analyze_face.build_quarter_report", lambda views: {})
    monkeypatch.setattr("backend.analyze_face.analyze_smile_photo", lambda *a, **k: {})
    monkeypatch.setattr("backend.analyze_face.analyze_hair_photo", lambda *a, **k: {})

    cv = {"ears": {"earSize": "1.10", "protrusion": "Moderate"}}
    out = _enrich_cv_report(cv, {}, {"leftProfile": b"x"}, {"views": {}, "posesAnalyzed": []})
    assert out["ears"]["earSize"] == "1.10"
    assert out["ears"]["protrusion"] == "Moderate"
    assert out["ears"]["earLandmarkSource"] == "ear_landmarker"
    assert out["ears"]["sides"]["left"]["status"] == "ready"
