"""Profile face-det crop + silhouette landmarks.

Mirrors ``scripts/profile_landmarks.py`` silhouette fallback (steps 1 + 4):
  - Face Detection on original, then cutout fallback
  - Silhouette on canvas (cutout when bg_remove=True, else original)

Backend naso-aural sidecar uses ``bg_remove=True`` (same as script default).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import cv2
import mediapipe as mp
import numpy as np

from .profile_silhouette import extract_profile_silhouette_points

logger = logging.getLogger(__name__)

# Same padding as scripts/profile_landmarks.py
_PAD_X_FRAC = 0.25
_PAD_TOP_FRAC = 0.35
_PAD_BOT_FRAC = 0.25

_SIL_SKIP = frozenset({"facingSide", "earSpanSource", "dataSource"})
# Hidden ear points — same as scripts/profile_landmarks.py (excluded from outside-x anchor)
_HIDDEN_EAR_NAMES = frozenset({
    "earTop", "earBottom", "ear_helix", "tragion",
    "right_ear_tragion", "left_ear_tragion",
})
_DEFAULT_BG_BGR = (255, 255, 255)


def mediapipe_solutions_available() -> bool:
    return getattr(mp, "solutions", None) is not None


def remove_background(
    bgr: np.ndarray,
    bg_bgr: tuple[int, int, int] = _DEFAULT_BG_BGR,
) -> tuple[np.ndarray, np.ndarray]:
    """MediaPipe Selfie Segmentation — optional; used by profile_landmarks script only."""
    solutions = getattr(mp, "solutions", None)
    if solutions is None:
        raise RuntimeError("MediaPipe solutions API unavailable for selfie segmentation")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with solutions.selfie_segmentation.SelfieSegmentation(model_selection=1) as seg:
        result = seg.process(rgb)
    if result.segmentation_mask is None:
        raise RuntimeError("Background segmentation failed")
    mask = (result.segmentation_mask > 0.5).astype(np.uint8) * 255
    mask_blur = cv2.GaussianBlur(mask, (7, 7), 0)
    alpha = (mask_blur.astype(np.float32) / 255.0)[..., None]
    bg = np.full_like(bgr, bg_bgr, dtype=np.uint8)
    out = (bgr.astype(np.float32) * alpha + bg.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)
    return out, mask


def detect_profile_face_box(bgr: np.ndarray) -> Optional[dict[str, Any]]:
    """MediaPipe Face Detection — works on true profiles when FaceMesh does not."""
    solutions = getattr(mp, "solutions", None)
    if solutions is None:
        logger.warning(
            "MediaPipe solutions API unavailable (need mediapipe==0.10.14 in project .venv); "
            "profile face-det crop cannot run"
        )
        return None

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with solutions.face_detection.FaceDetection(
        model_selection=0,
        min_detection_confidence=0.3,
    ) as fd:
        result = fd.process(rgb)
    if not result.detections:
        return None
    det = result.detections[0]
    bb = det.location_data.relative_bounding_box
    return {
        "score": float(det.score[0]) if det.score else None,
        "bbox_norm": {
            "xmin": bb.xmin,
            "ymin": bb.ymin,
            "width": bb.width,
            "height": bb.height,
        },
    }


def resolve_face_det_and_canvas(
    original: np.ndarray,
    *,
    bg_remove: bool = False,
    cutout: np.ndarray | None = None,
    bg_bgr: tuple[int, int, int] = _DEFAULT_BG_BGR,
) -> tuple[Optional[dict[str, Any]], np.ndarray, Optional[np.ndarray]]:
    """Match profile_landmarks: det on original then cutout; canvas per bg_remove flag."""
    mask: Optional[np.ndarray] = None
    if bg_remove:
        if cutout is None:
            cutout, mask = remove_background(original, bg_bgr)
    else:
        cutout = original

    # Detect on original first — cutout can hurt FaceMesh; Face Detection prefers original
    face_det = detect_profile_face_box(original) or detect_profile_face_box(cutout)
    canvas = cutout if bg_remove else original
    return face_det, canvas, mask


def expanded_face_crop(
    bgr: np.ndarray,
    face_det: dict[str, Any],
) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Crop to face bbox + padding so silhouette follows the head, not the frame edge."""
    h, w = bgr.shape[:2]
    bb = face_det["bbox_norm"]
    x0 = int(bb["xmin"] * w)
    y0 = int(bb["ymin"] * h)
    bw = max(1, int(bb["width"] * w))
    bh = max(1, int(bb["height"] * h))
    pad_x = int(bw * _PAD_X_FRAC)
    pad_top = int(bh * _PAD_TOP_FRAC)
    pad_bot = int(bh * _PAD_BOT_FRAC)
    cx0 = max(0, x0 - pad_x)
    cy0 = max(0, y0 - pad_top)
    cx1 = min(w, x0 + bw + pad_x)
    cy1 = min(h, y0 + bh + pad_bot)
    return bgr[cy0:cy1, cx0:cx1], (cx0, cy0, cx1, cy1)


def silhouette_points_full_norm(
    canvas: np.ndarray,
    face_det: dict[str, Any],
) -> dict[str, dict[str, float]]:
    """Silhouette cephalometric points mapped to full-image normalized 0–1 coords."""
    full_h, full_w = canvas.shape[:2]
    crop, (cx0, cy0, _, _) = expanded_face_crop(canvas, face_det)
    ok, enc = cv2.imencode(".jpg", crop)
    if not ok:
        return {}
    sil = extract_profile_silhouette_points(enc.tobytes())
    if not sil:
        return {}

    ch, cw = crop.shape[:2]
    out: dict[str, dict[str, float]] = {}
    for name, val in sil.items():
        if name in _SIL_SKIP or not isinstance(val, dict):
            continue
        x_px = float(val["x"]) * cw + cx0
        y_px = float(val["y"]) * ch + cy0
        out[name] = {
            "x": round(x_px / full_w, 6),
            "y": round(y_px / full_h, 6),
        }
    return out


def extract_silhouette_landmark_points(
    bgr: np.ndarray,
    *,
    bg_remove: bool = False,
    cutout: np.ndarray | None = None,
) -> dict[str, dict[str, float]]:
    """Full script-equivalent silhouette landmark dict (0–1), bg_remove off by default."""
    face_det, canvas, _ = resolve_face_det_and_canvas(
        bgr, bg_remove=bg_remove, cutout=cutout
    )
    if not face_det:
        return {}
    return silhouette_points_full_norm(canvas, face_det)


def _guide_anchor_xs(
    points: dict[str, dict[str, float]],
    face_det: dict[str, Any],
) -> list[float]:
    """Outside-x anchors like script ``_vertical_caliper_outside`` (visible pts + bbox)."""
    xs = [
        float(p["x"])
        for name, p in points.items()
        if name not in _HIDDEN_EAR_NAMES
    ]
    bb = face_det.get("bbox_norm") or {}
    xmin = bb.get("xmin")
    width = bb.get("width")
    if xmin is not None and width is not None:
        xs.extend([float(xmin), float(xmin) + float(width)])
    return xs


# Same midline indices as scripts/profile_landmarks.py MIDLINE_POINTS.
_MESH_GLABELLA_IDX = 9
_MESH_SUBNASALE_IDX = 2


def _try_facemesh_glabella_subnasale(
    images: list[np.ndarray],
) -> Optional[tuple[dict[str, float], dict[str, float]]]:
    """FaceMesh-first glabella/subnasale (0–1), matching profile_landmarks detect_facemesh."""
    solutions = getattr(mp, "solutions", None)
    if solutions is None or not images:
        return None

    for conf in (0.5, 0.2):
        for img in images:
            if img is None or img.size == 0:
                continue
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            with solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=conf,
            ) as mesh:
                result = mesh.process(rgb)
            if not result.multi_face_landmarks:
                continue
            lms = result.multi_face_landmarks[0].landmark
            if len(lms) <= max(_MESH_GLABELLA_IDX, _MESH_SUBNASALE_IDX):
                continue
            g = lms[_MESH_GLABELLA_IDX]
            s = lms[_MESH_SUBNASALE_IDX]
            glabella = {"x": round(float(g.x), 6), "y": round(float(g.y), 6)}
            subnasale = {"x": round(float(s.x), 6), "y": round(float(s.y), 6)}
            if float(subnasale["y"]) <= float(glabella["y"]) + 0.005:
                continue
            return glabella, subnasale
    return None


def extract_glabella_subnasale(
    profile_bytes: bytes,
    *,
    bg_remove: bool = True,
) -> tuple[Optional[dict], Optional[dict], list[float]]:
    """Glabella + subnasale + outside-x anchors (script-default ``bg_remove=True``).

    Prefers FaceMesh midline (idx 9 / 2) like ``scripts/profile_landmarks.py``;
    falls back to face-det crop + silhouette when mesh does not lock.
    """
    if not profile_bytes:
        return None, None, []
    arr = np.frombuffer(profile_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None, None, []

    face_det, canvas, _ = resolve_face_det_and_canvas(bgr, bg_remove=bg_remove)
    variants = [bgr]
    if canvas is not None and canvas is not bgr:
        variants.append(canvas)

    mesh_pts = _try_facemesh_glabella_subnasale(variants)
    if mesh_pts:
        glabella, subnasale = mesh_pts
        if face_det:
            points = silhouette_points_full_norm(canvas, face_det)
            anchors = _guide_anchor_xs(points, face_det) if points else []
        else:
            anchors = []
        if not anchors:
            anchors = [float(glabella["x"]), float(subnasale["x"])]
        return glabella, subnasale, anchors

    if not face_det:
        return None, None, []

    points = silhouette_points_full_norm(canvas, face_det)
    glabella = points.get("glabella")
    subnasale = points.get("subnasale") or points.get("noseBottom")
    if not glabella or not subnasale:
        return None, None, []

    return glabella, subnasale, _guide_anchor_xs(points, face_det)
