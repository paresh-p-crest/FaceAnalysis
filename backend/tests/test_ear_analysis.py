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


def test_analyze_one_side_marks_capture_implausible_as_failed(monkeypatch):
    from backend import ear_analysis

    monkeypatch.setattr(ear_analysis, "EDGE_COLLAPSE_FAIL", 1.0)

    def _fake_run(_model, _device, _rgb):
        # Landmarks clustered on nose — fails earCapture bands.
        lms = np.full((20, 2), [300.0, 400.0], dtype=np.float32)
        lms[:, 1] = np.linspace(380, 520, 20)
        conf = np.full(20, 0.5, dtype=np.float32)
        return lms, conf, 0.05, {}

    monkeypatch.setattr(ear_analysis, "_run_inference", _fake_run)
    monkeypatch.setattr(ear_analysis, "_bytes_to_rgb", lambda b: np.zeros((800, 600, 3), dtype=np.uint8))

    out = ear_analysis._analyze_one_side(b"x", "rightProfile", object(), "cpu")
    assert out["status"] == "failed"
    assert out["reason"] == "capture_implausible"
    assert out["earCapture"]["proper"] is False


def test_evaluate_ear_capture_rejects_shoulder_misdetection():
    from backend.ear_analysis import evaluate_ear_capture

    side = {
        "poseId": "rightProfile",
        "status": "ready",
        "edgeCollapseFrac": 0.08,
        "confidences": [0.4] * 20,
        "repairedIndices": [],
        "measurements": {
            "verticalHeightNorm": 0.22,
            "helixTop": {"x": 0.85, "y": 0.55},
            "softBottom": {"x": 0.88, "y": 0.82},
            "xMinNorm": 0.80,
            "xMaxNorm": 0.92,
        },
    }
    cap = evaluate_ear_capture(side)
    assert cap["proper"] is False
    assert cap["checks"]["helix_band_ok"] is False
    assert cap["checks"]["lobe_band_ok"] is False


def test_evaluate_ear_capture_accepts_mid_face_ear():
    from backend.ear_analysis import evaluate_ear_capture

    side = {
        "poseId": "rightProfile",
        "status": "ready",
        "edgeCollapseFrac": 0.08,
        "confidences": [0.5] * 20,
        "repairedIndices": [],
        "measurements": {
            "verticalHeightNorm": 0.14,
            "helixTop": {"x": 0.72, "y": 0.28},
            "softBottom": {"x": 0.72, "y": 0.42},
            "xMinNorm": 0.65,
            "xMaxNorm": 0.78,
        },
    }
    cap = evaluate_ear_capture(side)
    assert cap["proper"] is True


def test_build_nose_level_guides_right_profile():
    from backend.ear_analysis import build_nose_level_guides

    glabella = {"x": 0.42, "y": 0.30}
    nose_bot = {"x": 0.40, "y": 0.48}
    ear_x = 80.0  # ear vertical caliper x (image %)
    guides = build_nose_level_guides(
        glabella=glabella,
        nose_bottom=nose_bot,
        vertical_x_pct=ear_x,
    )
    assert len(guides) == 2
    assert all(g.get("dashed") is True for g in guides)
    assert guides[0]["y"] == pytest.approx(30.0, abs=0.1)
    assert guides[1]["y"] == pytest.approx(48.0, abs=0.1)
    # Span ear vertical → face landmark (script-style).
    assert guides[0]["x1"] == pytest.approx(42.0, abs=0.1)
    assert guides[0]["x2"] == pytest.approx(80.0, abs=0.1)


def test_build_nose_level_guides_left_profile_mirrors():
    from backend.ear_analysis import build_nose_level_guides

    glabella = {"x": 0.58, "y": 0.30}
    nose_bot = {"x": 0.60, "y": 0.48}
    ear_x = 20.0
    guides = build_nose_level_guides(
        glabella=glabella,
        nose_bottom=nose_bot,
        vertical_x_pct=ear_x,
    )
    assert len(guides) == 2
    assert guides[0]["x1"] == pytest.approx(20.0, abs=0.1)
    assert guides[0]["x2"] == pytest.approx(58.0, abs=0.1)


def test_build_naso_aural_caliper_overlay_includes_nose_and_level_guides():
    from backend.ear_analysis import build_naso_aural_caliper_overlay

    ear_m = {
        "helixTop": {"x": 0.72, "y": 0.30},
        "softBottom": {"x": 0.70, "y": 0.55},
        "xMinNorm": 0.65,
        "xMaxNorm": 0.78,
    }
    nose_top = {"x": 0.42, "y": 0.34}
    nose_bot = {"x": 0.40, "y": 0.48}
    glabella = {"x": 0.43, "y": 0.32}
    ov = build_naso_aural_caliper_overlay(
        ear_measurements=ear_m,
        nose_top=nose_top,
        nose_bottom=nose_bot,
        glabella=glabella,
        facing_right=True,
    )
    assert ov["style"] == "qoves"
    assert ov.get("nasoLayout") == "earPlusNoseGuides-v6"
    ids = [b["id"] for b in ov["brackets"]]
    assert ids == ["earVertical"]
    ear = ov["brackets"][0]
    assert ear["y1"] == pytest.approx(30.0, abs=0.1)
    assert ear["y2"] == pytest.approx(55.0, abs=0.1)
    assert not any(b.get("id") in ("noseRangeOnEar", "noseVertical") for b in ov["brackets"])
    assert len(ov["horizontal"]) == 2
    assert all(h.get("dashed") is False for h in ov["horizontal"])
    assert len(ov["guides"]) == 2
    assert all(g.get("dashed") is True for g in ov["guides"])


def test_build_naso_aural_caliper_overlay_ear_only_without_glabella():
    from backend.ear_analysis import build_naso_aural_caliper_overlay

    ear_m = {
        "helixTop": {"x": 0.72, "y": 0.30},
        "softBottom": {"x": 0.70, "y": 0.55},
        "xMinNorm": 0.65,
        "xMaxNorm": 0.78,
    }
    ov = build_naso_aural_caliper_overlay(
        ear_measurements=ear_m,
        nose_top={"x": 0.42, "y": 0.34},
        nose_bottom={"x": 0.40, "y": 0.48},
        facing_right=True,
    )
    assert ov.get("nasoLayout") == "earOnly-v5"
    assert "guides" not in ov


def test_resolve_nose_points_prefers_matching_profile_not_primary_45():
    """right45 primary overlay must not supply nose coords for a rightProfile plate."""
    from backend.ear_analysis import resolve_nose_points_for_profile

    cv = {
        "profile": {
            "primaryView": "right45",
            "rightProfile": {
                "overlay": {
                    "nasoAural": {
                        "segments": [
                            {"x1": 70, "y1": 30, "x2": 70, "y2": 55},
                            {"x1": 40, "y1": 34, "x2": 40, "y2": 48},
                        ]
                    }
                }
            },
        }
    }
    # Stale naso overlay from a 45° primary — wrong image space
    naso = {
        "photoSource": "right45",
        "overlay": {
            "segments": [
                {"x1": 60, "y1": 20, "x2": 60, "y2": 70},
                {"x1": 55, "y1": 22, "x2": 55, "y2": 66},
            ]
        },
    }
    top, bot = resolve_nose_points_for_profile(cv, "rightProfile", naso)
    assert top is not None and bot is not None
    assert top["y"] == pytest.approx(0.34, abs=1e-3)
    assert bot["y"] == pytest.approx(0.48, abs=1e-3)
    assert top["x"] == pytest.approx(0.40, abs=1e-3)


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
    # Soft extend off (SOFT_BOTTOM_FRAC == 0): height is helix → lobe tip.
    assert m["verticalHeightPx"] == pytest.approx(160 - 40, abs=0.01)
    assert m["softBottom"]["y"] == pytest.approx(m["lobeBottom"]["y"], abs=1e-5)


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

    monkeypatch.setattr("backend.model_store.urllib.request.urlretrieve", _fake_retrieve)
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

    monkeypatch.setattr("backend.model_store.urllib.request.urlretrieve", _boom)
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "true")
    from backend.ear_analysis import ensure_ear_landmarker_weights

    assert ensure_ear_landmarker_weights(dest) is None
    assert not dest.is_file()


def test_ensure_path_under_models_root(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    monkeypatch.delenv("EAR_LANDMARKER_PATH", raising=False)
    from backend.model_store import ear_weights_path

    path = ear_weights_path()
    assert path.name == "ear_landmarker.pth"
    assert path.parent == (tmp_path / "models").resolve()


def test_get_model_retries_after_failed_ensure(monkeypatch, tmp_path):
    """Failed ensure must not permanently disable the ear landmarker for the process."""
    from backend import ear_analysis

    ear_analysis.reset_ear_landmarker_cache()
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    monkeypatch.delenv("EAR_LANDMARKER_PATH", raising=False)

    state = {"n": 0}

    def _ensure():
        state["n"] += 1
        if state["n"] == 1:
            return None
        # Second attempt: pretend weights exist (load will still fail without real ckpt —
        # we only assert ensure is called again).
        p = tmp_path / "models" / "ear_landmarker.pth"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"not-a-real-checkpoint")
        return p

    monkeypatch.setattr(ear_analysis, "ensure_ear_landmarker_weights", _ensure)
    m1, d1 = ear_analysis._get_model()
    assert m1 is None
    m2, d2 = ear_analysis._get_model()
    # Load of bogus bytes fails → still None, but ensure ran twice (retryable).
    assert state["n"] == 2
    ear_analysis.reset_ear_landmarker_cache()


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


def test_ear_contour_polygon_closes_synthetic_ring():
    from backend.ear_analysis import ear_contour_polygon, expand_tragus_contour

    pts = _synthetic_contour()
    poly = ear_contour_polygon(pts)
    assert poly.shape[0] > EAR_LMK_COUNT
    np.testing.assert_allclose(poly[0], poly[-1], atol=1e-5)
    expanded = expand_tragus_contour(pts)
    assert expanded.shape[0] == poly.shape[0] - 1


def test_make_hero_ear_crop_non_square_white_bg():
    from backend.ear_analysis import make_hero_ear_crop

    h, w = 240, 320
    rgb = np.full((h, w, 3), 40, dtype=np.uint8)
    pts = _synthetic_contour(cx=200.0, cy=120.0, rx=35.0, ry=55.0)
    crop, bbox = make_hero_ear_crop(rgb, pts, max_side=384, pad_px=0, dilate_px=0)
    assert crop.size > 0
    x1, y1, x2, y2 = bbox
    assert x2 > x1 and y2 > y1
    # Tall ellipse → non-square tight bbox (before optional max_side resize)
    assert (y2 - y1) > (x2 - x1)
    # Outside-mask pixels in crop should be near white
    assert int(crop[0, 0].mean()) >= 240


def test_resolve_ear_hero_crops_contour_primary_keeps_segformer_suffix():
    from backend.ear_analysis import resolve_ear_hero_crops

    seg = {"jpegBytes": b"seg", "sourceMethod": "segformer_ears", "bbox": [0, 0, 1, 1], "labels": ["l"]}
    contour = {
        "jpegBytes": b"contour",
        "sourceMethod": "ear_landmarker_contour",
        "bbox": [0, 0, 2, 2],
        "labels": ["c"],
    }
    out = resolve_ear_hero_crops("earsLeft", seg, contour)
    assert out["earsLeft"]["jpegBytes"] == b"contour"
    assert out["earsLeft"]["sourceMethod"] == "ear_landmarker_contour"
    assert out["earsLeftSegformer"]["jpegBytes"] == b"seg"
    assert out["earsLeftSegformer"]["sourceMethod"] == "segformer_ears"


def test_resolve_ear_hero_crops_segformer_suffix_only_without_contour():
    from backend.ear_analysis import resolve_ear_hero_crops

    seg = {"jpegBytes": b"seg", "sourceMethod": "segformer_ears", "bbox": [0, 0, 1, 1], "labels": ["l"]}
    out = resolve_ear_hero_crops("earsRight", seg, None)
    assert "earsRight" not in out
    assert out["earsRightSegformer"]["jpegBytes"] == b"seg"


def test_extract_ear_contour_crop_rejects_nose_sliver():
    import cv2
    import numpy as np
    from backend.ear_analysis import extract_ear_contour_crop

    rgb = np.zeros((800, 600, 3), dtype=np.uint8)
    rgb[:, :] = (240, 240, 240)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    assert ok
    # Landmarks clustered on nose — produces a thin diagonal sliver.
    landmarks_norm = [{"x": 0.50 + i * 0.001, "y": 0.45 + i * 0.008} for i in range(20)]
    res = extract_ear_contour_crop(buf.tobytes(), landmarks_norm, "rightProfile")
    assert res is None


def test_extract_ear_contour_crop_roundtrip_jpeg():
    import cv2

    from backend.ear_analysis import EAR_LMK_COUNT, extract_ear_contour_crop

    h, w = 200, 200
    rgb = np.full((h, w, 3), 80, dtype=np.uint8)
    pts = _synthetic_contour(cx=100.0, cy=100.0, rx=30.0, ry=45.0)
    landmarks_norm = [
        {"id": i, "x": float(pts[i, 0] / w), "y": float(pts[i, 1] / h)}
        for i in range(EAR_LMK_COUNT)
    ]
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    assert ok
    res = extract_ear_contour_crop(buf.tobytes(), landmarks_norm, "leftProfile")
    assert res is not None
    assert res["sourceMethod"] == "ear_landmarker_contour"
    assert res["sourcePose"] == "leftProfile"
    assert len(res["jpegBytes"]) > 100
    decoded = cv2.imdecode(np.frombuffer(res["jpegBytes"], np.uint8), cv2.IMREAD_COLOR)
    assert decoded is not None
    assert decoded.shape[0] > 0 and decoded.shape[1] > 0
