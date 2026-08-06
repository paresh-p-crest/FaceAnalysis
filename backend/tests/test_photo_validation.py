"""Tests for required photo pose + coarse content validation."""

from __future__ import annotations

import cv2
import numpy as np

from backend.photo_validation import (
    missing_required_poses,
    run_landmark_checks,
    run_photo_checks,
    validate_photos_content,
    validate_required_poses,
)


def _encode_bgr(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def _frontal_landmarks(nose_ratio: float = 0.5) -> list[dict]:
    """478-point synthetic front-face landmarks.

    ``nose_ratio`` sets the nose x between the cheek edges (0 = left turn,
    0.5 = frontal, 1 = right turn). Mouth closed, eyes open, face large and
    centered, brows close to eyes — passes every landmark check for ``front``.
    """
    lm = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]

    def set_lm(idx, x, y):
        lm[idx] = {"x": x, "y": y, "z": 0.0}

    # Face oval corners → bbox (0.3, 0.25)…(0.7, 0.75): size 0.2, centered.
    set_lm(10, 0.5, 0.25)    # top of forehead
    set_lm(152, 0.5, 0.75)   # chin
    set_lm(234, 0.3, 0.5)    # left cheek
    set_lm(454, 0.7, 0.5)    # right cheek
    set_lm(1, 0.3 + nose_ratio * 0.4, 0.45)  # nose tip
    set_lm(2, 0.3 + nose_ratio * 0.4, 0.55)  # subnasale (hair check)

    # Mouth (closed): width 0.1, opening 0.01 → ratio 0.1 < 0.18.
    set_lm(13, 0.495, 0.60)
    set_lm(14, 0.505, 0.60)
    set_lm(61, 0.45, 0.605)
    set_lm(291, 0.55, 0.605)

    # Eyes: EAR 0.5 per eye.
    set_lm(33, 0.38, 0.475)
    set_lm(133, 0.48, 0.475)
    set_lm(159, 0.43, 0.45)
    set_lm(145, 0.43, 0.50)
    set_lm(362, 0.52, 0.475)
    set_lm(263, 0.62, 0.475)
    set_lm(386, 0.57, 0.45)
    set_lm(374, 0.57, 0.50)

    # Brows near eyes (no glasses brow-push signal) + hairline check anchors.
    set_lm(105, 0.43, 0.42)
    set_lm(334, 0.57, 0.42)
    set_lm(107, 0.43, 0.42)
    set_lm(336, 0.57, 0.42)
    return lm


def _noisy_gray_bytes(base: int = 128, noise_std: float = 5.0) -> bytes:
    """Mid-gray image with light noise → passes brightness + sharpness.

    Noise must survive JPEG re-encode: std 2.0 drops Laplacian variance to
    ~15 (fails the <20 blur band); std 5.0 lands ~280.
    """
    img = np.full((500, 500, 3), base, dtype=np.uint8)
    if noise_std:
        img = np.clip(img + np.random.default_rng(0).normal(0, noise_std, img.shape), 0, 255).astype(np.uint8)
    return _encode_bgr(img)


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


def test_front_pose_passes_all_checks(monkeypatch):
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": _frontal_landmarks(), "face_count": 1},
    )
    failures = run_photo_checks(_noisy_gray_bytes(), "front")
    assert failures == []


def test_wrong_direction_45_fails_correct_pose(monkeypatch):
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": _frontal_landmarks(nose_ratio=0.1), "face_count": 1},
    )
    failures = run_photo_checks(_noisy_gray_bytes(), "right45")
    assert any(f["check"] == "correctPose" and f["severity"] == "error" for f in failures)


def test_frontal_face_rejected_for_wrong_pose_expected():
    # Coarse band for front is 0.32–0.68; noseRatio 0.9 is a clear-cut turn.
    failures = run_landmark_checks(_frontal_landmarks(nose_ratio=0.9), None, "front")
    assert any(f["check"] == "correctPose" and f["severity"] == "error" for f in failures)


def test_blank_image_fails_face_detection():
    # Undecodable bytes → MediaPipe raises → faceDetected error for front.
    failures = run_photo_checks(b"", "front")
    assert any(f["check"] == "faceDetected" and f["severity"] == "error" for f in failures)


def test_too_dark_image_fails_brightness(monkeypatch):
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": _frontal_landmarks(), "face_count": 1},
    )
    failures = run_photo_checks(_noisy_gray_bytes(base=10, noise_std=1.0), "front")
    assert any(f["check"] == "brightness" and f["severity"] == "error" for f in failures)


def test_profile_pose_lenient_when_no_face():
    # Full profiles stay lenient on face detection (MediaPipe reliably misses
    # at 90°+) — a blank image must not be rejected for the profile slots.
    failures = run_photo_checks(b"", "rightProfile")
    assert failures == []


def test_validate_photos_content_pose_scoped_failures(monkeypatch):
    from backend import photo_validation as pv

    monkeypatch.setattr(
        pv, "analyze_with_mediapipe",
        lambda image_bytes: {"landmarks": _frontal_landmarks(nose_ratio=0.1), "face_count": 1},
    )
    failures = validate_photos_content([("right45", _noisy_gray_bytes())])
    assert any(f["poseId"] == "right45" and f["check"] == "correctPose" for f in failures)

