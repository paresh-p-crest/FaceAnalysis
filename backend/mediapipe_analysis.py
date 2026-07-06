"""Port of mediapipeAnalysis.js — MediaPipe FaceLandmarker wrapper.

Uses the Python mediapipe package (FaceMesh) which provides the same 478-point
face mesh as the JS @mediapipe/tasks-vision library.  Landmark coordinates are
normalised to [0, 1] — identical to the JS version.
"""

from __future__ import annotations
import io
import numpy as np
from typing import Tuple, List, Optional

import cv2
import mediapipe as mp


_detector = None


def _get_detector():
    """Lazy-init the MediaPipe FaceMesh detector."""
    global _detector
    if _detector is None:
        _detector = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=0.5,
        )
    return _detector


def analyze_with_mediapipe(image_bytes: bytes) -> dict:
    """Run MediaPipe face mesh on image bytes.

    Returns:
        {
            "landmarks": [{"x": float, "y": float, "z": float}, ...],  # 478 points
            "face_count": int,
        }

    Raises:
        ValueError: If no face detected.
    """
    # Decode image from bytes
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    detector = _get_detector()
    results = detector.process(rgb)

    if not results.multi_face_landmarks:
        raise ValueError("No face detected by MediaPipe")

    face = results.multi_face_landmarks[0]
    landmarks = []
    for lm_pt in face.landmark:
        landmarks.append({"x": lm_pt.x, "y": lm_pt.y, "z": lm_pt.z})

    return {
        "landmarks": landmarks,
        "face_count": len(results.multi_face_landmarks),
    }
