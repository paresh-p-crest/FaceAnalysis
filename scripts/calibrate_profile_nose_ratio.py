#!/usr/bin/env python3
"""One-shot calibration: noseRatio on demo profile fixtures (Python FaceMesh)."""
from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.mediapipe_analysis import analyze_with_mediapipe  # noqa: E402


def dist(a, b):
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def nose_ratio(lms):
    nose, le, re = lms[1], lms[234], lms[454]
    fw = dist(le, re)
    if fw < 0.01:
        return None
    return (nose["x"] - le["x"]) / fw


def classify(nr):
    if nr is None:
        return "unknown"
    if nr > 0.75:
        return "rightProfile"
    if nr < 0.25:
        return "leftProfile"
    if nr > 0.58:
        return "right45"
    if nr < 0.42:
        return "left45"
    return "front"


FIXTURES = {
    "leftProfile": "left-profile.png",
    "rightProfile": "right-profile.png",
    "left45": "left-45.png",
    "right45": "right-45.png",
    "front": "front.png",
    "smile": "smile.png",
    "topHead": "top-head.png",
}


def main():
    base = ROOT / "artifacts/myface/public/demo-photos"
    print("expectedPose     noseRatio  detectedClass   pass")
    print("-" * 52)
    failed = 0
    for expected, fn in FIXTURES.items():
        path = base / fn
        if not path.exists():
            print(f"{expected:14} MISSING {fn}")
            failed += 1
            continue
        try:
            result = analyze_with_mediapipe(path.read_bytes())
            nr = nose_ratio(result["landmarks"])
            detected = classify(nr)
            # Current FE bands (profiles only for full profile)
            if expected in ("leftProfile", "rightProfile"):
                bands = {
                    "rightProfile": (0.75, 1.0),
                    "leftProfile": (0.0, 0.25),
                }
                lo, hi = bands[expected]
                ok = nr is not None and lo <= nr <= hi
            else:
                ok = detected == expected or expected in ("smile", "topHead")
            mark = "OK" if ok else "FAIL"
            if not ok:
                failed += 1
            print(f"{expected:14} {nr:9.4f}  {detected:14}  {mark}")
        except Exception as exc:
            print(f"{expected:14} ERROR: {exc}")
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
