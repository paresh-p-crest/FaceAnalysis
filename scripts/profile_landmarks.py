#!/usr/bin/env python3
"""
Left/right profile landmark extractor + annotator.

True ~90° profiles often have no MediaPipe FaceMesh hit (known limit past
~60–70° yaw). Pipeline:

  1. Load image
  2. Background removal (MediaPipe Selfie Segmentation)
  3. Try FaceMesh (0.5 → 0.2 confidence, original + cutout)
  4. If mesh fails: MediaPipe Face Detection + profile silhouette landmarks
     (same anatomical set used for profile cephalometrics)
  5. Write annotated PNG + JSON

Usage:
  python scripts/profile_landmarks.py path/to/profile.jpg --side right
  python scripts/profile_landmarks.py path/to/profile.jpg --side left -o out_dir
  python scripts/profile_landmarks.py path/to/profile.jpg --side right --draw-all
  python scripts/profile_landmarks.py path/to/profile.jpg --side right --no-bg-remove
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.profile_face_crop import (
    expanded_face_crop as _expanded_face_crop,
    remove_background,
    resolve_face_det_and_canvas,
    silhouette_points_full_norm,
)

# FaceMesh labeled indices (used only when mesh succeeds)
MIDLINE_POINTS: dict[str, int] = {
    "forehead": 10,
    "glabella": 9,
    "nasion": 168,
    "nose_bridge": 6,
    "rhinion": 197,
    "nose_tip": 1,
    "subnasale": 2,
    "labiale_superius": 0,
    "stomion": 13,
    "labiale_inferius": 17,
    "pogonion": 18,
    "menton": 152,
}
LEFT_SIDE_POINTS: dict[str, int] = {
    "tragion": 234,
    "ear_helix": 127,
    "gonion": 172,
    "cheek": 50,
    "lateral_canthus": 33,
    "alar_crease": 98,
}
RIGHT_SIDE_POINTS: dict[str, int] = {
    "tragion": 454,
    "ear_helix": 356,
    "gonion": 397,
    "cheek": 280,
    "lateral_canthus": 263,
    "alar_crease": 327,
}

FACE_DET_KEYS = (
    "right_eye",
    "left_eye",
    "nose_tip",
    "mouth_center",
    "right_ear_tragion",
    "left_ear_tragion",
)

COLOR_PROFILE_LINE = (180, 50, 220)
COLOR_GUIDE = (160, 160, 160)

# Hidden from visualization (still computed in silhouette JSON when applicable)
HIDDEN_EAR_NAMES = frozenset({
    "earTop", "earBottom", "ear_helix", "tragion",
    "right_ear_tragion", "left_ear_tragion",
})


@dataclass(frozen=True)
class NamedPoint:
    name: str
    x_px: float
    y_px: float
    x_norm: float
    y_norm: float
    index: Optional[int] = None
    z_norm: Optional[float] = None
    source: str = "facemesh"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Extract & annotate profile face landmarks (FaceMesh + silhouette fallback).",
    )
    p.add_argument("image", type=Path, help="Path to left or right profile image")
    p.add_argument(
        "--side",
        choices=("left", "right"),
        required=True,
        help="Subject's side facing the camera (left/right profile)",
    )
    p.add_argument("-o", "--out-dir", type=Path, default=None)
    p.add_argument("--no-bg-remove", action="store_true")
    p.add_argument(
        "--bg-color",
        type=int,
        nargs=3,
        metavar=("B", "G", "R"),
        default=(255, 255, 255),
    )
    p.add_argument(
        "--draw-all",
        action="store_true",
        help="When FaceMesh succeeds, draw all 478 mesh points",
    )
    return p.parse_args()


def load_bgr(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"Could not read image: {path}")
    return img


def save_image(path: Path, bgr: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(path.suffix or ".png", bgr)
    if not ok:
        raise SystemExit(f"Could not encode image: {path}")
    buf.tofile(str(path))


def try_facemesh(bgr: np.ndarray, conf: float) -> Optional[list[Any]]:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    with mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=conf,
    ) as mesh:
        result = mesh.process(rgb)
    if not result.multi_face_landmarks:
        return None
    return list(result.multi_face_landmarks[0].landmark)


def detect_facemesh(images: list[tuple[str, np.ndarray]]) -> tuple[Optional[list[Any]], str]:
    """Retry like backend/mediapipe_analysis.py: 0.5 then 0.2, across image variants."""
    for conf in (0.5, 0.2):
        for name, img in images:
            lms = try_facemesh(img, conf)
            if lms:
                return lms, f"facemesh@{conf} on {name}"
    return None, "facemesh_failed"


def mesh_labeled(landmarks: list[Any], side: str, w: int, h: int) -> list[NamedPoint]:
    labels = {**MIDLINE_POINTS, **(LEFT_SIDE_POINTS if side == "left" else RIGHT_SIDE_POINTS)}
    out: list[NamedPoint] = []
    for name, idx in labels.items():
        if idx >= len(landmarks):
            continue
        lm = landmarks[idx]
        out.append(
            NamedPoint(
                name=name,
                index=idx,
                x_px=lm.x * w,
                y_px=lm.y * h,
                x_norm=lm.x,
                y_norm=lm.y,
                z_norm=lm.z,
                source="facemesh",
            )
        )
    return out


def silhouette_labeled(
    canvas: np.ndarray,
    face_det: dict[str, Any],
    full_w: int,
    full_h: int,
) -> tuple[list[NamedPoint], dict[str, Any]]:
    """Silhouette cephalometric points, cropped to the detected face region."""
    from backend.profile_silhouette import extract_profile_silhouette_points

    crop, _ = _expanded_face_crop(canvas, face_det)
    ok, enc = cv2.imencode(".jpg", crop)
    if not ok:
        raise SystemExit("Could not encode face crop for silhouette extraction")
    sil = extract_profile_silhouette_points(enc.tobytes())
    if not sil:
        raise SystemExit("Silhouette extraction failed — no usable face outline in crop")

    mapped = silhouette_points_full_norm(canvas, face_det)
    points: list[NamedPoint] = []
    for name, pt in mapped.items():
        points.append(
            NamedPoint(
                name=name,
                x_px=pt["x"] * full_w,
                y_px=pt["y"] * full_h,
                x_norm=pt["x"],
                y_norm=pt["y"],
                source="silhouette",
            )
        )
    return points, sil


def _point_by_name(points: list[NamedPoint], *names: str) -> Optional[NamedPoint]:
    by_name = {p.name: p for p in points}
    for name in names:
        if name in by_name:
            return by_name[name]
    return None


def _vertical_caliper_outside(
    top: NamedPoint,
    bottom: NamedPoint,
    labeled: list[NamedPoint],
    side: str,
    img_w: int,
    face_det: Optional[dict[str, Any]],
    *,
    margin_frac: float = 0.05,
) -> tuple[list[tuple[int, int]], list[tuple[tuple[int, int], tuple[int, int]]], float, int]:
    """Vertical caliper outside the face: same y-levels as top/bottom, offset outward."""
    y_top = int(round(top.y_px))
    y_bot = int(round(bottom.y_px))
    if y_top > y_bot:
        y_top, y_bot = y_bot, y_top
    vert_dist = float(y_bot - y_top)

    xs = [p.x_px for p in _visible_points(labeled)]
    if face_det:
        bb = face_det["bbox_norm"]
        xs.extend([bb["xmin"] * img_w, (bb["xmin"] + bb["width"]) * img_w])

    margin = int(img_w * margin_frac)
    if side == "right":
        anchor = max(xs) if xs else img_w * 0.75
        line_x = int(min(img_w - 12, anchor + margin))
    else:
        anchor = min(xs) if xs else img_w * 0.25
        line_x = int(max(12, anchor - margin))

    vertical = [(line_x, y_top), (line_x, y_bot)]
    guides = [
        ((line_x, y_top), (int(round(top.x_px)), y_top)),
        ((line_x, y_bot), (int(round(bottom.x_px)), y_bot)),
    ]
    return vertical, guides, vert_dist, line_x


def _dashed_line(
    img: np.ndarray,
    p1: tuple[int, int],
    p2: tuple[int, int],
    color: tuple[int, int, int],
    *,
    thickness: int = 1,
    dash: int = 10,
    gap: int = 6,
) -> None:
    x1, y1 = p1
    x2, y2 = p2
    dist = float(np.hypot(x2 - x1, y2 - y1))
    if dist < 1:
        return
    dx, dy = (x2 - x1) / dist, (y2 - y1) / dist
    pos = 0.0
    while pos < dist:
        end = min(pos + dash, dist)
        cv2.line(
            img,
            (int(x1 + dx * pos), int(y1 + dy * pos)),
            (int(x1 + dx * end), int(y1 + dy * end)),
            color,
            thickness,
            lineType=cv2.LINE_AA,
        )
        pos += dash + gap


def _visible_points(points: list[NamedPoint]) -> list[NamedPoint]:
    return [p for p in points if p.name not in HIDDEN_EAR_NAMES]


def draw_distance_overlay(
    bgr: np.ndarray,
    profile_line: Optional[list[tuple[int, int]]],
    guide_lines: Optional[list[tuple[tuple[int, int], tuple[int, int]]]] = None,
) -> np.ndarray:
    """Only the vertical caliper + horizontal dashed extensions at its endpoints."""
    out = bgr.copy()
    if guide_lines:
        for g0, g1 in guide_lines:
            _dashed_line(out, g0, g1, COLOR_GUIDE)
    if profile_line and len(profile_line) == 2:
        cv2.line(
            out,
            profile_line[0],
            profile_line[1],
            COLOR_PROFILE_LINE,
            2,
            lineType=cv2.LINE_AA,
        )
    return out


def main() -> int:
    args = parse_args()
    if not args.image.is_file():
        raise SystemExit(f"File not found: {args.image}")

    out_dir = args.out_dir or args.image.with_name(f"{args.image.stem}_landmarks")
    out_dir.mkdir(parents=True, exist_ok=True)

    original = load_bgr(args.image)
    h, w = original.shape[:2]

    mask = None
    cutout = original
    if not args.no_bg_remove:
        cutout, mask = remove_background(original, tuple(args.bg_color))
        save_image(out_dir / "bg_removed.png", cutout)
        save_image(out_dir / "person_mask.png", mask)

    face_det, canvas, _ = resolve_face_det_and_canvas(
        original,
        bg_remove=not args.no_bg_remove,
        cutout=cutout,
        bg_bgr=tuple(args.bg_color),
    )
    mesh, mesh_note = detect_facemesh([("original", original), ("bg_removed", cutout)])
    all_landmarks: list[dict[str, Any]] = []
    sil_meta: Optional[dict[str, Any]] = None
    profile_line: Optional[list[tuple[int, int]]] = None
    guide_lines: Optional[list[tuple[tuple[int, int], tuple[int, int]]]] = None
    distance_px: Optional[float] = None

    if mesh:
        labeled = mesh_labeled(mesh, args.side, w, h)
        for i, lm in enumerate(mesh):
            all_landmarks.append(
                {
                    "index": i,
                    "x_px": lm.x * w,
                    "y_px": lm.y * h,
                    "x_norm": lm.x,
                    "y_norm": lm.y,
                    "z_norm": lm.z,
                }
            )
        glabella = _point_by_name(labeled, "glabella", "forehead")
        nose_bottom = _point_by_name(labeled, "subnasale", "noseBottom")
        if glabella and nose_bottom:
            profile_line, guide_lines, distance_px, _ = _vertical_caliper_outside(
                glabella, nose_bottom, labeled, args.side, w, face_det
            )
        annotated = draw_distance_overlay(canvas, profile_line, guide_lines)
        source = "facemesh"
    else:
        if not face_det:
            raise SystemExit(
                "No face found by FaceMesh or Face Detection. "
                "Check that the file is a face photo."
            )
        labeled, sil_meta = silhouette_labeled(canvas, face_det, w, h)
        glabella = _point_by_name(labeled, "glabella")
        nose_bottom = _point_by_name(labeled, "noseBottom", "subnasale")
        if glabella and nose_bottom:
            profile_line, guide_lines, distance_px, _ = _vertical_caliper_outside(
                glabella, nose_bottom, labeled, args.side, w, face_det
            )
        annotated = draw_distance_overlay(canvas, profile_line, guide_lines)
        source = "silhouette"
        print(
            "NOTE: MediaPipe FaceMesh cannot lock this true profile "
            "(expected past ~60-70 deg yaw). Using silhouette landmarks + Face Detection."
        )

    save_image(out_dir / "landmarks_annotated.png", annotated)

    payload = {
        "sourceImage": str(args.image.resolve()),
        "side": args.side,
        "image_width": w,
        "image_height": h,
        "bg_removed": not args.no_bg_remove,
        "landmarkSource": source,
        "facemeshNote": mesh_note,
        "faceDetection": (
            {
                "score": face_det["score"],
                "bbox_norm": face_det["bbox_norm"],
            }
            if face_det
            else None
        ),
        "labeled": [asdict(p) for p in labeled],
        "labeledVisible": [asdict(p) for p in _visible_points(labeled)],
        "verticalCaliper": [{"x": x, "y": y} for x, y in (profile_line or [])],
        "verticalGuides": [
            {"from": {"x": a[0], "y": a[1]}, "to": {"x": b[0], "y": b[1]}}
            for a, b in (guide_lines or [])
        ],
        "glabellaToNoseBottomVerticalPx": distance_px,
        "glabellaToNoseBottomVerticalNorm": (
            round(distance_px / h, 6) if distance_px is not None and h else None
        ),
        "all_landmarks": all_landmarks,
        "silhouetteMeta": (
            {k: sil_meta[k] for k in ("facingSide", "earSpanSource", "dataSource") if sil_meta and k in sil_meta}
            if sil_meta
            else None
        ),
    }
    json_path = out_dir / "landmarks.json"
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    # ponytail: fail loudly if we claimed points but drew none
    assert len(labeled) >= 5, f"too few labeled points: {len(labeled)}"

    print(f"landmarkSource={source}  labeled={len(labeled)}")
    print(f"wrote {out_dir / 'landmarks_annotated.png'}")
    print(f"wrote {json_path}")
    if mask is not None:
        print(f"wrote {out_dir / 'bg_removed.png'}")
    print("Labeled points:")
    for p in labeled:
        extra = f" idx={p.index}" if p.index is not None else ""
        print(f"  {p.name:20s}{extra:8s}  ({p.x_px:.1f}, {p.y_px:.1f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
