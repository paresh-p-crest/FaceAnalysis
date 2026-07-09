"""Per-view MediaPipe landmarking orchestrator."""

from __future__ import annotations

from typing import Optional

from .mediapipe_analysis import analyze_with_mediapipe

PROFILE_POSES = frozenset({"leftProfile", "rightProfile"})
QUARTER_POSES = frozenset({"left45", "right45"})
SPECIAL_POSES = frozenset({"smile", "topHead"})


def _landmark_visibility_score(landmarks: list) -> float:
    if not landmarks:
        return 0.0
    visible = sum(1 for pt in landmarks if 0.02 < pt.get("x", 0) < 0.98 and 0.02 < pt.get("y", 0) < 0.98)
    return round(visible / len(landmarks), 3)


def analyze_single_view(image_bytes: bytes, pose_id: str) -> dict:
    try:
        result = analyze_with_mediapipe(image_bytes)
        landmarks = result.get("landmarks", [])
        return {
            "poseId": pose_id,
            "success": True,
            "landmarks": landmarks,
            "faceCount": result.get("face_count", 0),
            "viewQuality": {
                "visibilityScore": _landmark_visibility_score(landmarks),
                "faceDetected": True,
            },
            "error": None,
        }
    except Exception as exc:
        return {
            "poseId": pose_id,
            "success": False,
            "landmarks": [],
            "faceCount": 0,
            "viewQuality": {"visibilityScore": 0.0, "faceDetected": False},
            "error": str(exc),
        }


def analyze_all_views(front_bytes: bytes, photos: Optional[dict[str, bytes]] = None) -> dict:
    """Run MediaPipe on front + each uploaded auxiliary pose."""
    photos = photos or {}
    views: dict[str, dict] = {}

    views["front"] = analyze_single_view(front_bytes, "front")

    for pose_id, data in photos.items():
        if pose_id == "front" or not data:
            continue
        views[pose_id] = analyze_single_view(data, pose_id)

    analyzed = [pid for pid, v in views.items() if v.get("success")]
    return {
        "views": views,
        "posesAnalyzed": analyzed,
        "frontLandmarks": views.get("front", {}).get("landmarks", []),
    }
