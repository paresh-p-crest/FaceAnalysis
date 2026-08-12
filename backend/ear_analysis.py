"""Dedicated ear landmarker (20 contour points) for profile photos.

Lazy-loads ``models/ear_landmarker.pth`` (onnx2torch GraphModule checkpoint),
auto-downloading from the flame-head-tracker release when missing.
Full-image letterbox → 368 → heatmap decode channels 0–19 → outlier repair →
vertical / horizontal / slant measurements. Soft-fails when download/load or
profiles are missing so FaceMesh ``ears`` fields stay intact.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Optional

import cv2
import numpy as np

from .model_store import ensure_ear_landmarker_weights

logger = logging.getLogger(__name__)

INPUT_SIZE = 368
NUM_HEATMAP_CHANNELS = 55
EAR_LMK_COUNT = 20
SOFT_BOTTOM_FRAC = 0.045
EDGE_COLLAPSE_FAIL = 0.25
GAUSSIAN_SIGMA = 2.5
PAD_COLOR = (128, 128, 128)

# Same URL as the research notebook (PeizhiYan/flame-head-tracker release asset).
DEFAULT_EAR_LANDMARKER_URL = (
    "https://github.com/PeizhiYan/flame-head-tracker/releases/download/resource/ear_landmarker.pth"
)

REGION_INDICES = {
    "helix": list(range(2, 13)),
    "lobe": list(range(13, 19)),
    "tragus": [19, 0, 1],
}

PROFILE_SIDES = (
    ("left", "leftProfile"),
    ("right", "rightProfile"),
)

_model_lock = threading.Lock()
_model: Optional[Any] = None
_model_device: Optional[str] = None


def _resolve_device() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def _get_model() -> tuple[Optional[Any], Optional[str]]:
    """Lazy singleton: ensure weights, then load GraphModule. Retryable on failure."""
    global _model, _model_device
    if _model is not None:
        return _model, _model_device

    with _model_lock:
        if _model is not None:
            return _model, _model_device
        path = ensure_ear_landmarker_weights()
        if path is None or not path.is_file():
            logger.warning("Ear landmarker weights unavailable — skipping.")
            return None, None
        try:
            import torch

            device = _resolve_device()
            ckpt = torch.load(str(path), map_location=device, weights_only=False)
            if hasattr(ckpt, "eval"):
                ckpt.eval()
            _model = ckpt
            _model_device = device
            logger.info("Ear landmarker loaded from %s on %s.", path, device)
        except Exception as exc:
            logger.warning("Ear landmarker load failed: %s", exc)
            _model = None
            _model_device = None
            # Soft-fail this run; next assessment may re-download / retry.
    return _model, _model_device


def reset_ear_landmarker_cache() -> None:
    """Test helper — clear singleton so the next call reloads (or re-skips)."""
    global _model, _model_device
    with _model_lock:
        _model = None
        _model_device = None


def letterbox_full_image(
    rgb: np.ndarray,
    input_size: int = INPUT_SIZE,
    pad_color: tuple[int, int, int] = PAD_COLOR,
) -> tuple[np.ndarray, dict]:
    """Pad RGB to square then resize to ``input_size``. Returns float32 NHWC [0,1] + meta."""
    h, w = rgb.shape[:2]
    side = max(w, h)
    canvas = np.full((side, side, 3), pad_color, dtype=np.uint8)
    ox, oy = (side - w) // 2, (side - h) // 2
    canvas[oy : oy + h, ox : ox + w] = rgb
    resized = cv2.resize(canvas, (input_size, input_size), interpolation=cv2.INTER_LINEAR)
    arr = resized.astype(np.float32) / 255.0
    meta = {
        "orig_size": (w, h),
        "pad_offset": (ox, oy),
        "padded_side": side,
        "input_size": input_size,
    }
    return arr, meta


def landmarks_input_to_full(landmarks_input: np.ndarray, meta: dict) -> np.ndarray:
    """Map landmarks from INPUT_SIZE square back to original full-image pixels."""
    side = float(meta["padded_side"])
    ox, oy = meta["pad_offset"]
    scale = side / float(meta["input_size"])
    pts = np.asarray(landmarks_input, dtype=np.float32).copy()
    pts *= scale
    pts[:, 0] -= ox
    pts[:, 1] -= oy
    return pts


def repair_contour_outliers(
    points: np.ndarray,
    max_edge_mult: float = 3.0,
    max_passes: int = 3,
) -> tuple[np.ndarray, list[int]]:
    """Snap contour points that jump far from both neighbors back onto the ring.

    Returns repaired points and the unique indices that were replaced (any pass).
    """
    pts = np.asarray(points, dtype=np.float32).copy()
    n = len(pts)
    repaired: set[int] = set()
    if n < 3:
        return pts, []

    for _ in range(max_passes):
        edges = np.linalg.norm(np.roll(pts, -1, axis=0) - pts, axis=1)
        med = float(np.median(edges))
        if med < 1e-3:
            break
        limit = med * max_edge_mult
        fixed: list[int] = []
        for i in range(n):
            prev_i, next_i = (i - 1) % n, (i + 1) % n
            d_prev = float(np.linalg.norm(pts[i] - pts[prev_i]))
            d_next = float(np.linalg.norm(pts[i] - pts[next_i]))
            if d_prev > limit and d_next > limit:
                pts[i] = 0.5 * (pts[prev_i] + pts[next_i])
                fixed.append(i)
                repaired.add(i)
        if not fixed:
            break
    return pts, sorted(repaired)


def decode_heatmaps(output: np.ndarray, input_size: int = INPUT_SIZE) -> tuple[np.ndarray, np.ndarray, float]:
    """Decode model output → (landmarks_xy [20,2] in input space, confidences[20], edge_frac)."""
    out = np.asarray(output)
    if out.ndim == 4:
        out = out[0]
    if out.shape[-1] == NUM_HEATMAP_CHANNELS:
        heatmaps_hwc = out
    elif out.shape[0] == NUM_HEATMAP_CHANNELS:
        heatmaps_hwc = np.transpose(out, (1, 2, 0))
    else:
        raise ValueError(f"No {NUM_HEATMAP_CHANNELS}-channel axis in {out.shape}")

    heatmaps_up = cv2.resize(heatmaps_hwc, (input_size, input_size), interpolation=cv2.INTER_LINEAR)
    heatmaps_smooth = np.stack(
        [cv2.GaussianBlur(heatmaps_up[:, :, i], (0, 0), GAUSSIAN_SIGMA) for i in range(NUM_HEATMAP_CHANNELS)],
        axis=2,
    )

    landmarks = np.zeros((EAR_LMK_COUNT, 2), dtype=np.float32)
    confidences = np.zeros(EAR_LMK_COUNT, dtype=np.float32)
    for i in range(EAR_LMK_COUNT):
        hm = heatmaps_smooth[:, :, i]
        y, x = np.unravel_index(int(np.argmax(hm)), hm.shape)
        landmarks[i] = [x, y]
        confidences[i] = float(hm[y, x])

    edge_frac = float(
        (
            (landmarks[:, 0] <= 3)
            | (landmarks[:, 0] >= input_size - 4)
            | (landmarks[:, 1] <= 3)
            | (landmarks[:, 1] >= input_size - 4)
        ).mean()
    )
    return landmarks, confidences, edge_frac


def compute_ear_measurements(
    points_px: np.ndarray,
    image_size: tuple[int, int],
    soft_bottom_frac: float = SOFT_BOTTOM_FRAC,
) -> dict:
    """Vertical / horizontal / slant from 20 contour points in full-image px.

    ``image_size`` is (width, height). Norm = px / corresponding dimension.
    """
    outer = np.asarray(points_px, dtype=np.float32)[:EAR_LMK_COUNT]
    w, h = float(image_size[0]), float(image_size[1])
    helix_ids = [i for i in REGION_INDICES["helix"] if i < len(outer)]
    lobe_ids = [i for i in REGION_INDICES["lobe"] if i < len(outer)]

    helix_pts = outer[helix_ids] if helix_ids else outer
    lobe_pts = outer[lobe_ids] if lobe_ids else outer

    helix_top = helix_pts[int(np.argmin(helix_pts[:, 1]))]
    lobe_bottom = lobe_pts[int(np.argmax(lobe_pts[:, 1]))]
    lobe_left = lobe_pts[int(np.argmin(lobe_pts[:, 0]))]

    lobe_center = lobe_pts.mean(axis=0)
    down = lobe_bottom - lobe_center
    if float(np.linalg.norm(down)) < 1e-3:
        down = np.array([0.0, 1.0], dtype=np.float32)
    else:
        down = down / np.linalg.norm(down)

    x_min, x_max = float(outer[:, 0].min()), float(outer[:, 0].max())
    y_min = float(helix_pts[:, 1].min())
    y_lobe = float(lobe_bottom[1])
    pre_h = max(y_lobe - y_min, 1.0)
    extend_px = soft_bottom_frac * pre_h
    y_ext = float((lobe_bottom + down * extend_px)[1])
    y_max = max(y_lobe, y_ext)

    vertical_px = max(y_max - y_min, 0.0)
    horizontal_px = max(x_max - x_min, 0.0)

    slant_end = lobe_left + down * extend_px
    raw0 = np.asarray(helix_top, dtype=np.float32)
    raw1 = np.asarray(slant_end, dtype=np.float32)
    raw_d = raw1 - raw0
    if abs(float(raw_d[1])) < 1e-3:
        slant_p0 = np.array([raw0[0], y_min], dtype=np.float32)
        slant_p1 = np.array([raw1[0], y_max], dtype=np.float32)
    else:
        t_top = (y_min - float(raw0[1])) / float(raw_d[1])
        t_bot = (y_max - float(raw0[1])) / float(raw_d[1])
        slant_p0 = raw0 + raw_d * t_top
        slant_p1 = raw0 + raw_d * t_bot
    slant_px = float(np.linalg.norm(slant_p1 - slant_p0))

    def _norm_pt(pt: np.ndarray) -> dict:
        return {"x": round(float(pt[0]) / w, 6), "y": round(float(pt[1]) / h, 6)}

    return {
        "verticalHeightNorm": round(vertical_px / h, 6) if h else None,
        "horizontalWidthNorm": round(horizontal_px / w, 6) if w else None,
        "slantHeightNorm": round(slant_px / h, 6) if h else None,
        "verticalHeightPx": round(vertical_px, 2),
        "horizontalWidthPx": round(horizontal_px, 2),
        "slantHeightPx": round(slant_px, 2),
        "softBottomFrac": soft_bottom_frac,
        "helixTop": _norm_pt(helix_top),
        "lobeBottom": _norm_pt(lobe_bottom),
        "lobeLeft": _norm_pt(lobe_left),
    }


def _bytes_to_rgb(image_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(image_bytes, np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def _flip_rgb_h(rgb: np.ndarray) -> np.ndarray:
    return np.ascontiguousarray(rgb[:, ::-1, :])


def _mirror_x_landmarks(pts: np.ndarray, width: float) -> np.ndarray:
    out = np.asarray(pts, dtype=np.float32).copy()
    out[:, 0] = width - 1.0 - out[:, 0]
    return out


def _run_inference(model: Any, device: str, rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, float, dict]:
    import torch

    arr, meta = letterbox_full_image(rgb)
    tensor = torch.from_numpy(arr).float().unsqueeze(0)
    if device == "cuda":
        tensor = tensor.to(device)
        model = model.to(device)
    with torch.no_grad():
        output = model(tensor)
    if hasattr(output, "detach"):
        out_np = output.detach().cpu().numpy()
    else:
        out_np = np.asarray(output)
    landmarks_in, confidences, edge_frac = decode_heatmaps(out_np)
    landmarks_full = landmarks_input_to_full(landmarks_in, meta)
    return landmarks_full, confidences, edge_frac, meta


def _analyze_one_side(
    image_bytes: bytes,
    pose_id: str,
    model: Any,
    device: str,
    try_mirror: bool = True,
) -> dict:
    rgb = _bytes_to_rgb(image_bytes)
    if rgb is None:
        return {"poseId": pose_id, "status": "failed", "reason": "decode_error"}

    h, w = rgb.shape[:2]
    mirrored = False
    try:
        landmarks_full, confidences, edge_frac, _meta = _run_inference(model, device, rgb)
        # Right profiles often face the opposite way from training data — retry flipped.
        if try_mirror and edge_frac > EDGE_COLLAPSE_FAIL:
            landmarks_m, conf_m, edge_m, _ = _run_inference(model, device, _flip_rgb_h(rgb))
            if edge_m < edge_frac:
                landmarks_full = _mirror_x_landmarks(landmarks_m, float(w))
                confidences = conf_m
                edge_frac = edge_m
                mirrored = True
    except Exception as exc:
        logger.warning("Ear landmarker inference failed for %s: %s", pose_id, exc)
        return {"poseId": pose_id, "status": "failed", "reason": "inference_error"}

    if edge_frac > EDGE_COLLAPSE_FAIL:
        return {
            "poseId": pose_id,
            "status": "failed",
            "reason": "edge_collapse",
            "edgeCollapseFrac": round(edge_frac, 4),
            "mirrored": mirrored,
        }

    repaired, repaired_indices = repair_contour_outliers(landmarks_full)
    measurements = compute_ear_measurements(repaired, (w, h))
    landmarks_norm = [
        {
            "id": i,
            "x": round(float(repaired[i, 0]) / w, 6),
            "y": round(float(repaired[i, 1]) / h, 6),
        }
        for i in range(EAR_LMK_COUNT)
    ]
    return {
        "poseId": pose_id,
        "status": "ready",
        "imageSize": [w, h],
        "landmarks": landmarks_norm,
        "regions": {k: list(v) for k, v in REGION_INDICES.items()},
        "measurements": measurements,
        "confidences": [round(float(c), 4) for c in confidences.tolist()],
        "edgeCollapseFrac": round(edge_frac, 4),
        "repairedIndices": repaired_indices,
        "mirrored": mirrored,
    }


def analyze_profile_ears(photos: Optional[dict] = None) -> dict:
    """Return additive ear-landmarker payload for available profile poses.

    Shape::

        {
          "earLandmarkSource": "ear_landmarker",
          "sides": {
            "left":  { status, poseId, ... },
            "right": { status, poseId, ... },
          }
        }

    Returns ``{}`` when the model cannot load (caller should leave FaceMesh ears
    unchanged). When the model loads, always returns both side keys — missing
    poses are ``status: skipped``.
    """
    photos = photos or {}
    model, device = _get_model()
    if model is None or device is None:
        return {}

    sides: dict[str, dict] = {}
    any_bytes = False
    for side_key, pose_id in PROFILE_SIDES:
        raw = photos.get(pose_id)
        if not raw:
            sides[side_key] = {"poseId": pose_id, "status": "skipped", "reason": "pose_missing"}
            continue
        any_bytes = True
        sides[side_key] = _analyze_one_side(raw, pose_id, model, device)

    if not any_bytes:
        # Model loaded but nothing to run — still emit skipped sides so callers
        # can see the landmarker path was considered.
        return {"earLandmarkSource": "ear_landmarker", "sides": sides}

    return {"earLandmarkSource": "ear_landmarker", "sides": sides}
