#!/usr/bin/env python3
"""Sanity-check prototypicality score spread across synthetic face variants."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.prototypicality import compute_prototypicality_report, get_prototypicality_norms


def _base_landmarks() -> list:
    """Minimal plausible 478-pt face in normalized coords."""
    lm_list = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    lm_list[10] = {"x": 0.5, "y": 0.18, "z": 0}   # forehead
    lm_list[152] = {"x": 0.5, "y": 0.88, "z": 0}  # chin
    lm_list[2] = {"x": 0.5, "y": 0.58, "z": 0}    # subnasale
    lm_list[1] = {"x": 0.5, "y": 0.55, "z": 0}    # nose tip
    lm_list[33] = {"x": 0.38, "y": 0.42, "z": 0}
    lm_list[263] = {"x": 0.62, "y": 0.42, "z": 0}
    lm_list[172] = {"x": 0.32, "y": 0.80, "z": 0}
    lm_list[397] = {"x": 0.68, "y": 0.80, "z": 0}
    lm_list[127] = {"x": 0.28, "y": 0.50, "z": 0}
    lm_list[356] = {"x": 0.72, "y": 0.50, "z": 0}
    lm_list[48] = {"x": 0.44, "y": 0.56, "z": 0}
    lm_list[278] = {"x": 0.56, "y": 0.56, "z": 0}
    return lm_list


def _variant(name: str, mutate) -> tuple[str, list]:
    pts = _base_landmarks()
    mutate(pts)
    return name, pts


def main() -> None:
    answers = {"ethnicity": "white", "genderPreference": "no-preference"}
    norms = get_prototypicality_norms(answers)

    variants = [
        _variant("ideal-ish", lambda p: None),
        _variant("wide jaw", lambda p: p.__setitem__(397, {"x": 0.74, "y": 0.80, "z": 0}) or p.__setitem__(172, {"x": 0.26, "y": 0.80, "z": 0})),
        _variant("narrow jaw", lambda p: p.__setitem__(397, {"x": 0.64, "y": 0.80, "z": 0}) or p.__setitem__(172, {"x": 0.36, "y": 0.80, "z": 0})),
        _variant("high brows", lambda p: p.__setitem__(33, {"x": 0.38, "y": 0.35, "z": 0}) or p.__setitem__(263, {"x": 0.62, "y": 0.35, "z": 0})),
        _variant("low brows", lambda p: p.__setitem__(33, {"x": 0.38, "y": 0.48, "z": 0}) or p.__setitem__(263, {"x": 0.62, "y": 0.48, "z": 0})),
        _variant("broad nose", lambda p: p.__setitem__(48, {"x": 0.40, "y": 0.56, "z": 0}) or p.__setitem__(278, {"x": 0.60, "y": 0.56, "z": 0})),
        _variant("asymmetric", lambda p: p.__setitem__(263, {"x": 0.68, "y": 0.44, "z": 0})),
    ]

    print(f"Norms: {norms['cohortKey']} fw/h={norms['faceWidthHeight']:.2f}")
    print(f"{'variant':<14} {'score':>5}  top deviations")
    scores = []
    for name, landmarks in variants:
        r = compute_prototypicality_report(landmarks, {"symmetry": "82"}, answers)
        scores.append(r["score"])
        devs = ", ".join(f"{d['feature']}:{d['magnitude']:.2f}" for d in r["deviations"][:2])
        print(f"{name:<14} {r['score']:>5}  {devs}")

    print(f"\nSpread: min={min(scores)} max={max(scores)} range={max(scores)-min(scores)}")
    if max(scores) - min(scores) < 15:
        print("WARN: narrow spread — consider retuning SCORE_PENALTY_SCALE")
        sys.exit(1)
    print("OK: score variance looks reasonable")


if __name__ == "__main__":
    main()
