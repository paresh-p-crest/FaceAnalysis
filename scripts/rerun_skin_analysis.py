#!/usr/bin/env python3
"""Recompute LAB skin metrics for one assessment — patches only analysis.cvReport.skin.

Loads stored ``front.jpg`` and ``analysis.landmarks``, runs ``skin_quality_metrics``,
and updates the same assessment row in-place. Every other ``analysis`` field is
verified unchanged before and after the write.

Usage:

  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_skin_analysis.py <assessment_uuid>

  # Compute + print diff only (no DB write):
  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_skin_analysis.py <id> --dry-run

  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_skin_analysis.py <id> -o report.json
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")

_SKIN_SUMMARY_KEYS = (
    "undertone",
    "blemishing",
    "evenness",
    "texture",
    "roughnessRin",
    "homogeneityRin",
    "oilinessSkew",
    "score",
)


def _load_pose(assessment_id: str, pose_id: str) -> tuple[bytes | None, str | None]:
    """Return (bytes, object_key) for a stored pose from the active media backend."""
    from backend.media_storage import assessment_key, get_media_storage

    media = get_media_storage()
    for ext in ("jpg", "jpeg", "png", "webp"):
        key = assessment_key(assessment_id, f"{pose_id}.{ext}")
        data = media.get_bytes(key)
        if data:
            return data, key
    return None, None


def _merge_skin_block(existing_skin: dict | None, fresh_skin: dict) -> dict:
    """Replace measurable skin fields; keep prior imageSrc / photoSource bindings."""
    from backend.serialization import to_json_safe

    merged = dict(existing_skin or {})
    safe = to_json_safe(fresh_skin) or {}
    if not isinstance(safe, dict):
        raise TypeError("fresh skin result must be a dict")
    merged.update(safe)
    for key in ("imageSrc", "photoSource"):
        if (existing_skin or {}).get(key) and not merged.get(key):
            merged[key] = existing_skin[key]
    return merged


def _skin_summary(skin: dict | None) -> dict[str, Any]:
    skin = skin or {}
    return {key: skin.get(key) for key in _SKIN_SUMMARY_KEYS}


def _analysis_fingerprint_excluding_skin(analysis: dict | None) -> str:
    """Stable fingerprint of analysis with cvReport.skin omitted."""
    blob = copy.deepcopy(analysis or {})
    cv = blob.get("cvReport")
    if isinstance(cv, dict):
        cv.pop("skin", None)
        feature_scores = {}
        for key, value in cv.items():
            if isinstance(value, dict) and value.get("score") is not None:
                feature_scores[key] = value.get("score")
        blob["cvReportFeatureScores"] = feature_scores
    payload = {
        "landmarkCount": len(blob.get("landmarks") or []),
        "metrics": blob.get("metrics"),
        "cvReportSansSkin": cv,
        "cvReportFeatureScores": blob.get("cvReportFeatureScores"),
        "eyeAnalysisOverall": (blob.get("eyeAnalysis") or {}).get("overallScore"),
    }
    text = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _assert_only_skin_changed(before: dict, after: dict) -> None:
    before_fp = _analysis_fingerprint_excluding_skin(before)
    after_fp = _analysis_fingerprint_excluding_skin(after)
    if before_fp != after_fp:
        raise RuntimeError(
            "Analysis fingerprint changed outside cvReport.skin — aborting "
            f"(before={before_fp[:12]} after={after_fp[:12]})"
        )


async def run(assessment_id: str, *, dry_run: bool = False) -> dict:
    from backend.cv_report import skin_quality_metrics
    from backend.database import close_db, connect_db, is_db_configured
    from backend.repositories.assessment_repository import (
        get_assessment_by_id,
        update_assessment_analysis,
    )

    if not is_db_configured():
        raise RuntimeError("DATABASE_URL not set")

    await connect_db()
    try:
        doc = await get_assessment_by_id(assessment_id)
        if not doc:
            raise ValueError(f"Assessment not found: {assessment_id}")

        analysis = doc.get("analysis") or {}
        landmarks = analysis.get("landmarks") or []
        if len(landmarks) < 468:
            raise ValueError(
                f"analysis.landmarks missing or too short ({len(landmarks)} points); "
                "run full CV analysis first"
            )

        front_bytes, front_key = _load_pose(assessment_id, "front")
        if not front_bytes:
            raise FileNotFoundError(
                f"front image missing for {assessment_id} "
                "(expected assessments/{id}/front.jpg in media storage)"
            )

        metrics = analysis.get("metrics")
        cv = analysis.get("cvReport")
        if not isinstance(cv, dict):
            raise ValueError("analysis.cvReport missing — run full CV analysis first")

        stored_skin = cv.get("skin") if isinstance(cv.get("skin"), dict) else {}
        before_fp = _analysis_fingerprint_excluding_skin(analysis)

        fresh_skin = skin_quality_metrics(landmarks, front_bytes, metrics)
        merged_skin = _merge_skin_block(stored_skin, fresh_skin)

        patched_analysis = copy.deepcopy(analysis)
        patched_cv = patched_analysis.setdefault("cvReport", {})
        if not isinstance(patched_cv, dict):
            raise TypeError("analysis.cvReport must be a dict")
        patched_cv["skin"] = merged_skin

        after_fp = _analysis_fingerprint_excluding_skin(patched_analysis)
        if before_fp != after_fp:
            raise RuntimeError(
                "Patch would change analysis outside cvReport.skin — aborting dry-run"
            )

        updated_doc = None
        if not dry_run:
            updated_doc = await update_assessment_analysis(assessment_id, patched_analysis)
            if not updated_doc:
                raise RuntimeError(f"Failed to update assessment {assessment_id}")

            reloaded = await get_assessment_by_id(assessment_id)
            if not reloaded:
                raise RuntimeError(f"Assessment disappeared after update: {assessment_id}")

            reloaded_analysis = reloaded.get("analysis") or {}
            _assert_only_skin_changed(analysis, reloaded_analysis)

            reloaded_fp = _analysis_fingerprint_excluding_skin(reloaded_analysis)
            if reloaded_fp != before_fp:
                raise RuntimeError(
                    "Post-write verification failed: analysis outside skin was mutated"
                )

        return {
            "assessmentId": assessment_id,
            "dryRun": dry_run,
            "frontKey": front_key,
            "frontBytes": len(front_bytes),
            "landmarkCount": len(landmarks),
            "fingerprintExcludingSkin": before_fp,
            "beforeSkin": _skin_summary(stored_skin),
            "afterSkin": _skin_summary(merged_skin),
            "updated": not dry_run,
        }
    finally:
        await close_db()


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assessment_id", help="Assessment UUID to update in-place")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and print only; do not write to the database",
    )
    parser.add_argument(
        "-o",
        "--out",
        type=Path,
        default=None,
        help="Optional JSON output path",
    )
    args = parser.parse_args()

    try:
        payload = await run(args.assessment_id, dry_run=args.dry_run)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    text = json.dumps(payload, indent=2, default=str)
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"Wrote {args.out}")
    else:
        print(text)

    before = payload["beforeSkin"]
    after = payload["afterSkin"]
    print("\n--- summary ---", file=sys.stderr)
    for key in _SKIN_SUMMARY_KEYS:
        print(f"  {key}: {before.get(key)!r}  →  {after.get(key)!r}", file=sys.stderr)
    if payload.get("dryRun"):
        print("dry-run: no DB write", file=sys.stderr)
    else:
        print(f"OK: skin updated for {payload['assessmentId']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
