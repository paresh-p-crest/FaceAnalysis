"""Validate required photo poses and coarse photo content before analysis.

The frontend (`photoValidation.js`) runs a fine-grained 11-check validation at
upload time; this module is the server-side double-guard that re-runs the same
checks at submit time against the stored original bytes (multipart, no
re-encode, so pixels match what the frontend validated). It deliberately uses
looser ("coarse") thresholds so a photo that already passed the frontend is
never rejected here — the frontend remains the fine gate.

Pose parity note: the frontend uses MediaPipe Tasks' 3D
``facialTransformationMatrixes`` (yaw/pitch) as its primary pose signal, but
the Python MediaPipe FaceMesh package does not expose that API, so the backend
check is noseRatio-only. It is a double-guard, not a replacement.
"""

from __future__ import annotations

import cv2
import numpy as np

from .config import PHOTO_POSES
from .face_crop import FACE_OVAL, dist
from .mediapipe_analysis import analyze_with_mediapipe

REQUIRED_POSE_IDS: tuple[str, ...] = tuple(
    p["id"] for p in PHOTO_POSES if p.get("required", False)
)

# noseRatio bands — coarse-guard loosened variants of the frontend bands
# (photoValidation.js poseRanges): front 0.42-0.58, left45 0.25-0.42,
# right45 0.58-0.75, leftProfile 0-0.25, rightProfile 0.75-1.0, smile 0.42-0.58,
# topHead 0.20-0.80.
# ponytail: widened ~±0.07 so an FE-passed photo never fails at submit;
# tighten once the JS/Python engines are aligned (BE is noseRatio-only — Python
# FaceMesh has no facialTransformationMatrixes, so the 3D yaw/pitch path can't
# be replicated server-side).
POSE_RANGES: dict[str, tuple[float, float]] = {
    "front": (0.32, 0.68),
    "right45": (0.50, 0.82),
    "left45": (0.18, 0.50),
    "rightProfile": (0.70, 1.0),
    "leftProfile": (0.0, 0.30),
    "smile": (0.32, 0.68),
    "topHead": (0.15, 0.85),
}

# Mirrors the frontend POSE_LABEL_KEYS so server rejections translate through
# the existing Photo.validation.* message catalogs.
POSE_LABEL_KEYS: dict[str, str] = {
    "front": "Photo.validation.expectedPose.front",
    "smile": "Photo.validation.expectedPose.smile",
    "left45": "Photo.validation.expectedPose.left45",
    "right45": "Photo.validation.expectedPose.right45",
    "leftProfile": "Photo.validation.expectedPose.leftProfile",
    "rightProfile": "Photo.validation.expectedPose.rightProfile",
    "topHead": "Photo.validation.expectedPose.topHead",
}


def missing_required_poses(photos: dict) -> list[str]:
    """Return pose IDs that are required but missing or empty in *photos*."""
    missing: list[str] = []
    for pose_id in REQUIRED_POSE_IDS:
        val = photos.get(pose_id)
        if val is None or (isinstance(val, (bytes, str)) and not val):
            missing.append(pose_id)
    return missing


def validate_required_poses(photos: dict) -> list[str]:
    """Alias for missing_required_poses — returns list of missing pose IDs."""
    return missing_required_poses(photos)


# ── Content checks (coarse double-guard) ──


def _fail(check: str, message_key: str, severity: str, values=None, message: str = "") -> dict:
    result = {
        "check": check,
        "pass": False,
        "severity": severity,
        "messageKey": message_key,
        "message": message or message_key,
    }
    if values:
        result["messageValues"] = values
    return result


def _lm(landmarks: list, idx: int) -> dict:
    if idx < len(landmarks):
        return landmarks[idx]
    return {"x": 0.5, "y": 0.5, "z": 0}


def _decode(image_bytes: bytes):
    if not image_bytes:
        return None  # empty body — caller falls through to MediaPipe, which raises cleanly
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _nose_ratio(landmarks: list) -> float | None:
    """0 = extreme left turn, 0.5 = frontal, 1 = extreme right turn."""
    nose = _lm(landmarks, 1)
    left_edge = _lm(landmarks, 234)
    right_edge = _lm(landmarks, 454)
    face_width = dist(left_edge, right_edge)
    if face_width < 0.01:
        return None
    return (nose["x"] - left_edge["x"]) / face_width


def _face_bbox(landmarks: list) -> tuple[float, float, float, float]:
    xs = [_lm(landmarks, i)["x"] for i in FACE_OVAL]
    ys = [_lm(landmarks, i)["y"] for i in FACE_OVAL]
    return min(xs), max(xs), min(ys), max(ys)


def _check_resolution(img) -> dict | None:
    if img is None:
        return None
    h, w = img.shape[:2]
    if w < 400 or h < 400:
        return _fail(
            "resolution", "Photo.validation.resolution.tooSmall", "error",
            {"width": w, "height": h, "minPx": 400},
            "Image resolution is too small",
        )
    return None


def _check_brightness(img) -> dict | None:
    # ponytail: FE warns at avg<60 / >210 and errors at <40 / >230; coarse
    # guard rejects only the extreme error tiers so a warm/soft-lit FE-pass
    # photo is never blocked. Re-tighten once engines are aligned.
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    avg = float(gray.mean())
    if avg < 40:
        return _fail("brightness", "Photo.validation.brightness.veryDark", "error", None, "Photo is too dark")
    if avg > 230:
        return _fail("brightness", "Photo.validation.brightness.overexposed", "error", None, "Photo is overexposed")
    return None


def _check_sharpness(img) -> dict | None:
    # ponytail: FE errors at Laplacian variance <20 (warns <40); coarse guard
    # keeps only the hard-blur band. Re-tighten once engines are aligned.
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if variance < 20:
        return _fail("sharpness", "Photo.validation.sharpness.veryBlurry", "error", None, "Photo is too blurry")
    return None


def _check_neutral_expression(landmarks: list) -> dict | None:
    # ponytail: FE warns on smile deviation >0.12; coarse guard keeps only the
    # hard open-mouth error band (>0.18).
    upper = _lm(landmarks, 13)
    lower = _lm(landmarks, 14)
    mouth_left = _lm(landmarks, 61)
    mouth_right = _lm(landmarks, 291)
    mouth_width = dist(mouth_left, mouth_right)
    if mouth_width < 0.001:
        return None
    if dist(upper, lower) / mouth_width > 0.18:
        return _fail("neutralExpression", "Photo.validation.neutralExpression.mouthOpen", "error", None, "Mouth appears open — keep it closed")
    return None


def _check_eyes_open(landmarks: list) -> dict | None:
    # ponytail: FE warns at avg EAR <0.12; coarse guard keeps only the closed
    # eyes error band (<0.08).
    left_ear = dist(_lm(landmarks, 159), _lm(landmarks, 145)) / (dist(_lm(landmarks, 33), _lm(landmarks, 133)) or 0.001)
    right_ear = dist(_lm(landmarks, 386), _lm(landmarks, 374)) / (dist(_lm(landmarks, 362), _lm(landmarks, 263)) or 0.001)
    if (left_ear + right_ear) / 2 < 0.08:
        return _fail("eyesOpen", "Photo.validation.eyesOpen.closed", "error", None, "Eyes appear closed")
    return None


def _check_face_centered(landmarks: list) -> dict | None:
    min_x, max_x, min_y, max_y = _face_bbox(landmarks)
    offset_x = abs((min_x + max_x) / 2 - 0.5)
    offset_y = abs((min_y + max_y) / 2 - 0.5)
    # Warning-only in FE too — never blocks submission.
    if offset_x > 0.18 or offset_y > 0.2:
        return _fail("faceCentered", "Photo.validation.faceCentered.offCenter", "warning", None, "Face is not centered in the photo")
    return None


def _check_face_size(landmarks: list) -> dict | None:
    # ponytail: FE warns at <0.12; coarse guard keeps only the <0.06 error tier.
    min_x, max_x, min_y, max_y = _face_bbox(landmarks)
    if (max_x - min_x) * (max_y - min_y) < 0.06:
        return _fail("faceSize", "Photo.validation.faceSize.tooSmall", "error", None, "Face is too small in the photo")
    return None


def _check_hair_clear(landmarks: list) -> dict | None:
    # ponytail: FE errors at ratio <0.20 (warns <0.30); coarse guard loosened
    # to <0.15. Both are heuristic forehead-coverage estimates.
    forehead_top = _lm(landmarks, 10)
    brow_y = (_lm(landmarks, 105)["y"] + _lm(landmarks, 334)["y"]) / 2
    nose_tip_y = _lm(landmarks, 2)["y"]
    brow_to_nose = nose_tip_y - brow_y
    if brow_to_nose < 0.001:
        return None
    if (brow_y - forehead_top["y"]) / brow_to_nose < 0.15:
        return _fail("hairClear", "Photo.validation.hairClear.covering", "error", None, "Hair appears to cover the forehead")
    return None


def _check_correct_pose(landmarks: list, pose_id: str) -> dict | None:
    ratio = _nose_ratio(landmarks)
    if ratio is None:
        return None  # inconclusive — pass
    rng = POSE_RANGES.get(pose_id, POSE_RANGES["front"])
    if rng[0] <= ratio <= rng[1]:
        return None
    detected = (
        "Photo.validation.detectedPose.rightProfile" if ratio > 0.58
        else "Photo.validation.detectedPose.leftProfile" if ratio < 0.42
        else "Photo.validation.detectedPose.frontFacing"
    )
    severity = "warning" if pose_id == "topHead" else "error"
    return _fail(
        "correctPose", "Photo.validation.correctPose.wrong", severity,
        {"detected": detected, "expected": POSE_LABEL_KEYS.get(pose_id, POSE_LABEL_KEYS["front"])},
        "Photo does not match the expected pose",
    )


def _check_glasses(img, landmarks: list) -> dict | None:
    """Coarse glasses detection — landmark + eye-band-brightness subset of the
    frontend's 3-signal canvas + 2-signal landmark approach.

    ponytail: full canvas-contrast port (rim edges, dark runs) is additive;
    this subset only fires on obvious dark-lens / pushed-brow signals.
    """
    signals = 0
    if img is not None:
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        y0, y1 = int(h * 0.33), max(int(h * 0.50), int(h * 0.33) + 1)
        if y1 > y0:
            band = gray[y0:y1]
            overall_avg = float(gray.mean()) or 1.0
            if float(band.mean()) / overall_avg < 0.80:
                signals += 1
            if float((band < 60).mean()) > 0.20:
                signals += 1

    left_eye_w = dist(_lm(landmarks, 33), _lm(landmarks, 133))
    right_eye_w = dist(_lm(landmarks, 362), _lm(landmarks, 263))
    if left_eye_w > 0.001 and right_eye_w > 0.001:
        gap = (
            (_lm(landmarks, 159)["y"] - _lm(landmarks, 107)["y"]) / left_eye_w
            + (_lm(landmarks, 386)["y"] - _lm(landmarks, 336)["y"]) / right_eye_w
        ) / 2
        if gap > 0.60:
            signals += 1

    if signals >= 2:
        return _fail("noGlasses", "Photo.validation.noGlasses.detected", "error", None, "Glasses detected")
    return None


def run_landmark_checks(landmarks: list, img, pose_id: str) -> list[dict]:
    """Landmark-based content checks for one detected face (no MediaPipe run).

    Separated from ``run_photo_checks`` so the check math is unit-testable
    with synthetic landmarks; ``run_photo_checks`` calls this after the
    MediaPipe detection succeeds.
    """
    failures: list[dict] = []
    is_front = pose_id == "front"
    is_smile = pose_id == "smile"
    is_angle45 = pose_id in ("left45", "right45")
    is_profile = pose_id in ("leftProfile", "rightProfile")
    is_top_head = pose_id == "topHead"

    check = _check_correct_pose(landmarks, pose_id)
    if check:
        failures.append(check)

    if is_front or is_angle45:
        check = _check_neutral_expression(landmarks)
        if check:
            failures.append(check)
        check = _check_eyes_open(landmarks)
        if check:
            failures.append(check)
    elif is_smile:
        check = _check_eyes_open(landmarks)
        if check:
            failures.append(check)

    if is_front:
        for check in (_check_hair_clear(landmarks), _check_face_centered(landmarks)):
            if check:
                failures.append(check)

    check = _check_face_size(landmarks)
    if check:
        failures.append(check)

    if is_front or is_angle45 or is_smile:
        check = _check_glasses(img, landmarks)
        if check:
            failures.append(check)

    return failures


def run_photo_checks(image_bytes: bytes, pose_id: str) -> list[dict]:
    """Run coarse content checks on one photo.

    Returns the failed checks (``severity`` error or warning). Only error
    severity failures gate submission (see ``validate_photos_content``).
    """
    failures: list[dict] = []
    img = _decode(image_bytes)

    for check in (_check_resolution(img), _check_brightness(img), _check_sharpness(img)):
        if check:
            failures.append(check)

    is_profile = pose_id in ("leftProfile", "rightProfile")
    is_top_head = pose_id == "topHead"

    try:
        mp = analyze_with_mediapipe(image_bytes)
    except ValueError:
        # No face / undecodable. Mirrors FE: face is required for front, 45°
        # and smile; full profiles and topHead stay lenient (MediaPipe
        # reliably misses at 90°+).
        if not (is_profile or is_top_head):
            failures.append(_fail("faceDetected", "Photo.validation.faceDetected.none", "error", None, "No face detected"))
        return failures

    failures.extend(run_landmark_checks(mp["landmarks"], img, pose_id))
    return failures


def validate_photos_content(photos: list[tuple[str, bytes]]) -> list[dict]:
    """Run coarse checks over stored pose photos.

    ``photos`` is a list of ``(pose_id, image_bytes)``. Returns the
    error-severity failures (with ``poseId``) — the submit path raises 400 on
    any of these.
    """
    failures: list[dict] = []
    for pose_id, image_bytes in photos:
        for check in run_photo_checks(image_bytes, pose_id):
            if check["severity"] == "error":
                failures.append({"poseId": pose_id, **check})
    return failures
