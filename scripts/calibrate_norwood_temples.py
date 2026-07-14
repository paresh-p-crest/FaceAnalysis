#!/usr/bin/env python3
"""Calibration harness: temple-recession metrics vs labeled Norwood-stage folders.

Thresholds in ``_norwood_stage_geometric`` (0.03 / 0.07 / 0.13) are placeholders.
Run this against labeled top-of-head photos and set boundaries at gaps between
stage distributions — not at arbitrary round numbers.

Usage:

  PYTHONPATH=. backend/.venv/Scripts/python.exe scripts/calibrate_norwood_temples.py path/to/labeled

  labeled/
    stage_1/*.jpg
    stage_2/*.jpg
    stage_3/*.jpg
    ...

Also supports ``stage-1`` folder names.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.hair_segmentation import analyze_hair_segmentation  # noqa: E402


IMAGE_GLOBS = ("*.jpg", "*.jpeg", "*.png", "*.webp")


def _photos_in(folder: Path) -> list[Path]:
    out: list[Path] = []
    for g in IMAGE_GLOBS:
        out.extend(folder.glob(g))
        out.extend(folder.glob(g.upper()))
    return sorted({p.resolve() for p in out})


def calibrate(labeled_dir: Path) -> dict:
    results: dict = {}
    for stage_folder in sorted(p for p in labeled_dir.iterdir() if p.is_dir()):
        stage_label = stage_folder.name
        recessions: list[float] = []
        mid_fracs: list[float] = []
        for photo in _photos_in(stage_folder):
            seg = analyze_hair_segmentation(photo.read_bytes())
            tm = (seg or {}).get("templeMetrics") if seg else None
            if not tm:
                continue
            recessions.append(float(tm["templeRecession"]))
            mid_fracs.append(float(tm["midFrontalFrac"]))
        results[stage_label] = {
            "n": len(recessions),
            "templeRecession": {
                "min": min(recessions) if recessions else None,
                "max": max(recessions) if recessions else None,
                "mean": (sum(recessions) / len(recessions)) if recessions else None,
                "values": recessions,
            },
            "midFrontalFrac": {
                "min": min(mid_fracs) if mid_fracs else None,
                "max": max(mid_fracs) if mid_fracs else None,
                "mean": (sum(mid_fracs) / len(mid_fracs)) if mid_fracs else None,
            },
        }
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "labeled_dir",
        type=Path,
        help="Directory with stage_1/, stage_2/, … subfolders of top-of-head photos",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=Path,
        default=None,
        help="Optional JSON output path (default: stdout)",
    )
    args = parser.parse_args()
    if not args.labeled_dir.is_dir():
        print(f"ERROR: not a directory: {args.labeled_dir}", file=sys.stderr)
        return 1

    payload = calibrate(args.labeled_dir)
    text = json.dumps(payload, indent=2)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"Wrote {args.out}")
    else:
        print(text)

    print(
        "\nInspect gaps between stage_1 max and stage_2 min (etc.) and set "
        "_norwood_stage_geometric thresholds at those gaps.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
