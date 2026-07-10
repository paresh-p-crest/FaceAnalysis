"""Profile silhouette landmark fallback for near-90° side profiles when FaceMesh degrades."""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np


def extract_profile_silhouette_points(image_bytes: bytes) -> Optional[dict]:
    """Extract coarse profile contour peaks via Canny edge detection.

    Returns normalized x/y points for glabella, nasion, pronasale, subnasale, pogonion
    when a clear vertical silhouette is found; otherwise None.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None

    h, w = img.shape[:2]
    edges = cv2.Canny(cv2.GaussianBlur(img, (5, 5), 0), 40, 120)
    col_profile = edges.max(axis=0)
    xs = np.where(col_profile > 0)[0]
    if xs.size < 10:
        return None

    profile_x = int(np.median(xs))
    ys = np.where(edges[:, profile_x] > 0)[0]
    if ys.size < 20:
        return None

    ys_sorted = sorted(ys.tolist())
    n = len(ys_sorted)

    def pt(y_idx: int) -> dict:
        y = ys_sorted[min(max(y_idx, 0), n - 1)]
        return {"x": profile_x / w, "y": y / h}

    return {
        "glabella": pt(int(n * 0.08)),
        "nasion": pt(int(n * 0.22)),
        "pronasale": pt(int(n * 0.42)),
        "subnasale": pt(int(n * 0.52)),
        "pogonion": pt(int(n * 0.72)),
        "dataSource": "silhouette_estimate",
    }
