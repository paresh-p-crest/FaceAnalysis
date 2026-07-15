#!/usr/bin/env python3
"""Test hair / Norwood geometric staging for one assessment.

Loads ``topHead.jpg`` (+ optional front) from disk, runs temple-geometry hair
analysis, prints comparison vs stored hair, and by default inserts a **new**
assessment row (clone) with the same columns but only ``analysis.cvReport.hair``
updated. The source assessment is never modified.

Photos metadata still point at the source assessment's files (no disk copy).

Usage:

  PYTHONPATH=. .venv/Scripts/python.exe scripts/test_hair_norwood_assessment.py \\
    53bc5a23-6ece-4852-abc9-66687e30554a

  # Print only (no DB write):
  PYTHONPATH=. .venv/Scripts/python.exe scripts/test_hair_norwood_assessment.py <id> --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")


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


def _merge_hair_block(existing_hair: dict | None, fresh_hair: dict) -> dict:
    """Replace measurable hair fields; keep prior imageSrc / photoSource bindings."""
    from backend.serialization import to_json_safe

    merged = dict(existing_hair or {})
    safe = to_json_safe(fresh_hair) or {}
    if not isinstance(safe, dict):
        raise TypeError("fresh hair result must be a dict")
    for key, value in safe.items():
        merged[key] = value
    # Preserve frontal / top-head media bindings if fresh path omitted them
    for key in ("imageSrc", "imageSrcFront", "imageSrcTopHead", "photoSource"):
        if key in (existing_hair or {}) and not merged.get(key):
            merged[key] = existing_hair[key]
    return merged


async def _insert_clone_with_hair(source: dict, fresh_hair: dict) -> dict:
    """Insert a new assessments row: full column clone, hair block only changed."""
    from backend.database import session_scope
    from backend.models import Assessment, AssessmentStatus
    from backend.repositories._helpers import parse_uuid
    from backend.repositories.assessment_repository import _assessment_to_dict

    analysis = copy.deepcopy(source.get("analysis") or {})
    cv = analysis.get("cvReport")
    if not isinstance(cv, dict):
        cv = {}
        analysis["cvReport"] = cv
    existing_hair = cv.get("hair") if isinstance(cv.get("hair"), dict) else {}
    cv["hair"] = _merge_hair_block(existing_hair, fresh_hair)

    now = datetime.now(timezone.utc)
    source_id = source["id"]
    new_id = uuid.uuid4()
    scan_id = f"hair-norwood-clone-{str(source_id)[:8]}-{int(now.timestamp())}"

    status_raw = source.get("status") or "pending_review"
    try:
        status_enum = AssessmentStatus(status_raw)
    except ValueError:
        status_enum = AssessmentStatus.pending_review

    uid = parse_uuid(source["userId"]) if source.get("userId") else None
    note = (
        f"[hair-norwood-clone] Copied from assessment {source_id}. "
        f"Only analysis.cvReport.hair refreshed with temple-geometry Norwood. "
        f"All other columns copied; photo files remain under the source id."
    )
    if source.get("adminNotes"):
        note = f"{source['adminNotes']}\n\n{note}"

    row = Assessment(
        id=new_id,
        user_id=uid,
        status=status_enum,
        scan_id=scan_id,
        provider=source.get("provider") or "local",
        admin_notes=note,
        reviewed_at=None,
        reviewed_by={},
        answers=copy.deepcopy(source.get("answers") or {}),
        photos=copy.deepcopy(source.get("photos") or {}),
        photos_keys=copy.deepcopy(source.get("photosKeys") or []),
        analysis=analysis,
        ai_narrative=copy.deepcopy(source.get("aiNarrative")),
        protocol_narrative=copy.deepcopy(source.get("protocolNarrative")),
        feature_narratives=copy.deepcopy(source.get("featureNarratives")),
        protocol_storage=copy.deepcopy(source.get("protocolStorage")),
        ai_visuals=copy.deepcopy(source.get("aiVisuals")),
        pipeline=copy.deepcopy(source.get("pipeline")),
        feature_parsing=copy.deepcopy(source.get("featureParsing")),
        projected_after=copy.deepcopy(source.get("projectedAfter")),
        projected_analysis=copy.deepcopy(source.get("projectedAnalysis")),
        review_log=[],
        created_at=now,
        updated_at=now,
    )

    async with session_scope() as session:
        session.add(row)
        await session.flush()
        cloned = _assessment_to_dict(row)

    # Verify source unchanged
    from backend.repositories.assessment_repository import get_assessment_by_id

    again = await get_assessment_by_id(source_id)
    src_stage = (((again or {}).get("analysis") or {}).get("cvReport") or {}).get("hair", {}).get(
        "norwoodStage"
    )
    orig_stage = (((source.get("analysis") or {}).get("cvReport") or {}).get("hair") or {}).get(
        "norwoodStage"
    )
    if src_stage != orig_stage:
        raise RuntimeError(
            f"Source assessment hair was mutated (norwood {orig_stage} → {src_stage}); abort"
        )

    return cloned


async def run(assessment_id: str, *, dry_run: bool = False) -> dict:
    from backend.database import close_db, connect_db, is_db_configured
    from backend.hair_analysis import analyze_hair_photo, _norwood_stage, _norwood_stage_geometric
    from backend.hair_segmentation import analyze_hair_segmentation
    from backend.repositories.assessment_repository import get_assessment_by_id

    if not is_db_configured():
        raise RuntimeError("DATABASE_URL not set")

    await connect_db()
    try:
        doc = await get_assessment_by_id(assessment_id)
        if not doc:
            raise ValueError(f"Assessment not found: {assessment_id}")

        top_bytes, top_key = _load_pose(assessment_id, "topHead")
        front_bytes, front_key = _load_pose(assessment_id, "front")
        if not top_bytes:
            raise FileNotFoundError(
                f"topHead image missing for {assessment_id} "
                "(expected assessments/{id}/topHead.jpg in media storage)"
            )

        stored_hair = ((doc.get("analysis") or {}).get("cvReport") or {}).get("hair") or {}

        seg = analyze_hair_segmentation(top_bytes, front_bytes)
        hair = analyze_hair_photo(top_bytes, None, front_bytes)

        density_only = None
        geometric = None
        if seg:
            density_only = _norwood_stage(
                float(seg["densityPct"]),
                seg["hairline"],
                seg["thinningArea"],
            )
            if seg.get("templeMetrics"):
                geometric = _norwood_stage_geometric(
                    seg["templeMetrics"],
                    float(seg["densityPct"]),
                    seg["thinningArea"],
                )

        clone_info = None
        if not dry_run:
            cloned = await _insert_clone_with_hair(doc, hair)
            clone_hair = ((cloned.get("analysis") or {}).get("cvReport") or {}).get("hair") or {}
            clone_info = {
                "newAssessmentId": cloned["id"],
                "scanId": cloned.get("scanId"),
                "norwoodStage": clone_hair.get("norwoodStage"),
                "norwoodStagingMethod": clone_hair.get("norwoodStagingMethod"),
                "sourceAssessmentId": assessment_id,
                "sourceUnchanged": True,
            }

        return {
            "assessmentId": assessment_id,
            "dryRun": dry_run,
            "topHeadKey": top_key,
            "topHeadBytes": len(top_bytes),
            "frontKey": front_key,
            "storedHair": {
                "norwoodStage": stored_hair.get("norwoodStage"),
                "densityPct": stored_hair.get("densityPct"),
                "hairline": stored_hair.get("hairline"),
                "densityEstimate": stored_hair.get("densityEstimate"),
                "dataSource": stored_hair.get("dataSource"),
                "templeMetrics": stored_hair.get("templeMetrics"),
                "norwoodStagingMethod": stored_hair.get("norwoodStagingMethod"),
                "explanation": stored_hair.get("explanation"),
            },
            "segmentation": seg,
            "freshHairResult": dict(hair),
            "comparison": {
                "storedNorwood": stored_hair.get("norwoodStage"),
                "freshNorwood": hair.get("norwoodStage"),
                "densityHeuristicWouldSay": density_only,
                "geometricSays": geometric,
                "stagingMethod": hair.get("norwoodStagingMethod"),
            },
            "clonedRow": clone_info,
        }
    finally:
        await close_db()


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "assessment_id",
        nargs="?",
        default="53bc5a23-6ece-4852-abc9-66687e30554a",
        help="Source assessment UUID (left unchanged)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyze and print only; do not insert a clone row",
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

    cmp_ = payload["comparison"]
    print("\n--- summary ---", file=sys.stderr)
    print(
        f"source {payload['assessmentId']}: stored Norwood={cmp_['storedNorwood']}  →  "
        f"fresh={cmp_['freshNorwood']} ({cmp_['stagingMethod']})",
        file=sys.stderr,
    )
    print(
        f"density-heuristic-only would say {cmp_['densityHeuristicWouldSay']}; "
        f"geometry says {cmp_['geometricSays']}",
        file=sys.stderr,
    )
    tm = (payload.get("segmentation") or {}).get("templeMetrics") or {}
    if tm:
        print(
            f"templeRecession={tm.get('templeRecession')}  "
            f"midFrontal={tm.get('midFrontalFrac')}  "
            f"L/R={tm.get('leftTempleFrac')}/{tm.get('rightTempleFrac')}",
            file=sys.stderr,
        )
    if payload.get("clonedRow"):
        c = payload["clonedRow"]
        print(
            f"cloned new row id={c['newAssessmentId']}  norwood={c['norwoodStage']}  "
            f"(source unchanged)",
            file=sys.stderr,
        )
    elif payload.get("dryRun"):
        print("dry-run: no DB write", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
