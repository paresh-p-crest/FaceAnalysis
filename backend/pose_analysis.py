"""MediaPipe Pose Landmarker — shoulder/ear landmarks for neck metrics.

Runs alongside FaceMesh (not a replacement). Used for neck length, shoulder
span, and head-forward posture from jaw (FaceMesh) + shoulders (Pose).
"""

from __future__ import annotations

from typing import Optional

import cv2
import mediapipe as mp
import numpy as np

# BlazePose landmark indices
NOSE = 0
LEFT_EAR = 7
RIGHT_EAR = 8
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12

_MIN_VISIBILITY = 0.5

_pose = None


def _get_pose():
    global _pose
    if _pose is None:
        _pose = mp.solutions.pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
        )
    return _pose


def analyze_with_pose(image_bytes: bytes) -> Optional[dict]:
    """Run MediaPipe Pose on image bytes.

    Returns:
        {
            "landmarks": [{"x", "y", "z", "visibility"}, ...],  # 33 points
            "shouldersVisible": bool,
            "earsVisible": bool,
        }
        or None if pose detection fails / image undecodable.
    """
    if not image_bytes:
        return None
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = _get_pose().process(rgb)
        if not results.pose_landmarks:
            return None

        landmarks = []
        for pt in results.pose_landmarks.landmark:
            landmarks.append(
                {
                    "x": float(pt.x),
                    "y": float(pt.y),
                    "z": float(pt.z),
                    "visibility": float(getattr(pt, "visibility", 0.0) or 0.0),
                }
            )

        def visible(idx: int) -> bool:
            return landmarks[idx]["visibility"] >= _MIN_VISIBILITY

        return {
            "landmarks": landmarks,
            "shouldersVisible": visible(LEFT_SHOULDER) and visible(RIGHT_SHOULDER),
            "earsVisible": visible(LEFT_EAR) and visible(RIGHT_EAR),
        }
    except Exception:
        return None


def pose_point(pose: dict, idx: int) -> Optional[dict]:
    lms = (pose or {}).get("landmarks") or []
    if idx < 0 or idx >= len(lms):
        return None
    return lms[idx]
