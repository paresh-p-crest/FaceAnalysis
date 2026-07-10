"""Profile silhouette landmark extraction for near-90° side profiles.

MediaPipe FaceMesh degrades past ~60–70° yaw. For true side profiles we extract
anatomical points from the facial outline (Canny + curvature / extrema along the
silhouette) and feed those into cephalometric formulas.

Naso-aural ear height uses a dedicated rear-side helix→lobe span — FaceMesh
"ear" indices only mark the face–ear junction and systematically under-read
true ear length on profile photos.
"""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np


def _largest_face_contour(edges: np.ndarray) -> Optional[np.ndarray]:
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    h, w = edges.shape[:2]
    min_area = (h * w) * 0.02
    candidates = [c for c in contours if cv2.contourArea(c) >= min_area]
    if not candidates:
        candidates = contours
    return max(candidates, key=cv2.contourArea)


def _facing_side(contour: np.ndarray, w: int) -> str:
    """Return 'right' if the face looks right (nose toward +x), else 'left'."""
    pts = contour.reshape(-1, 2)
    xs = pts[:, 0]
    ys = pts[:, 1]
    h = int(ys.max()) if ys.size else 1
    mid = (ys > h * 0.25) & (ys < h * 0.55)
    if not mid.any():
        return "right" if float(xs.mean()) > w / 2 else "left"
    mid_xs = xs[mid]
    if abs(int(mid_xs.max()) - w / 2) > abs(int(mid_xs.min()) - w / 2):
        return "right"
    return "left"


def _silhouette_x_at_y(pts: np.ndarray, y_target: float, facing: str) -> tuple[float, float]:
    """Pick the forward-most silhouette point near a target y."""
    ys = pts[:, 1].astype(float)
    band = np.abs(ys - y_target) <= max(3.0, (ys.max() - ys.min()) * 0.03)
    if not band.any():
        idx = int(np.argmin(np.abs(ys - y_target)))
        return float(pts[idx, 0]), float(pts[idx, 1])
    band_pts = pts[band]
    if facing == "right":
        i = int(np.argmax(band_pts[:, 0]))
    else:
        i = int(np.argmin(band_pts[:, 0]))
    return float(band_pts[i, 0]), float(band_pts[i, 1])


def _pronasale(pts: np.ndarray, facing: str, y0: float, y1: float) -> tuple[float, float]:
    """Nose tip = most forward point in the mid-face vertical band."""
    ys = pts[:, 1].astype(float)
    band = (ys >= y0) & (ys <= y1)
    if not band.any():
        return _silhouette_x_at_y(pts, (y0 + y1) / 2, facing)
    band_pts = pts[band]
    if facing == "right":
        i = int(np.argmax(band_pts[:, 0]))
    else:
        i = int(np.argmin(band_pts[:, 0]))
    return float(band_pts[i, 0]), float(band_pts[i, 1])


def _forward_x(pts: np.ndarray, facing: str) -> np.ndarray:
    return pts[:, 0].astype(float) if facing == "right" else -pts[:, 0].astype(float)


def _local_indent(
    sil: np.ndarray,
    facing: str,
    y0: float,
    y1: float,
) -> Optional[tuple[float, float]]:
    """Deepest indent (least forward) on the forward silhouette between y0 and y1."""
    ys = sil[:, 1].astype(float)
    band = (ys >= y0) & (ys <= y1)
    if band.sum() < 5:
        return None
    band_pts = sil[band]
    # Sample unique y rows → forward-most x, then find local min of forward extent
    order = np.argsort(band_pts[:, 1])
    sorted_pts = band_pts[order]
    # Bin by y
    y_bins = {}
    for x, y in sorted_pts:
        yk = int(round(float(y)))
        fx = float(x) if facing == "right" else -float(x)
        if yk not in y_bins or fx > y_bins[yk][2]:
            y_bins[yk] = (float(x), float(y), fx)
    if len(y_bins) < 5:
        return None
    rows = sorted(y_bins.values(), key=lambda t: t[1])
    forward = np.array([r[2] for r in rows], dtype=float)
    # Smooth and find minimum (indent)
    if len(forward) >= 5:
        kernel = np.ones(5) / 5.0
        forward = np.convolve(forward, kernel, mode="same")
    idx = int(np.argmin(forward))
    return rows[idx][0], rows[idx][1]


def _extract_ear_helix_lobe(
    gray: np.ndarray,
    facing: str,
    face_y0: float,
    face_y1: float,
) -> Optional[tuple[tuple[float, float], tuple[float, float]]]:
    """Measure true ear vertical span (helix top → lobe bottom) on the rear side.

    FaceMesh ear indices only sit at the face–ear junction and under-read length.
    We scan the posterior column for the contiguous high-edge band of the pinna.
    """
    h, w = gray.shape[:2]
    # Ear sits on the back of the head (opposite the nose direction)
    if facing == "right":
        x0, x1 = int(w * 0.08), int(w * 0.48)
    else:
        x0, x1 = int(w * 0.52), int(w * 0.92)

    y0 = max(0, int(face_y0 + (face_y1 - face_y0) * 0.12))
    y1 = min(h, int(face_y0 + (face_y1 - face_y0) * 0.72))
    if y1 - y0 < 20 or x1 - x0 < 10:
        return None

    roi = gray[y0:y1, x0:x1]
    blur = cv2.GaussianBlur(roi, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    # Prefer vertical structure (helix rim)
    sobel_x = cv2.Sobel(blur, cv2.CV_32F, 1, 0, ksize=3)
    energy = edges.astype(np.float32) + np.abs(sobel_x) * 0.15
    row_energy = energy.sum(axis=1)
    if row_energy.size < 10:
        return None

    # Smooth and threshold relative to peak
    k = max(3, len(row_energy) // 25)
    if k % 2 == 0:
        k += 1
    smooth = cv2.GaussianBlur(row_energy.reshape(-1, 1), (1, k), 0).ravel()
    peak = float(smooth.max())
    if peak < 1e-3:
        return None
    thresh = peak * 0.35
    active = smooth >= thresh
    if not active.any():
        return None

    # Longest contiguous active run = ear body
    best_start, best_end, best_len = 0, 0, 0
    i = 0
    n = len(active)
    while i < n:
        if not active[i]:
            i += 1
            continue
        j = i
        while j < n and active[j]:
            j += 1
        if j - i > best_len:
            best_len = j - i
            best_start, best_end = i, j - 1
        i = j

    if best_len < max(8, int(0.08 * (y1 - y0))):
        return None

    # X position: column of max energy within the ear band
    band = energy[best_start : best_end + 1]
    col_energy = band.sum(axis=0)
    ear_x_local = int(np.argmax(col_energy))
    ear_x = float(x0 + ear_x_local)
    ear_top_y = float(y0 + best_start)
    ear_bot_y = float(y0 + best_end)
    return (ear_x, ear_top_y), (ear_x, ear_bot_y)


def extract_profile_silhouette_points(image_bytes: bytes) -> Optional[dict]:
    """Extract profile contour anatomical points.

    Returns normalized x/y dict with glabella, nasion, pronasale, subnasale,
    upperLip, lowerLip, pogonion, menton, bridgeMid, earTop/earBottom
    (helix→lobe when detectable), and facingSide — or None when no clear
    silhouette is found.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 40, 120)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contour = _largest_face_contour(edges)
    if contour is None or len(contour) < 40:
        return None

    pts = contour.reshape(-1, 2)
    facing = _facing_side(contour, w)

    if facing == "right":
        med_x = float(np.median(pts[:, 0]))
        sil = pts[pts[:, 0] >= med_x - w * 0.02]
    else:
        med_x = float(np.median(pts[:, 0]))
        sil = pts[pts[:, 0] <= med_x + w * 0.02]

    if len(sil) < 20:
        sil = pts

    y_min = float(sil[:, 1].min())
    y_max = float(sil[:, 1].max())
    span = max(y_max - y_min, 1.0)

    def frac(f: float) -> float:
        return y_min + span * f

    def pt_norm(x: float, y: float) -> dict:
        return {"x": round(x / w, 6), "y": round(y / h, 6)}

    # Pronasale first (most reliable forward extremum), then refine nasion/subnasale
    pronasale = _pronasale(sil, facing, frac(0.28), frac(0.50))
    nasion_indent = _local_indent(sil, facing, frac(0.12), pronasale[1] - span * 0.05)
    nasion = nasion_indent if nasion_indent else _silhouette_x_at_y(sil, frac(0.22), facing)
    # Guard: nasion must sit above pronasale
    if nasion[1] >= pronasale[1]:
        nasion = _silhouette_x_at_y(sil, max(frac(0.18), pronasale[1] - span * 0.18), facing)

    sub_indent = _local_indent(sil, facing, pronasale[1] + span * 0.02, frac(0.62))
    subnasale = sub_indent if sub_indent else _silhouette_x_at_y(sil, frac(0.52), facing)
    if subnasale[1] <= pronasale[1]:
        subnasale = _silhouette_x_at_y(sil, min(frac(0.55), pronasale[1] + span * 0.08), facing)

    glabella = _silhouette_x_at_y(sil, max(y_min + span * 0.05, nasion[1] - span * 0.10), facing)
    upper_lip = _silhouette_x_at_y(sil, frac(0.58), facing)
    lower_lip = _silhouette_x_at_y(sil, frac(0.64), facing)
    pogonion = _silhouette_x_at_y(sil, frac(0.78), facing)
    menton = _silhouette_x_at_y(sil, frac(0.92), facing)

    bridge_y = (nasion[1] + pronasale[1]) / 2
    bridge_mid = _silhouette_x_at_y(sil, bridge_y, facing)

    lower = sil[(sil[:, 1] >= frac(0.55)) & (sil[:, 1] <= frac(0.85))]
    if len(lower) > 5:
        if facing == "right":
            gi = int(np.argmin(lower[:, 0]))
        else:
            gi = int(np.argmax(lower[:, 0]))
        gonion = (float(lower[gi, 0]), float(lower[gi, 1]))
    else:
        gonion = (pogonion[0], frac(0.70))

    # True ear helix→lobe from rear-side edge energy (preferred for naso-aural)
    ear_span = _extract_ear_helix_lobe(gray, facing, y_min, y_max)
    if ear_span:
        ear_top, ear_bottom = ear_span
        ear_source = "helix_lobe"
    else:
        # Fallback: rear silhouette band between brow and jaw — still better than FaceMesh junction
        ear_band = sil[(sil[:, 1] >= nasion[1] - span * 0.05) & (sil[:, 1] <= subnasale[1] + span * 0.08)]
        if len(ear_band) > 8:
            if facing == "right":
                # rear = smaller x
                rear_x = float(np.percentile(ear_band[:, 0], 15))
                rear = ear_band[ear_band[:, 0] <= rear_x + w * 0.03]
            else:
                rear_x = float(np.percentile(ear_band[:, 0], 85))
                rear = ear_band[ear_band[:, 0] >= rear_x - w * 0.03]
            if len(rear) > 4:
                ear_top = (float(np.median(rear[:, 0])), float(rear[:, 1].min()))
                ear_bottom = (float(np.median(rear[:, 0])), float(rear[:, 1].max()))
            else:
                ear_top = (gonion[0], nasion[1])
                ear_bottom = (gonion[0], subnasale[1])
        else:
            ear_top = (gonion[0], nasion[1])
            ear_bottom = (gonion[0], subnasale[1] + span * 0.06)
        ear_source = "silhouette_rear"

    return {
        "glabella": pt_norm(*glabella),
        "nasion": pt_norm(*nasion),
        "pronasale": pt_norm(*pronasale),
        "subnasale": pt_norm(*subnasale),
        "upperLip": pt_norm(*upper_lip),
        "lowerLip": pt_norm(*lower_lip),
        "pogonion": pt_norm(*pogonion),
        "menton": pt_norm(*menton),
        "bridgeMid": pt_norm(*bridge_mid),
        "gonion": pt_norm(*gonion),
        "earTop": pt_norm(*ear_top),
        "earBottom": pt_norm(*ear_bottom),
        "noseTop": pt_norm(*nasion),
        "noseBottom": pt_norm(*subnasale),
        "facingSide": facing,
        "earSpanSource": ear_source,
        "dataSource": "silhouette_estimate",
    }
