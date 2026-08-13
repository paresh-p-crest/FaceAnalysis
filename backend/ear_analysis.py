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
# Soft-lobe extension off for now (caliper ends at visible lobe tip).
# Prior values: 0.045 (notebook), then 0.0225 (half).
# SOFT_BOTTOM_FRAC = 0.0225
SOFT_BOTTOM_FRAC = 0.0
EDGE_COLLAPSE_FAIL = 0.25
# --- Ear capture quality (shared: naso-aural proportions + ears feature hero) ---
# Heatmap edge collapse — stricter than EDGE_COLLAPSE_FAIL.
EAR_CAPTURE_MAX_EDGE = 0.15
EAR_CAPTURE_MIN_MEAN_CONF = 0.28
EAR_CAPTURE_HELIX_Y_MIN = 0.12
EAR_CAPTURE_HELIX_Y_MAX = 0.52
EAR_CAPTURE_LOBE_Y_MAX = 0.68
EAR_CAPTURE_VERT_MIN = 0.05
EAR_CAPTURE_VERT_MAX = 0.26
EAR_CAPTURE_REAR_X_RIGHT_MIN = 0.52  # xMaxNorm on rightProfile (rear pinna)
EAR_CAPTURE_REAR_X_LEFT_MAX = 0.48  # xMinNorm on leftProfile (rear pinna)
EAR_CAPTURE_MAX_REPAIRED = 3
# Legacy alias
NASO_EAR_PROPER_MAX_EDGE = EAR_CAPTURE_MAX_EDGE
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


def ear_vertical_x_pct(
    *,
    x_min_norm: float | None = None,
    x_max_norm: float | None = None,
    vertical_bracket_x_norm: float | None = None,
    helix_x_norm: float | None = None,
    facing_right: bool = True,
    gap_pct: float = 2.0,
) -> float | None:
    """Ear caliper vertical x in image % (0–100)."""
    if x_min_norm is not None and x_max_norm is not None:
        if facing_right:
            return max(0.5, min(99.5, float(x_max_norm) * 100.0 + gap_pct))
        return max(0.5, min(99.5, float(x_min_norm) * 100.0 - gap_pct))
    if vertical_bracket_x_norm is not None:
        return max(0.5, min(99.5, float(vertical_bracket_x_norm) * 100.0))
    if helix_x_norm is not None:
        hx = float(helix_x_norm) * 100.0
        return max(0.5, min(99.5, hx + (gap_pct if facing_right else -gap_pct)))
    return None


def build_nose_level_guides(
    *,
    glabella: dict,
    nose_bottom: dict,
    vertical_x_pct: float,
) -> list[dict]:
    """Dashed horizontals from ear vertical x to glabella/subnasale x (image % 0–100)."""
    g = _norm_point(glabella)
    nb = _norm_point(nose_bottom)
    if not g or not nb:
        return []

    vx = float(vertical_x_pct)

    def _seg(y_norm: float, landmark_x_norm: float) -> dict:
        lx = landmark_x_norm * 100.0
        y_pct = y_norm * 100.0
        x1, x2 = min(vx, lx), max(vx, lx)
        return {"y": round(y_pct, 2), "x1": round(x1, 2), "x2": round(x2, 2), "dashed": True}

    return [_seg(g["y"], g["x"]), _seg(nb["y"], nb["x"])]


def build_naso_aural_caliper_overlay(
    *,
    ear_measurements: dict,
    nose_top: dict,
    nose_bottom: dict,
    glabella: Optional[dict] = None,
    facing_right: bool = True,
) -> dict:
    """Qoves-style ear height bracket in image % (0–100).

    Ear vertical caliper (helix top → soft-extended lobe bottom) plus optional
    white dashed horizontal nose level guides at glabella and subnasale when
    ``glabella`` resolves. No nose vertical line.
    """
    ht = ear_measurements.get("helixTop") or {}
    sb = ear_measurements.get("softBottom") or ear_measurements.get("lobeBottom") or {}
    y0 = float(ht.get("y", 0)) * 100.0
    y1 = float(sb.get("y", 0)) * 100.0
    if abs(y1 - y0) < 0.5:
        return {"style": "qoves", "nasoLayout": "earOnly-v5", "brackets": [], "horizontal": []}

    x_min = ear_measurements.get("xMinNorm")
    x_max = ear_measurements.get("xMaxNorm")
    gap = 2.0  # ~notebook gap in image-%
    ht_x = ht.get("x")
    ear_x = ear_vertical_x_pct(
        x_min_norm=float(x_min) if x_min is not None else None,
        x_max_norm=float(x_max) if x_max is not None else None,
        vertical_bracket_x_norm=ear_measurements.get("verticalBracketXNorm"),
        helix_x_norm=float(ht_x) if ht_x is not None else None,
        facing_right=facing_right,
        gap_pct=gap,
    )
    if ear_x is None:
        return {"style": "qoves", "nasoLayout": "earOnly-v5", "brackets": [], "horizontal": []}

    ear_top_y, ear_bot_y = min(y0, y1), max(y0, y1)
    tick = 3.5

    guides = []
    if glabella and nose_bottom:
        guides = build_nose_level_guides(
            glabella=glabella,
            nose_bottom=nose_bottom,
            vertical_x_pct=ear_x,
        )

    layout = "earPlusNoseGuides-v6" if guides else "earOnly-v5"
    out: dict = {
        "style": "qoves",
        "nasoLayout": layout,
        "brackets": [
            {
                "id": "earVertical",
                "x1": round(ear_x, 2),
                "y1": round(ear_top_y, 2),
                "x2": round(ear_x, 2),
                "y2": round(ear_bot_y, 2),
                "tick": tick,
            },
        ],
        "horizontal": [
            {
                "y": round(ear_top_y, 2),
                "x1": round(ear_x - tick, 2),
                "x2": round(ear_x + tick, 2),
                "dashed": False,
            },
            {
                "y": round(ear_bot_y, 2),
                "x1": round(ear_x - tick, 2),
                "x2": round(ear_x + tick, 2),
                "dashed": False,
            },
        ],
    }
    if guides:
        out["guides"] = guides
    return out


def _norm_point(pt: Optional[dict]) -> Optional[dict]:
    """Accept 0–1 or image-% point dicts; return 0–1 ``{x,y,z}`` or None."""
    if not isinstance(pt, dict):
        return None
    try:
        x, y = float(pt["x"]), float(pt["y"])
    except (KeyError, TypeError, ValueError):
        return None
    if x > 1.5 or y > 1.5:
        x, y = x / 100.0, y / 100.0
    if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
        return None
    return {"x": x, "y": y, "z": float(pt.get("z") or 0.0)}


def _nose_points_from_fields(
    nose_top: Optional[dict], nose_bottom: Optional[dict]
) -> tuple[Optional[dict], Optional[dict]]:
    top = _norm_point(nose_top)
    bot = _norm_point(nose_bottom)
    if not top or not bot or abs(bot["y"] - top["y"]) < 1e-4:
        return None, None
    if top["y"] > bot["y"]:
        top, bot = bot, top
    return top, bot


def _nose_points_from_overlay(overlay: Optional[dict]) -> tuple[Optional[dict], Optional[dict]]:
    """Recover nose top/bottom as 0–1 points from a stored image-% overlay."""
    if not isinstance(overlay, dict):
        return None, None
    # Explicit fields (preferred when present on nasoAural itself — callers pass overlay only)
    top, bot = _nose_points_from_fields(overlay.get("noseTop"), overlay.get("noseBottom"))
    if top and bot:
        return top, bot
    # New Qoves brackets
    for b in overlay.get("brackets") or []:
        if b.get("id") == "noseVertical":
            try:
                y1 = float(b["y1"]) / 100.0
                y2 = float(b["y2"]) / 100.0
                x = float(b.get("x1", b.get("x2", 50))) / 100.0
                top_y, bot_y = (y1, y2) if y1 <= y2 else (y2, y1)
                return {"x": x, "y": top_y, "z": 0.0}, {"x": x, "y": bot_y, "z": 0.0}
            except (KeyError, TypeError, ValueError):
                pass
    segs = overlay.get("segments") or []
    if len(segs) >= 2:
        s1 = segs[1]
        try:
            y1 = float(s1["y1"]) / 100.0
            y2 = float(s1["y2"]) / 100.0
            x = float(s1.get("x1", s1.get("x2", 50))) / 100.0
            if abs(y2 - y1) < 1e-4:
                return None, None
            top_y, bot_y = (y1, y2) if y1 <= y2 else (y2, y1)
            return {"x": x, "y": top_y, "z": 0.0}, {"x": x, "y": bot_y, "z": 0.0}
        except (KeyError, TypeError, ValueError):
            pass
    horiz = overlay.get("horizontal") or []
    if len(horiz) >= 4:
        try:
            y1 = float(horiz[2]["y"]) / 100.0
            y2 = float(horiz[3]["y"]) / 100.0
            x = 0.55
            if abs(y2 - y1) < 1e-4:
                return None, None
            top_y, bot_y = (y1, y2) if y1 <= y2 else (y2, y1)
            return {"x": x, "y": top_y, "z": 0.0}, {"x": x, "y": bot_y, "z": 0.0}
        except (KeyError, TypeError, ValueError):
            pass
    return None, None


def resolve_glabella_for_profile(
    cv_report: dict,
    pose_id: str,
    naso: Optional[dict] = None,
) -> Optional[dict]:
    """Glabella in the same full-image space as ``pose_id`` (0–1)."""
    profile = (cv_report or {}).get("profile") or {}
    order = [pose_id]
    if pose_id == "leftProfile":
        order.append("rightProfile")
    else:
        order.append("leftProfile")
    for key in order:
        block = profile.get(key)
        if not isinstance(block, dict):
            continue
        ov = block.get("overlay") or {}
        for p in ov.get("convexityPoints") or []:
            if p.get("id") == "G":
                pt = _norm_point(p)
                if pt:
                    return pt
    naso = naso or {}
    pt = _norm_point(naso.get("glabella"))
    if pt and naso.get("photoSource") in (None, pose_id):
        return pt
    return None


def resolve_nose_points_for_profile(
    cv_report: dict,
    pose_id: str,
    naso: Optional[dict] = None,
) -> tuple[Optional[dict], Optional[dict]]:
    """Nose nasion→subnasale in the same full-image space as ``pose_id``.

    Prefer the matching 90° profile cephalometric overlay — never the primary
    view when that is a 45° pose (coords would miss the displayed profile).
    """
    profile = (cv_report or {}).get("profile") or {}
    order = [pose_id]
    if pose_id == "leftProfile":
        order.append("rightProfile")
    else:
        order.append("leftProfile")
    for key in order:
        block = profile.get(key)
        if not isinstance(block, dict):
            continue
        ov = (block.get("overlay") or {}).get("nasoAural")
        top, bot = _nose_points_from_overlay(ov)
        if top and bot:
            return top, bot
    naso = naso or {}
    top, bot = _nose_points_from_fields(naso.get("noseTop"), naso.get("noseBottom"))
    if top and bot and naso.get("photoSource") in (None, pose_id):
        return top, bot
    if naso.get("photoSource") == pose_id:
        return _nose_points_from_overlay(naso.get("overlay"))
    return None, None


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

    # Notebook Qoves cell: helix top = argmin(helix y); lobe bottom = argmax(lobe y).
    helix_top = helix_pts[int(np.argmin(helix_pts[:, 1]))].copy()
    lobe_bottom = lobe_pts[int(np.argmax(lobe_pts[:, 1]))].copy()
    lobe_left = lobe_pts[int(np.argmin(lobe_pts[:, 0]))]

    lobe_center = lobe_pts.mean(axis=0)
    down = lobe_bottom - lobe_center
    if float(np.linalg.norm(down)) < 1e-3:
        down = np.array([0.0, 1.0], dtype=np.float32)
    else:
        down = down / np.linalg.norm(down)

    x_min, x_max = float(outer[:, 0].min()), float(outer[:, 0].max())
    y_min = float(helix_top[1])
    y_lobe = float(lobe_bottom[1])
    pre_h = max(y_lobe - y_min, 1.0)
    # Soft-lobe extension (disabled while SOFT_BOTTOM_FRAC == 0):
    # extend_px = soft_bottom_frac * pre_h
    # soft_bottom = lobe_bottom + down * extend_px
    # y_ext = float(soft_bottom[1])
    # y_max = max(y_lobe, y_ext)
    extend_px = soft_bottom_frac * pre_h  # 0 for now
    y_max = y_lobe
    soft_bottom = lobe_bottom.copy()

    vertical_px = max(y_max - y_min, 0.0)
    horizontal_px = max(x_max - x_min, 0.0)

    # slant_end = lobe_left + down * extend_px  # soft-extend slant tip when enabled
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

    # Qoves vertical bracket sits just behind the pinna (outside toward the rear).
    gap_px = max(8.0, 0.02 * max(w, h))
    vert_x = x_max + gap_px
    soft_bottom_pt = np.array([float(soft_bottom[0]), y_max], dtype=np.float32)

    return {
        "verticalHeightNorm": round(vertical_px / h, 6) if h else None,
        "horizontalWidthNorm": round(horizontal_px / w, 6) if w else None,
        "slantHeightNorm": round(slant_px / h, 6) if h else None,
        "verticalHeightPx": round(vertical_px, 2),
        "horizontalWidthPx": round(horizontal_px, 2),
        "slantHeightPx": round(slant_px, 2),
        "softBottomFrac": soft_bottom_frac,
        "helixTop": _norm_pt(np.array([float(helix_top[0]), y_min], dtype=np.float32)),
        "lobeBottom": _norm_pt(lobe_bottom),
        "softBottom": _norm_pt(soft_bottom_pt),
        "lobeLeft": _norm_pt(lobe_left),
        "xMinNorm": round(x_min / w, 6) if w else None,
        "xMaxNorm": round(x_max / w, 6) if w else None,
        "verticalBracketXNorm": round(vert_x / w, 6) if w else None,
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
    side_out = {
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
    side_out["earCapture"] = evaluate_ear_capture(side_out)
    if not side_out["earCapture"].get("proper"):
        failed_checks = [
            k for k, v in (side_out["earCapture"].get("checks") or {}).items()
            if k != "status" and not v
        ]
        return {
            **side_out,
            "status": "failed",
            "reason": "capture_implausible",
            "failedChecks": failed_checks,
        }
    return side_out


def _ear_side_has_naso_measurements(side: dict) -> bool:
    meas = side.get("measurements") or {}
    if not meas.get("verticalHeightNorm") or not meas.get("helixTop"):
        return False
    return bool(meas.get("softBottom") or meas.get("lobeBottom"))


def evaluate_ear_capture(side: dict | None) -> dict:
    """Conclusive ear-capture gate for profile photos.

    Combines heatmap edge collapse, mean landmark confidence, mid-face vertical
    band, plausible ear height, rear-side horizontal placement, and contour
    repair count. Used by naso-aural proportions and ears feature hero selection.
    """
    failed = {
        "proper": False,
        "score": 0.0,
        "meanConfidence": 0.0,
        "checks": {"status": False},
    }
    if not isinstance(side, dict) or side.get("status") != "ready":
        return failed
    if not _ear_side_has_naso_measurements(side):
        return {**failed, "checks": {"measurements": False}}

    meas = side.get("measurements") or {}
    ht = meas.get("helixTop") or {}
    sb = meas.get("softBottom") or meas.get("lobeBottom") or {}
    try:
        helix_y = float(ht["y"])
        lobe_y = float(sb["y"])
        vert_h = float(meas.get("verticalHeightNorm") or 0)
        x_min = float(meas.get("xMinNorm") or 0)
        x_max = float(meas.get("xMaxNorm") or 0)
    except (KeyError, TypeError, ValueError):
        return {**failed, "checks": {"parse": False}}

    confs = side.get("confidences") or []
    mean_conf = sum(float(c) for c in confs) / len(confs) if confs else 0.0
    ec = float(side.get("edgeCollapseFrac") if side.get("edgeCollapseFrac") is not None else 1.0)
    repaired_n = len(side.get("repairedIndices") or [])
    facing_right = side.get("poseId") != "leftProfile"

    checks = {
        "status": True,
        "edge_ok": ec <= EAR_CAPTURE_MAX_EDGE,
        "confidence_ok": mean_conf >= EAR_CAPTURE_MIN_MEAN_CONF,
        "helix_band_ok": EAR_CAPTURE_HELIX_Y_MIN <= helix_y <= EAR_CAPTURE_HELIX_Y_MAX,
        "lobe_band_ok": (helix_y + 0.03) <= lobe_y <= EAR_CAPTURE_LOBE_Y_MAX,
        "height_ok": EAR_CAPTURE_VERT_MIN <= vert_h <= EAR_CAPTURE_VERT_MAX,
        "rear_side_ok": (
            x_max >= EAR_CAPTURE_REAR_X_RIGHT_MIN
            if facing_right
            else x_min <= EAR_CAPTURE_REAR_X_LEFT_MAX
        ),
        "contour_ok": repaired_n <= EAR_CAPTURE_MAX_REPAIRED,
    }
    proper = all(checks.values())
    score = round(sum(1 for v in checks.values() if v) / len(checks), 3)
    return {
        "proper": proper,
        "score": score,
        "meanConfidence": round(mean_conf, 4),
        "checks": checks,
    }


def _ear_side_is_proper(side: dict | None) -> bool:
    if isinstance(side, dict) and isinstance(side.get("earCapture"), dict):
        return bool(side["earCapture"].get("proper"))
    return bool(evaluate_ear_capture(side).get("proper"))


def pick_profile_ear_side(sides: Optional[dict]) -> Optional[dict]:
    """Profile with a proper ear capture — right first, left fallback."""
    if not sides:
        return None
    for side_key in ("right", "left"):
        cand = sides.get(side_key)
        if _ear_side_is_proper(cand):
            return cand
    return None


def pick_naso_ear_side(sides: Optional[dict]) -> Optional[dict]:
    """Alias for ``pick_profile_ear_side`` (naso-aural proportions)."""
    return pick_profile_ear_side(sides)


def pick_best_naso_ear_side(sides: Optional[dict]) -> Optional[dict]:
    """Deprecated alias — naso-aural uses right-first ``pick_naso_ear_side``."""
    return pick_naso_ear_side(sides)


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


# --- Contour cutout hero crop (notebook Qoves-style soft mask on white) ---

def _as_np(points: Any) -> np.ndarray:
    return np.asarray(points, dtype=np.float32)


def ear_span(pts: Any, count: int = EAR_LMK_COUNT) -> np.ndarray:
    pts_arr = _as_np(pts)[:count]
    return np.maximum(pts_arr.max(axis=0) - pts_arr.min(axis=0), 1.0)


def expand_tragus_contour(
    points: Any,
    count: int = EAR_LMK_COUNT,
    offset_frac: float = 0.045,
    bulge_frac: float = 0.030,
    curve_samples: int = 18,
) -> np.ndarray:
    """Section-7 ring; tragus bowed outward by fractions of this ear's size."""
    pts = _as_np(points)[:count]
    tragus_ids = [i for i in REGION_INDICES["tragus"] if i < count]
    helix_ids = [i for i in REGION_INDICES["helix"] if i < count]
    lobe_ids = [i for i in REGION_INDICES["lobe"] if i < count]

    scale = float(np.mean(ear_span(pts, count)))
    offset_px = scale * offset_frac
    bulge_px = scale * bulge_frac

    face_dir = pts[tragus_ids].mean(axis=0) - pts.mean(axis=0)
    face_dir = face_dir / (np.linalg.norm(face_dir) + 1e-6)

    def push(p: np.ndarray, extra: float = 0.0) -> np.ndarray:
        return p + face_dir * (offset_px + extra)

    p19b = push(pts[19])
    p0b = push(pts[0], bulge_px)
    p1b = push(pts[1])

    ts = np.linspace(0, 1, curve_samples, dtype=np.float32)
    tragus_curve = np.stack(
        [
            (1 - ts) ** 2 * p19b[0] + 2 * (1 - ts) * ts * p0b[0] + ts**2 * p1b[0],
            (1 - ts) ** 2 * p19b[1] + 2 * (1 - ts) * ts * p0b[1] + ts**2 * p1b[1],
        ],
        axis=1,
    )
    return np.vstack([tragus_curve, pts[helix_ids], pts[lobe_ids]])


def ear_contour_polygon(points: Any, count: int = EAR_LMK_COUNT) -> np.ndarray:
    poly = expand_tragus_contour(points, count=count)
    return np.vstack([poly, poly[0:1]])


def render_ear_mask(
    height: int,
    width: int,
    poly: np.ndarray,
    dilate_px: int = 3,
    supersample: int = 4,
    edge_blur: float = 1.0,
) -> np.ndarray:
    ss = max(1, int(supersample))
    sh, sw = height * ss, width * ss
    poly_ss = poly.astype(np.float32).copy()
    poly_ss[:, 0] *= ss
    poly_ss[:, 1] *= ss

    mask = np.zeros((sh, sw), dtype=np.uint8)
    cv2.fillPoly(mask, [np.round(poly_ss).astype(np.int32)], 255)
    if dilate_px > 0:
        k = dilate_px * ss * 2 + 1
        mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)), 1)
    if ss > 1:
        mask = cv2.resize(mask, (width, height), interpolation=cv2.INTER_AREA)
    if edge_blur > 0:
        mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), edge_blur)
    return np.clip(mask, 0, 255).astype(np.uint8)


def composite_on_white(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    a = alpha.astype(np.float32) / 255.0
    return np.clip(
        rgb.astype(np.float32) * a[..., None] + 255.0 * (1.0 - a[..., None]),
        0,
        255,
    ).astype(np.uint8)


def make_hero_ear_crop(
    rgb: np.ndarray,
    points: Any,
    *,
    max_side: int = 384,
    pad_px: int = 0,
    dilate_px: int = 0,
    supersample: int = 4,
    edge_blur: float = 0.8,
) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Tight non-square contour cutout on white. Returns (crop_rgb, bbox xyxy)."""
    h, w = rgb.shape[:2]
    landmarks = _as_np(points)[:EAR_LMK_COUNT]
    poly = ear_contour_polygon(landmarks)
    mask = render_ear_mask(
        h,
        w,
        poly,
        dilate_px=dilate_px,
        supersample=supersample,
        edge_blur=edge_blur,
    )
    out = composite_on_white(rgb, mask)

    left = max(0, int(np.floor(poly[:, 0].min())) - pad_px)
    top = max(0, int(np.floor(poly[:, 1].min())) - pad_px)
    right = min(w, int(np.ceil(poly[:, 0].max())) + 1 + pad_px)
    bottom = min(h, int(np.ceil(poly[:, 1].max())) + 1 + pad_px)

    crop = out[top:bottom, left:right]
    if crop.size == 0:
        return crop, (left, top, right, bottom)
    if max_side and max(crop.shape[0], crop.shape[1]) > max_side:
        scale = max_side / max(crop.shape[0], crop.shape[1])
        new_w = max(1, int(round(crop.shape[1] * scale)))
        new_h = max(1, int(round(crop.shape[0] * scale)))
        crop = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    return crop, (left, top, right, bottom)


def _landmarks_norm_to_px(
    landmarks_norm: list[dict], width: int, height: int
) -> Optional[np.ndarray]:
    if not landmarks_norm or len(landmarks_norm) < EAR_LMK_COUNT:
        return None
    pts = np.zeros((EAR_LMK_COUNT, 2), dtype=np.float32)
    for i in range(EAR_LMK_COUNT):
        lm = landmarks_norm[i]
        pts[i, 0] = float(lm["x"]) * width
        pts[i, 1] = float(lm["y"]) * height
    return pts


def extract_ear_contour_crop(
    pose_bytes: bytes,
    landmarks_norm: list[dict],
    pose_id: str,
    *,
    max_side: int = 384,
    pad_px: int = 0,
    dilate_px: int = 0,
    supersample: int = 4,
    edge_blur: float = 0.8,
) -> Optional[dict[str, Any]]:
    """Landmarker contour cutout → JPEG crop dict for parsing storage."""
    rgb = _bytes_to_rgb(pose_bytes)
    if rgb is None:
        return None
    h, w = rgb.shape[:2]
    pts = _landmarks_norm_to_px(landmarks_norm, w, h)
    if pts is None:
        return None
    crop, bbox = make_hero_ear_crop(
        rgb,
        pts,
        max_side=max_side,
        pad_px=pad_px,
        dilate_px=dilate_px,
        supersample=supersample,
        edge_blur=edge_blur,
    )
    if crop.size == 0:
        return None
    cw, ch = crop.shape[1], crop.shape[0]
    x1, y1, x2, y2 = bbox
    bw, bh = max(1, x2 - x1), max(1, y2 - y1)
    # Reject thin diagonal slivers (misplaced landmarks on nose/neck).
    if min(cw, ch) < 24 or min(bw, bh) < max(16, 0.04 * min(w, h)):
        return None
    if max(cw, ch) / max(1, min(cw, ch)) > 6.0:
        return None
    bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        return None
    x1, y1, x2, y2 = bbox
    return {
        "bbox": [x1, y1, x2, y2],
        "labels": ["ear_landmarker_contour"],
        "jpegBytes": buf.tobytes(),
        "sourcePose": pose_id,
        "sourceMethod": "ear_landmarker_contour",
    }


def side_has_contour_landmarks(side: dict | None) -> bool:
    """True when landmarker produced enough points to build a contour cutout."""
    if not isinstance(side, dict):
        return False
    lms = side.get("landmarks")
    return isinstance(lms, list) and len(lms) >= EAR_LMK_COUNT


def resolve_ear_hero_crops(
    crop_key: str,
    segformer: Optional[dict[str, Any]],
    contour: Optional[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Primary ``earsLeft``/``earsRight`` = landmarker contour only; SegFormer suffix backup."""
    out: dict[str, dict[str, Any]] = {}
    if segformer:
        out[f"{crop_key}Segformer"] = segformer
    if contour:
        out[crop_key] = contour
    return out
