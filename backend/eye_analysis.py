"""Port of eyeAnalysis.js — Eye metrics, pixel analysis, and crop helpers.

All eye metric computations, canthal tilt, eyelid exposure, sclera color
classification, and under-eye analysis are preserved from the JS version.
"""

from __future__ import annotations
import math
from typing import Optional

import cv2
import numpy as np

from .face_crop import (
    lm, dist, bbox_from_indices, merge_bboxes, bbox_eyes_region,
    bbox_brows_region, RIGHT_EYE, LEFT_EYE,
)
from . import cv_report_explanations_de as expl_de


# Landmark groups for under-eye regions
LEFT_LOWER_LID = [33, 133, 157, 158, 159, 160, 173]
RIGHT_LOWER_LID = [362, 263, 385, 386, 387, 388, 390]
LEFT_UNDER = [111, 117, 118, 119, 120, 121]
RIGHT_UNDER = [340, 346, 347, 348, 349, 350]
# Upper lash-line sampling (upper eyelid contour)
LEFT_LASH_LINE = [33, 246, 161, 160, 159, 158, 157, 173, 133]
RIGHT_LASH_LINE = [263, 466, 388, 387, 386, 385, 384, 398, 362]

# MediaPipe iris landmarks — only present when the face mesh was run with
# refine_landmarks=True (478 points total instead of 468). Used to
# geometrically exclude the iris/pupil from sclera-color sampling, since a
# color-only filter can't reliably tell a light/desaturated iris apart from
# actual sclera.
# NOTE: swapped from the "standard" MediaPipe numbering (469-472 / 474-477)
# to match this codebase's LEFT_EYE/RIGHT_EYE handedness — confirmed via a
# debug_sclera.py diagnostic run: with the standard mapping, the "left"
# iris landmarks landed outside the LEFT_EYE crop bounds entirely, and vice
# versa for the right eye. This pairing is what actually lines up.
LEFT_IRIS = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]

# Inner-canthus landmarks — the medial corner of each eye, where the
# caruncle (a small naturally pink/red patch of tissue) sits. It falls
# inside the LEFT_EYE/RIGHT_EYE contour polygon and is bright/low-saturation
# enough to pass the sclera color filter below, which was skewing genuinely
# off-white/grey sclera readings toward "Red or pink". These match the same
# points already used as the inner-corner landmarks in
# compute_eye_metrics_from_landmarks (133 / 362).
LEFT_INNER_CANTHUS = 362
RIGHT_INNER_CANTHUS = 133


# ── Helpers ──

def _canthal_tilt_deg(outer: dict, inner: dict) -> float:
    """Canthal tilt angle in degrees."""
    return math.atan2(outer["y"] - inner["y"], outer["x"] - inner["x"]) * (180 / math.pi)


def _classify_tilt(avg_tilt: float) -> str:
    if avg_tilt > 2.5:
        return "Positive (upturned)"
    if avg_tilt < -0.5:
        return "Negative (downturned)"
    return "Neutral"


def _classify_exposure(ratio: float) -> str:
    if ratio > 0.34:
        return "High"
    if ratio > 0.24:
        return "Moderate"
    return "Low"


def _classify_sclera(stats: dict, skin_redness: Optional[float] = None) -> str:
    """Classify sclera appearance into one of 4 common categories, from
    averaged sclera-pixel stats.
    ``stats`` (see ``sample_sclera_stats``/``combine_sclera_stats``) carries:
    - whiteness/brightness/redness: BGR-derived
    - hue/saturation: HSV-derived average of the low-saturation "white"
      pixels, used to detect a real color tint rather than just brightness
    ``skin_redness`` is the same BGR-derived redness measure
    (``sample_region_stats``) taken from a skin patch in the *same* photo
    (see ``under_eye_metrics``/``analyze_eyes``). This is what makes the
    red/pink check lighting-invariant: a camera's white balance/color cast
    shifts sclera and skin redness together, so a fixed value like
    ``redness > 14`` fires on any warm-lit photo even for genuinely
    off-white/grey eyes (confirmed against real photos where the brightest,
    least-saturated pixels in the eye — the best-case true sclera — still
    read redness ~18-20 under warm indoor light, while skin in the same
    frame read redness ~40-90). Skin is always dramatically more red than
    healthy sclera regardless of lighting, so comparing sclera redness to
    the skin's own redness in the same shot is stable across cameras/light,
    where the raw value alone is not. When no skin reference is available,
    this falls back to the old fixed threshold.
    Categories: "Natural White", "Off-white / Slightly gray-white",
    "Yellow", "Red or pink".
    Previously this also tried to detect "Slightly blue" and "Brown or
    dark spots" — both turned out to fire on ordinary lash-shadow/limbal
    noise far more often than on an actual blue tint or real pigmented
    spot (those need localized/higher-resolution analysis to detect
    reliably, not an averaged-region heuristic like this one), so they've
    been removed in favor of thresholds tuned to only flag "Yellow" or
    "Red or pink" when there's a clear, unambiguous signal — otherwise it
    falls back to one of the two neutral white categories, which is what
    the vast majority of real eyes should read as.
    """
    hue = stats.get("hue")
    sat = stats.get("saturation", 0.0)
    whiteness = stats.get("whiteness", 0.0)
    redness = stats.get("redness", 0.0)
    brightness = stats.get("brightness", 0.0)

    # Red/pink (bloodshot / irritation). Both checks below key off the same
    # skin-relative redness gate: a fixed redness value shifts with the
    # photo's white balance/color cast (confirmed against real photos where
    # the brightest, least-saturated pixels in a healthy eye — the best-case
    # true sclera — still read redness ~18-20 under warm indoor light, with
    # skin in the same frame at redness ~40-90), so "redness > N" alone
    # fires on any warm-lit photo. Comparing sclera redness to skin redness
    # from the same shot cancels the lighting cast out.
    if skin_redness is not None and skin_redness > 5:
        red_ratio = redness / skin_redness
        elevated = redness > 10 and red_ratio > 0.75
        # Tuned against real photos where healthy off-white/grey sclera
        # landed at ratio ~0.35-0.6; needs real bloodshot examples to
        # sharpen further.
    else:
        # No skin reference available — fall back to the old absolute
        # cutoff (less reliable under non-neutral lighting).
        elevated = redness > 14

    if elevated:
        return "Red or pink"

    # Yellow (icteric / dull with age): require both a real yellow hue
    # signal AND reasonably strong saturation — low brightness alone
    # (previously the catch-all fallback) is not enough on its own, since
    # dim lighting isn't the same thing as an actual yellow tint.
    if hue is not None and 16 <= hue <= 50 and sat >= 18 and brightness > 80:
        return "Yellow"

    if whiteness > 175 and sat < 20:
        return "Natural White"
    return "Off-white / Slightly gray-white"


def _classify_under_eye(brightness: float) -> str:
    if brightness > 140:
        return "Good"
    if brightness > 110:
        return "Moderate"
    return "Shadowed"


def _lower_lid_bending(landmarks: list, indices: list) -> float:
    """Compute lower eyelid curvature bending ratio."""
    pts = [lm(landmarks, i) for i in indices]
    inner_pt, outer_pt = pts[0], pts[-1]
    line_len = dist(inner_pt, outer_pt) or 0.001
    max_dev = 0.0
    for p in pts[1:-1]:
        cross = abs(
            (outer_pt["x"] - inner_pt["x"]) * (inner_pt["y"] - p["y"])
            - (inner_pt["x"] - p["x"]) * (outer_pt["y"] - inner_pt["y"])
        )
        max_dev = max(max_dev, cross / line_len)
    return min(0.95, 0.68 + max_dev * 8)


def _curvature_label(k: float) -> str:
    if k >= 0.84:
        return "Within the common curvature range"
    if k >= 0.76:
        return "Slightly flatter than the common curvature range"
    return "Noticeably flatter than typical"


def _build_explanation(metrics: dict) -> str:
    return (
        f"Your eyes show {metrics['eyeTilt'].lower()} canthal tilt with "
        f"{metrics['eyelidExposure'].lower()} eyelid exposure. "
        f"Sclera reads as {metrics['scleraColor'].lower()} with "
        f"{metrics['underEyeHealth'].lower()} under-eye appearance. "
        f"Lower eyelid curvature ({metrics['lowerLidCurvature']}) is "
        f"{metrics['curvatureDescription'].lower()} — typical bending range is 0.76–0.92."
    )


def _build_explanation_de(metrics: dict) -> str:
    return (
        f"Deine Augen zeigen {metrics['eyeTilt'].lower()}en Kanthalneigungswinkel mit "
        f"{metrics['eyelidExposure'].lower()}er Lidexposition. "
        f"Die Sklera wirkt {metrics['scleraColor'].lower()} mit "
        f"{metrics['underEyeHealth'].lower()}em Unteraugen-Erscheinungsbild. "
        f"Die Unterlidkrümmung ({metrics['lowerLidCurvature']}) ist "
        f"{metrics['curvatureDescription'].lower()} — typischer Biegebereich ist 0,76–0,92."
    )


# ── Crop helpers (PIL-based, ported from JS canvas) ──

def crop_normalized(image_bytes: bytes, box: dict) -> bytes:
    """Crop a normalised bounding box region and return JPEG bytes."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return image_bytes

    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, min(w - sx, round(box["w"] * w)))
    sh = max(1, min(h - sy, round(box["h"] * h)))

    crop = img[sy:sy + sh, sx:sx + sw]
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buf.tobytes()


def sample_sclera_stats(
    image_bytes: bytes,
    box: dict,
    landmarks: Optional[list] = None,
    iris_indices: Optional[list] = None,
    eye_indices: Optional[list] = None,
    inner_canthus_idx: Optional[int] = None,
) -> dict:
    """Sample pixel statistics from the *whitish* pixels within a normalised
    eye bounding box, instead of averaging the whole box.
    ``box`` typically covers the full eye contour, which includes the dark
    iris/pupil, lashes, and some skin/lid. Averaging over all of that pulls
    brightness/whiteness down regardless of the actual sclera color, which
    previously caused every face to classify as "Yellow-tinged". Here we
    mask out the low-value / high-saturation pixels (skin, shadow, most
    iris colors) and only average the low-saturation, high-value ("white")
    pixels that actually correspond to the sclera.
    IMPORTANT: that color filter alone is not enough — a light/desaturated
    iris (common with brown eyes under bright/warm light, and with light
    blue/grey/hazel eyes in general) can pass the exact same "whitish"
    threshold as real sclera and get averaged in, which visibly skews the
    detected color (confirmed via debug_sclera.py). So on top of the color
    filter, we geometrically exclude a circle over the iris:
      - If ``landmarks`` includes MediaPipe's iris points (indices 468-477,
        only present when the face mesh was run with refine_landmarks=True)
        and ``iris_indices`` is passed, the iris circle is computed exactly
        from those points.
      - Otherwise we fall back to a rough estimate centered on the eye box
        with a radius as a fraction of eye width. This is an approximation
        (assumes forward gaze, doesn't track pupil dilation) — it's a
        safety net, not a substitute for real iris landmarks.
    If ``landmarks`` + ``eye_indices`` (the eye-contour landmark set, e.g.
    LEFT_EYE/RIGHT_EYE) are given, sampling is also clipped to the actual
    eyelid-opening polygon rather than the full rectangular box, so it
    can't pick up eyelashes or skin at the box's corners. Without this,
    ``box`` alone (a plain rectangle) can catch bright skin/lash pixels
    the polygon would have excluded — this was previously missing here
    even though the debug script already did it, so results could diverge
    between the two. If ``eye_indices`` isn't given, sampling falls back to
    the plain rectangular box as before.
    If ``landmarks`` + ``inner_canthus_idx`` (LEFT_INNER_CANTHUS /
    RIGHT_INNER_CANTHUS) are given, a small circle around the inner-corner
    landmark is also excluded. That corner holds the caruncle, a naturally
    pink/red bit of tissue that sits inside the eye-contour polygon and
    passes the same "whitish" color filter as real sclera — left in, it
    biases whiteness/redness toward "Red or pink" even for genuinely
    off-white/grey eyes. Without this arg, no caruncle exclusion is applied
    (matches old behavior).
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"brightness": 0, "whiteness": 0, "redness": 0}

    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, round(box["w"] * w))
    sh = max(1, round(box["h"] * h))
    sw = min(sw, w - sx)
    sh = min(sh, h - sy)
    if sw < 1 or sh < 1:
        return {"brightness": 0, "whiteness": 0, "redness": 0}

    region = img[sy:sy + sh, sx:sx + sw]
    hsv = cv2.cvtColor(region, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1].astype(np.float32)
    v = hsv[:, :, 2].astype(np.float32)

    # Eye-contour polygon clip (parity with debug_sclera.py) — restricts
    # sampling to the actual palpebral opening, not the whole rectangular
    # box, so eyelashes/skin near the box corners can't be picked up.
    if landmarks is not None and eye_indices:
        poly_pts = np.array(
            [[[round(landmarks[i]["x"] * w) - sx, round(landmarks[i]["y"] * h) - sy] for i in eye_indices]],
            dtype=np.int32,
        )
        poly_mask_u8 = np.zeros(region.shape[:2], dtype=np.uint8)
        cv2.fillPoly(poly_mask_u8, poly_pts, 255)
        poly_mask = poly_mask_u8 > 0
    else:
        poly_mask = np.ones(region.shape[:2], dtype=bool)

    # Geometric iris/pupil exclusion — see docstring above for why the
    # color filter alone can't be trusted to keep the iris out.
    has_real_iris_landmarks = (
        landmarks is not None and iris_indices
        and len(landmarks) > max(iris_indices)
    )
    if has_real_iris_landmarks:
        pts = np.array(
            [[landmarks[i]["x"] * w - sx, landmarks[i]["y"] * h - sy] for i in iris_indices],
            dtype=np.float32,
        )
        cx, cy = pts.mean(axis=0)
        radius = float(np.mean(np.linalg.norm(pts - [cx, cy], axis=1)))
        # No extra padding here: the 4 iris boundary landmarks already trace
        # the visible iris edge closely. A percentage pad over-excludes on
        # narrower/almond eye shapes, where the sclera visible above/below
        # the iris is only a thin sliver to begin with.
    else:
        # Fallback estimate: center of the eye box, radius as a fraction
        # of box width. Rough — real iris landmarks are strongly preferred.
        cx, cy = sw / 2.0, sh / 2.0
        radius = 0.27 * sw

    yy, xx = np.ogrid[: region.shape[0], : region.shape[1]]
    iris_excl = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius ** 2

    valid_area = poly_mask & ~iris_excl

    # Caruncle exclusion — cut out a small circle around the inner-canthus
    # landmark so the pink/red corner tissue can't be averaged in as if it
    # were sclera (see docstring above). Radius is scaled off the iris
    # radius when real iris landmarks are available (the caruncle is
    # noticeably smaller than the iris), otherwise a fraction of eye width.
    if landmarks is not None and inner_canthus_idx is not None:
        ccx = landmarks[inner_canthus_idx]["x"] * w - sx
        ccy = landmarks[inner_canthus_idx]["y"] * h - sy
        c_radius = (radius * 0.55) if has_real_iris_landmarks else (0.15 * sw)
        caruncle_excl = (xx - ccx) ** 2 + (yy - ccy) ** 2 <= c_radius ** 2
        valid_area &= ~caruncle_excl

    # Sclera pixels: low saturation, reasonably bright, inside the eye
    # polygon, outside the iris/pupil circle. Thresholds are looser than a
    # strict "pure white" cutoff (previously s<70 & v>90) because the
    # limbal ring (the natural darker ring where iris meets sclera) and
    # eyelash-cast shadow along the upper lid margin are still sclera, just
    # dimmer/slightly tinted — a strict cutoff excludes real sclera right
    # at those edges, leaving visible gaps next to the iris circle.
    mask = (s < 90) & (v > 65) & valid_area

    # Bridge small gaps (a few pixels of shadow/limbal-ring darkness that
    # still fail the filter) between otherwise-connected sclera regions,
    # then re-clip to the polygon and outside the iris so closing can't
    # leak into eyelashes, skin, or the iris itself.
    if mask.any():
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel).astype(bool)
        mask &= valid_area

    # If the mask is still too small (tight crop, unusual lighting, closed
    # eye), fall back to the brightest quartile of pixels in the valid
    # area — still excluding the iris circle and the polygon boundary, and
    # still capping saturation (looser than the primary filter) so a
    # bright, lightly-saturated bit of skin can't get pulled in.
    min_pixels = max(10, valid_area.sum() * 0.15)
    if mask.sum() < min_pixels:
        v_valid = v[valid_area]
        thresh = float(np.percentile(v_valid, 75)) if v_valid.size else float(np.percentile(v, 75))
        mask = (v >= thresh) & (s < 110) & valid_area

    b = region[:, :, 0][mask].astype(np.float32)
    g = region[:, :, 1][mask].astype(np.float32)
    r = region[:, :, 2][mask].astype(np.float32)
    if b.size == 0:
        return {
            "brightness": 0, "whiteness": 0, "redness": 0,
            "hueX": 0.0, "hueY": 0.0, "hueWeight": 0.0,
            "saturation": 0.0,
        }

    b_avg = float(np.mean(b))
    g_avg = float(np.mean(g))
    r_avg = float(np.mean(r))

    bright_sum = 0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg
    redness = r_avg - (g_avg + b_avg) / 2
    whiteness = bright_sum - redness * 0.5

    # Hue/saturation of the masked ("white") pixels, used to detect a
    # real color tint (yellow/red) rather than just overall brightness.
    # Hue is circular (0 and 179 are adjacent), so accumulate it as a
    # weighted vector (weighted by saturation, since low-saturation pixels
    # have a noisy/meaningless hue) — the angle is only resolved back into
    # a single hue value once all eyes are combined, in combine_sclera_stats.
    h_masked = hsv[:, :, 0][mask].astype(np.float32)
    s_masked = s[mask]
    hue_rad = h_masked * (2 * np.pi / 180.0)
    hue_x = float(np.sum(s_masked * np.cos(hue_rad)))
    hue_y = float(np.sum(s_masked * np.sin(hue_rad)))
    hue_weight = float(np.sum(s_masked))
    avg_sat = float(np.mean(s_masked))

    return {
        "brightness": round(bright_sum, 1),
        "whiteness": round(whiteness, 1),
        "redness": round(redness, 1),
        "hueX": hue_x,
        "hueY": hue_y,
        "hueWeight": hue_weight,
        "saturation": round(avg_sat, 1),
    }


def combine_sclera_stats(left: dict, right: dict) -> dict:
    """Merge left/right sclera stats into one reading for classification.
    Plain-averages brightness/whiteness/redness/saturation, but hue is
    circular so it's resolved from the combined weighted vector (summed
    from both eyes) rather than averaged directly — averaging two raw hue
    angles breaks near the 0/179 wraparound (e.g. a near-red hue of 2 and
    one of 177 are actually close together, not far apart).
    """
    hue_x = left.get("hueX", 0.0) + right.get("hueX", 0.0)
    hue_y = left.get("hueY", 0.0) + right.get("hueY", 0.0)
    hue_weight = left.get("hueWeight", 0.0) + right.get("hueWeight", 0.0)
    hue = None
    if hue_weight > 1e-6:
        angle_deg = math.degrees(math.atan2(hue_y, hue_x)) % 360
        hue = angle_deg / 2  # back to OpenCV's 0-179 hue scale

    return {
        "brightness": (left.get("brightness", 0) + right.get("brightness", 0)) / 2,
        "whiteness": (left.get("whiteness", 0) + right.get("whiteness", 0)) / 2,
        "redness": (left.get("redness", 0) + right.get("redness", 0)) / 2,
        "saturation": (left.get("saturation", 0) + right.get("saturation", 0)) / 2,
        "hue": hue,
    }


def sample_region_stats(image_bytes: bytes, box: dict) -> dict:
    """Sample pixel statistics from a normalised bounding box region."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"brightness": 0, "whiteness": 0, "redness": 0}

    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, round(box["w"] * w))
    sh = max(1, round(box["h"] * h))
    sw = min(sw, w - sx)
    sh = min(sh, h - sy)
    if sw < 1 or sh < 1:
        return {"brightness": 0, "whiteness": 0, "redness": 0}

    region = img[sy:sy + sh, sx:sx + sw]
    b_avg = float(np.mean(region[:, :, 0]))
    g_avg = float(np.mean(region[:, :, 1]))
    r_avg = float(np.mean(region[:, :, 2]))

    bright_sum = 0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg
    redness = r_avg - (g_avg + b_avg) / 2
    whiteness = bright_sum - redness * 0.5

    return {"brightness": round(bright_sum, 1), "whiteness": round(whiteness, 1), "redness": round(redness, 1)}


# ── Core eye metrics ──

def compute_eye_metrics_from_landmarks(landmarks: list) -> dict:
    """Compute eye metrics from MediaPipe landmarks — pure math, no image."""
    re_o = lm(landmarks, 33)
    re_i = lm(landmarks, 133)
    le_o = lm(landmarks, 263)
    le_i = lm(landmarks, 362)
    le_top = lm(landmarks, 159)
    le_bot = lm(landmarks, 145)
    re_top = lm(landmarks, 386)
    re_bot = lm(landmarks, 374)

    left = {
        "tilt": _canthal_tilt_deg(le_o, le_i),
        "exposureRatio": dist(le_top, le_bot) / (dist(le_i, le_o) or 0.01),
        "lowerLidK": _lower_lid_bending(landmarks, LEFT_LOWER_LID),
    }
    right = {
        "tilt": _canthal_tilt_deg(re_o, re_i),
        "exposureRatio": dist(re_top, re_bot) / (dist(re_i, re_o) or 0.01),
        "lowerLidK": _lower_lid_bending(landmarks, RIGHT_LOWER_LID),
    }
    avg = {
        "tilt": (left["tilt"] + right["tilt"]) / 2,
        "exposureRatio": (left["exposureRatio"] + right["exposureRatio"]) / 2,
        "lowerLidK": (left["lowerLidK"] + right["lowerLidK"]) / 2,
    }

    return {
        "leftTilt": f"{left['tilt']:.1f}",
        "rightTilt": f"{right['tilt']:.1f}",
        "eyeTilt": _classify_tilt(avg["tilt"]),
        "eyelidExposure": _classify_exposure(avg["exposureRatio"]),
        "exposureRatio": f"{avg['exposureRatio']:.2f}",
        "lowerLidCurvature": f"{avg['lowerLidK']:.2f}",
        "curvatureDescription": _curvature_label(avg["lowerLidK"]),
        "curvatureMin": 0.76,
        "curvatureMax": 0.92,
        "scleraColor": "Natural White",
        "underEyeHealth": "Moderate",
    }


def eyelash_metrics(landmarks: list, image_bytes: bytes) -> dict:
    """Estimate lash-line density and darkness from upper-lid crop contrast."""
    left_box = bbox_from_indices(landmarks, LEFT_LASH_LINE, 0.02)
    right_box = bbox_from_indices(landmarks, RIGHT_LASH_LINE, 0.02)
    left_box["h"] *= 0.55
    right_box["h"] *= 0.55

    left_stats = sample_region_stats(image_bytes, left_box)
    right_stats = sample_region_stats(image_bytes, right_box)
    avg_bright = (left_stats["brightness"] + right_stats["brightness"]) / 2
    avg_redness = (left_stats["redness"] + right_stats["redness"]) / 2

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    edge_scores: list[float] = []
    if img is not None:
        h, w = img.shape[:2]
        for box in (left_box, right_box):
            sx = max(0, round(box["x"] * w))
            sy = max(0, round(box["y"] * h))
            sw = max(1, min(w - sx, round(box["w"] * w)))
            sh = max(1, min(h - sy, round(box["h"] * h)))
            region = img[sy : sy + sh, sx : sx + sw]
            if region.size > 0:
                lap = cv2.Laplacian(region, cv2.CV_64F)
                edge_scores.append(float(np.var(lap)))

    edge_var = sum(edge_scores) / len(edge_scores) if edge_scores else 0.0
    darkness = max(0, min(100, 100 - avg_bright * 0.45 + edge_var * 0.02))
    density = "Dense" if edge_var > 120 else ("Moderate" if edge_var > 60 else "Light")
    darkness_label = "Dark" if darkness > 55 else ("Medium" if darkness > 35 else "Light")

    return {
        "density": density,
        "darkness": darkness_label,
        "contrastIndex": round(edge_var, 1),
        "brightness": round(avg_bright, 1),
        "dataSource": "estimated",
        "explanation": (
            f"Lash-line contrast index {edge_var:.0f} suggests {density.lower()} apparent density "
            f"with {darkness_label.lower()} lash pigmentation on the frontal photo."
        ),
        "explanationDe": (
            f"Wimpernlinien-Kontrastindex {edge_var:.0f} deutet auf {expl_de.label_de(density)}e "
            f"scheinbare Dichte mit {expl_de.label_de(darkness_label)}er Wimpernpigmentierung "
            f"auf dem Frontalfoto hin."
        ),
    }


def under_eye_metrics(landmarks: list, image_bytes: bytes) -> dict:
    """Under-eye hollowing and pigmentation from periorbital crops."""
    left_under = bbox_from_indices(landmarks, LEFT_UNDER, 0.015)
    right_under = bbox_from_indices(landmarks, RIGHT_UNDER, 0.015)
    left_under["h"] *= 1.3
    right_under["h"] *= 1.3
    left_stats = sample_region_stats(image_bytes, left_under)
    right_stats = sample_region_stats(image_bytes, right_under)
    avg_bright = (left_stats["brightness"] + right_stats["brightness"]) / 2
    avg_redness = (left_stats["redness"] + right_stats["redness"]) / 2
    hollowing = "Mild hollow" if avg_bright < 115 else ("Moderate hollow" if avg_bright < 95 else "Minimal hollow")
    pigmentation = "Noticeable" if avg_redness > 8 else ("Mild" if avg_redness > 4 else "Minimal")
    return {
        "hollowing": hollowing,
        "pigmentation": pigmentation,
        "brightness": round(avg_bright, 1),
        "rednessIndex": round(avg_redness, 1),
        "health": _classify_under_eye(avg_bright),
        "dataSource": "measured",
        "explanation": (
            f"Under-eye brightness {avg_bright:.0f} with {pigmentation.lower()} pigmentation signal; "
            f"hollowing reads as {hollowing.lower()} on the frontal photo."
        ),
        "explanationDe": (
            f"Unteraugen-Helligkeit {avg_bright:.0f} mit {expl_de.label_de(pigmentation)}em "
            f"Pigmentsignal; die Hohlheit wirkt {hollowing.lower()} auf dem Frontalfoto."
        ),
    }


def assemble_eyes_region(
    landmarks: list,
    image_bytes: bytes,
    brow_metrics: dict,
    eye_analysis: Optional[dict] = None,
) -> dict:
    """Structured eyes region with four subsection metric slices."""
    metrics = (eye_analysis or {}).get("metrics") or compute_eye_metrics_from_landmarks(landmarks)
    lashes = eyelash_metrics(landmarks, image_bytes)
    under_eye = under_eye_metrics(landmarks, image_bytes)

    brow_score = brow_metrics.get("symmetryScore", 75) if isinstance(brow_metrics, dict) else 75
    ocular_score = 78
    if "Positive" in metrics.get("eyeTilt", ""):
        ocular_score += 4
    if metrics.get("underEyeHealth") == "Good":
        ocular_score += 4
    ocular_score = min(99, max(55, ocular_score))

    overall = round((brow_score + ocular_score + (85 if lashes["density"] == "Dense" else 75)) / 3)

    return {
        "score": overall,
        "scoreLabel": "Balanced" if overall >= 75 else "Soft",
        "eyebrows": {
            "score": brow_score,
            "shape": brow_metrics.get("shape"),
            "position": brow_metrics.get("position"),
            "thickness": brow_metrics.get("thickness"),
            "peakHeight": brow_metrics.get("peakHeight"),
            "symmetryScore": brow_metrics.get("symmetryScore"),
            "explanation": brow_metrics.get("explanation"),
            "explanationDe": brow_metrics.get("explanationDe"),
            "dataSource": "measured",
        },
        "eyelashes": lashes,
        "ocular": {
            "score": ocular_score,
            "eyeTilt": metrics.get("eyeTilt"),
            "eyelidExposure": metrics.get("eyelidExposure"),
            "scleraColor": metrics.get("scleraColor"),
            "lowerLidCurvature": metrics.get("lowerLidCurvature"),
            "curvatureDescription": metrics.get("curvatureDescription"),
            "explanation": metrics.get("explanation"),
            "explanationDe": metrics.get("explanationDe"),
            "dataSource": "measured",
        },
        "underEye": under_eye,
    }


def analyze_eyes(landmarks: list, image_bytes: bytes) -> dict:
    """Full eye analysis — landmarks + pixel data from image.

    Returns:
        {"eyesCrop": bytes, "eyesBox": dict, "metrics": dict}
    """
    eyes_box = bbox_eyes_region(landmarks)
    left_box = bbox_from_indices(landmarks, LEFT_EYE, 0.03)
    right_box = bbox_from_indices(landmarks, RIGHT_EYE, 0.03)

    left_under = bbox_from_indices(landmarks, LEFT_UNDER, 0.015)
    right_under = bbox_from_indices(landmarks, RIGHT_UNDER, 0.015)
    left_under["h"] *= 1.3
    right_under["h"] *= 1.3

    eyes_crop = crop_normalized(image_bytes, eyes_box)
    left_sclera = sample_sclera_stats(image_bytes, left_box, landmarks=landmarks, iris_indices=LEFT_IRIS, eye_indices=LEFT_EYE, inner_canthus_idx=LEFT_INNER_CANTHUS)
    right_sclera = sample_sclera_stats(image_bytes, right_box, landmarks=landmarks, iris_indices=RIGHT_IRIS, eye_indices=RIGHT_EYE, inner_canthus_idx=RIGHT_INNER_CANTHUS)
    left_under_stats = sample_region_stats(image_bytes, left_under)
    right_under_stats = sample_region_stats(image_bytes, right_under)

    skin_redness = (left_under_stats["redness"] + right_under_stats["redness"]) / 2

    metrics = compute_eye_metrics_from_landmarks(landmarks)
    metrics["scleraColor"] = _classify_sclera(
        combine_sclera_stats(left_sclera, right_sclera), skin_redness=skin_redness
    )
    metrics["underEyeHealth"] = _classify_under_eye(
        (left_under_stats["brightness"] + right_under_stats["brightness"]) / 2
    )
    metrics["explanation"] = _build_explanation(metrics)
    metrics["explanationDe"] = _build_explanation_de(metrics)

    return {"eyesCrop": eyes_crop, "eyesBox": eyes_box, "metrics": metrics}


def analyze_brows_crop(landmarks: list, image_bytes: bytes) -> dict:
    """Crop and return brow region."""
    box = bbox_brows_region(landmarks)
    crop = crop_normalized(image_bytes, box)
    return {"crop": crop, "box": box}
