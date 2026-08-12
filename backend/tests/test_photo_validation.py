"""Tests for required photo pose + simple submit-time sanity checks."""

from __future__ import annotations

import cv2
import numpy as np

from backend.photo_validation import (
    missing_required_poses,
    run_photo_checks,
    validate_photos_content,
    validate_required_poses,
)


def _encode_bgr(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def _gray_bytes(base: int = 128, size: int = 500) -> bytes:
    return _encode_bgr(np.full((size, size, 3), base, dtype=np.uint8))


def test_all_poses_present():
    photos = {
        "front": b"x",
        "leftProfile": b"x",
        "rightProfile": b"x",
        "left45": b"x",
        "right45": b"x",
        "smile": b"x",
        "topHead": b"x",
    }
    assert missing_required_poses(photos) == []
    assert validate_required_poses(photos) == []


def test_missing_poses():
    photos = {"front": b"x", "smile": b"x"}
    missing = missing_required_poses(photos)
    assert "leftProfile" in missing
    assert "rightProfile" in missing
    assert "left45" in missing
    assert "right45" in missing
    assert "topHead" in missing
    assert "front" not in missing


def test_empty_bytes_counted_as_missing():
    photos = {pid: b"" for pid in ("front", "leftProfile", "rightProfile", "left45", "right45", "smile", "topHead")}
    assert len(missing_required_poses(photos)) == 7


def test_face_present_passes(monkeypatch):
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": [], "face_count": 1},
    )
    # No pose / expression / glasses checks on BE — face + sane pixels is enough.
    assert run_photo_checks(_gray_bytes(), "left45") == []
    assert run_photo_checks(_gray_bytes(), "right45") == []
    assert run_photo_checks(_gray_bytes(), "front") == []


def test_blank_image_fails_face_detection():
    failures = run_photo_checks(b"", "front")
    assert any(f["check"] == "faceDetected" and f["severity"] == "error" for f in failures)


def test_too_dark_image_fails_brightness(monkeypatch):
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": [], "face_count": 1},
    )
    failures = run_photo_checks(_gray_bytes(base=10), "front")
    assert any(f["check"] == "brightness" and f["severity"] == "error" for f in failures)


def test_profile_pose_lenient_when_no_face():
    # Full profiles stay lenient — MediaPipe often misses at 90°+.
    assert run_photo_checks(b"", "rightProfile") == []
    assert run_photo_checks(b"", "topHead") == []


def test_validate_photos_content_scopes_face_failure(monkeypatch):
    from backend import photo_validation as pv

    def _no_face(_image_bytes):
        raise ValueError("No face detected by MediaPipe")

    monkeypatch.setattr(pv, "analyze_with_mediapipe", _no_face)
    failures = validate_photos_content([("right45", _gray_bytes())])
    assert any(f["poseId"] == "right45" and f["check"] == "faceDetected" for f in failures)


def test_pose_direction_not_enforced_on_backend(monkeypatch):
    """Regression: BE must not reject FE-passed 45° shots via noseRatio.

    FE uses 3D yaw; BE cannot. A frontal landmark set uploaded as right45
    used to 400 on correctPose — that check is intentionally gone.
    """
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": [], "face_count": 1},
    )
    failures = validate_photos_content([("right45", _gray_bytes()), ("left45", _gray_bytes())])
    assert failures == []
