#!/usr/bin/env python3
"""Patch naso-aural nose level guides on an existing assessment (no full CV re-run).

Runs the face-det-crop sidecar on the stored profile photo and updates
``proportions.ratios.nasoAural`` guide fields plus recomputes ``yourValue``
from the dashed glabella/subnasale span when guides resolve.

Usage:

  PYTHONPATH=. python scripts/enrich_naso_aural_guides.py <assessment_uuid>

  # Dry-run (print patch, do not write DB):
  PYTHONPATH=. python scripts/enrich_naso_aural_guides.py <id> --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")


def _fingerprint_cv(cv: dict | None) -> str:
    """Stable fingerprint to verify profile metrics were not mutated."""
    cv = cv or {}
    profile = cv.get("profile") or {}
    primary = profile.get("primary") or {}
    meas = primary.get("measurements") or {}
    nose = cv.get("nose") or {}
    return json.dumps(
        {
            "nasolabial": meas.get("nasolabialAngleDeg"),
            "nasofrontal": meas.get("nasofrontalAngleDeg"),
            "nose_nasoAural": nose.get("nasoAuralRatio"),
            "profile_keys": sorted(profile.keys()),
        },
        sort_keys=True,
    )


def _load_profile_bytes(assessment_id: str, pose_id: str) -> bytes | None:
    from backend.visual_generation import load_pose_bytes

    return load_pose_bytes(assessment_id, pose_id)


async def enrich_assessment(assessment_id: str, *, dry_run: bool = False) -> dict:
    from backend.naso_aural_guide_overlay import nose_height_norm_from_guides, patch_naso_aural_guides
    from backend.profile_cephalometrics import _naso_aural_explanation, _naso_aural_label
    from backend.repositories.assessment_repository import (
        get_assessment_by_id,
        update_assessment_analysis,
    )

    assessment = await get_assessment_by_id(assessment_id)
    if not assessment:
        raise ValueError(f"Assessment not found: {assessment_id}")

    analysis = copy.deepcopy(assessment.get("analysis") or {})
    cv = analysis.get("cvReport") or {}
    ratios = (cv.get("proportions") or {}).get("ratios") or {}
    naso = ratios.get("nasoAural")
    if not isinstance(naso, dict):
        raise ValueError("No proportions.ratios.nasoAural on this assessment")

    pose = naso.get("photoSource") or "rightProfile"
    if pose not in ("leftProfile", "rightProfile"):
        for fallback in ("rightProfile", "leftProfile"):
            if _load_profile_bytes(assessment_id, fallback):
                pose = fallback
                break

    profile_bytes = _load_profile_bytes(assessment_id, pose)
    if not profile_bytes:
        raise ValueError(f"No profile photo bytes for pose {pose!r}")

    facing_right = pose != "leftProfile"
    ears = cv.get("ears") or {}
    side_key = "left" if pose == "leftProfile" else "right"
    side = (ears.get("sides") or {}).get(side_key) or {}
    ear_meas = (side.get("measurements") or {}) if side.get("status") == "ready" else {}

    before_fp = _fingerprint_cv(cv)
    before_your = naso.get("yourValue")

    patched = patch_naso_aural_guides(
        naso,
        profile_bytes,
        facing_right=facing_right,
        ear_measurements=ear_meas or None,
    )
    if not patched.get("guideGlabella"):
        raise ValueError("Sidecar did not produce guide points (face-det or plausibility failed)")

    guide_nose_h = nose_height_norm_from_guides(patched)
    ear_h = patched.get("earHeightNorm") or ear_meas.get("verticalHeightNorm")
    if guide_nose_h is not None and ear_h is not None and float(ear_h) > 1e-6:
        ratio = round(float(ear_h) / guide_nose_h, 2)
        patched = {
            **patched,
            "yourValue": ratio,
            "yourLabel": _naso_aural_label(ratio),
            "explanation": _naso_aural_explanation(ratio),
            "noseHeightNorm": round(guide_nose_h, 6),
            "noseHeightSource": "guide_glabella_subnasale",
        }
        if cv.get("nose"):
            cv["nose"] = {**cv["nose"], "nasoAuralRatio": ratio}
        if cv.get("ears"):
            cv["ears"] = {**cv["ears"], "protrusion": _naso_aural_label(ratio)}

    cv["proportions"] = {
        **(cv.get("proportions") or {}),
        "ratios": {**ratios, "nasoAural": patched},
    }
    analysis["cvReport"] = cv

    after_fp = _fingerprint_cv(cv)
    if before_fp != after_fp:
        raise RuntimeError("Profile metrics fingerprint changed — aborting")

    result = {
        "assessmentId": assessment_id,
        "pose": pose,
        "guideGlabella": patched.get("guideGlabella"),
        "guideNoseBottom": patched.get("guideNoseBottom"),
        "guideCount": len((patched.get("overlay") or {}).get("guides") or []),
        "yourValue": patched.get("yourValue"),
        "yourValueBefore": before_your,
        "dryRun": dry_run,
    }

    if not dry_run:
        await update_assessment_analysis(assessment_id, analysis)

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assessment_id", help="Assessment UUID")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute patch only; do not write to DB",
    )
    args = parser.parse_args()

    result = asyncio.run(enrich_assessment(args.assessment_id, dry_run=args.dry_run))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
