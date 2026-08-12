"""Required pose presence + simple submit-time photo sanity checks.

Division of responsibility (read this before "re-mirroring" FE checks here):

- **Frontend** (`artifacts/myface/utils/photoValidation.js`) is the fine gate.
  At upload it runs the full 11-check suite, including 3D yaw/pitch pose via
  MediaPipe Tasks ``facialTransformationMatrixes``. That is the source of
  truth for "is this the right pose / expression / glasses / …".

- **Backend** here is only a bypass/garbage guard at submit. A client can
  skip the FE validator; we still refuse obviously unusable bytes (blank,
  pitch black / blown out, no face where MediaPipe should find one). We
  deliberately do **not** re-check pose direction, expression, eyes, hair,
  glasses, centering, or face size — those either cannot be reproduced
  faithfully in Python FaceMesh (no ``facialTransformationMatrixes``) or
  false-reject photos that already passed the FE (seen in production with
  left45/right45 noseRatio vs 3D yaw disagreement).

Keep this module small. If a check is not "is there a usable face in this
image?", it belongs on the frontend.
"""

from __future__ import annotations

import cv2
import numpy as np

from .config import PHOTO_POSES
from .mediapipe_analysis import analyze_with_mediapipe

REQUIRED_POSE_IDS: tuple[str, ...] = tuple(
    p["id"] for p in PHOTO_POSES if p.get("required", False)
)

# Poses where MediaPipe FaceMesh is expected to find a face. Full 90° profiles
# and top-of-head often miss detection even on good photos — stay lenient there
# (same policy as the FE's inconclusive faceDetected path for those slots).
_FACE_REQUIRED_POSES = frozenset({"front", "smile", "left45", "right45"})


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


def _decode(image_bytes: bytes):
    if not image_bytes:
        return None
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def _check_resolution(img) -> dict | None:
    """Reject tiny images that cannot support analysis crops."""
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
    """Reject near-black / near-white frames only (blank uploads, covered lens).

    Not a lighting-quality gate — soft/warm FE-passed photos must not fail here.
    """
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    avg = float(gray.mean())
    if avg < 40:
        return _fail("brightness", "Photo.validation.brightness.veryDark", "error", None, "Photo is too dark")
    if avg > 230:
        return _fail("brightness", "Photo.validation.brightness.overexposed", "error", None, "Photo is overexposed")
    return None


def run_photo_checks(image_bytes: bytes, pose_id: str) -> list[dict]:
    """Simple submit-time sanity checks for one stored photo.

    Returns failed checks. Only ``severity == "error"`` gates submission
    (see ``validate_photos_content``).
    """
    failures: list[dict] = []
    img = _decode(image_bytes)

    for check in (_check_resolution(img), _check_brightness(img)):
        if check:
            failures.append(check)

    face_required = pose_id in _FACE_REQUIRED_POSES
    try:
        analyze_with_mediapipe(image_bytes)
    except ValueError:
        # No face / undecodable. Require a face only where MediaPipe is reliable;
        # leftProfile / rightProfile / topHead stay lenient.
        if face_required:
            failures.append(
                _fail("faceDetected", "Photo.validation.faceDetected.none", "error", None, "No face detected")
            )
        return failures

    return failures


def validate_photos_content(photos: list[tuple[str, bytes]]) -> list[dict]:
    """Run simple sanity checks over stored pose photos at submit.

    ``photos`` is a list of ``(pose_id, image_bytes)``. Returns error-severity
    failures (with ``poseId``) — the submit path raises 400 on any of these.
    """
    failures: list[dict] = []
    for pose_id, image_bytes in photos:
        for check in run_photo_checks(image_bytes, pose_id):
            if check["severity"] == "error":
                failures.append({"poseId": pose_id, **check})
    return failures
