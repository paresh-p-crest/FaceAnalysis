#!/usr/bin/env python3
"""Run projected AFTER CV only — uses the image referenced in DB (no regen).

Resolves AFTER from assessment `projectedAfter.full.relativePath` / `publicUrl`,
then runs `run_projected_analysis_now` → `projected_analysis` without regenerating
AFTER art (saves cost). Does not mutate BEFORE `analysis`.

Usage (manual invoke only):

  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_projected_analysis.py <assessment_uuid>

  # If status is not ready but a local file still exists for the DB path (or under
  # projected/), mark ready then CV:
  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_projected_analysis.py <id> --ensure-ready
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")


def _fingerprint_analysis(analysis: dict | None) -> str:
    """Stable-ish fingerprint to verify BEFORE analysis was not mutated."""
    blob = analysis or {}
    cv = blob.get("cvReport") or {}
    overall = (cv.get("overall") or {}).get("score")
    skin = (cv.get("skin") or {}).get("score")
    lm = blob.get("landmarks") or []
    return json.dumps(
        {
            "overall": overall,
            "skin": skin,
            "landmarkCount": len(lm),
            "keys": sorted(blob.keys()),
        },
        sort_keys=True,
    )


def _key_size(media, key: str) -> int:
    data = media.get_bytes(key)
    return len(data) if data else 0


def resolve_from_db(assessment_id: str, projected_after: dict | None) -> dict | None:
    """Prefer DB projectedAfter.full.relativePath / publicUrl (canonical source)."""
    from backend.media_storage import get_media_storage, media_key_from_ref, public_url_for_key

    pa = projected_after or {}
    full = pa.get("full") if isinstance(pa.get("full"), dict) else {}
    if not full:
        return None

    relative = full.get("relativePath") or ""
    public_url = full.get("publicUrl") or ""

    key = media_key_from_ref(relative) or media_key_from_ref(public_url)
    if not key:
        return None

    media = get_media_storage()
    size = _key_size(media, key)
    if size <= 0:
        return None

    filename = key.rsplit("/", 1)[-1]
    return {
        "publicUrl": public_url or public_url_for_key(key),
        "relativePath": key,
        "byteSize": size,
        "filename": filename,
        "source": "db",
        "path": key,
    }


def resolve_from_disk_scan(assessment_id: str) -> dict | None:
    """Fallback only: scan projected/ for full.jpg|png when DB has no usable URL."""
    from backend.media_storage import assessment_key, get_media_storage, public_url_for_key

    media = get_media_storage()
    for name in ("full.jpg", "full.jpeg", "full.png"):
        key = assessment_key(assessment_id, "projected", name)
        size = _key_size(media, key)
        if size > 0:
            return {
                "publicUrl": public_url_for_key(key),
                "relativePath": key,
                "byteSize": size,
                "filename": name,
                "source": "disk_scan",
                "path": key,
            }
    return None


async def ensure_projected_after_ready(
    assessment_id: str,
    assessment: dict,
) -> dict:
    """Ensure projectedAfter.status=ready using DB URL first, disk scan only as fallback."""
    from backend.photo_storage import load_projected_full
    from backend.projected_after_status import merge_projected_after_update
    from backend.repositories.assessment_repository import (
        get_assessment_by_id,
        update_assessment_projected_after,
    )

    pa = dict(assessment.get("projectedAfter") or {})
    meta = resolve_from_db(assessment_id, pa)
    if meta is None:
        meta = resolve_from_disk_scan(assessment_id)
    if meta is None:
        raise FileNotFoundError(
            "No AFTER image: projectedAfter.full URL/path missing or file not on disk, "
            f"and no projected/full.* under uploads/assessments/{assessment_id}/projected/"
        )

    if pa.get("status") == "ready" and load_projected_full(assessment_id, pa):
        print(
            f"using DB projectedAfter.full → {meta.get('relativePath')} "
            f"({meta['byteSize']} bytes, source={meta['source']})"
        )
        return assessment

    pa = merge_projected_after_update(
        pa,
        status="ready",
        full={"publicUrl": meta["publicUrl"], "relativePath": meta["relativePath"]},
        lastError=None,
    )
    await update_assessment_projected_after(assessment_id, pa)
    print(
        f"ensured projectedAfter.status=ready → {meta['filename']} "
        f"({meta['byteSize']} bytes, source={meta['source']})"
    )
    return await get_assessment_by_id(assessment_id) or assessment


async def run_projected_analysis_from_existing_image(
    assessment_id: str,
    *,
    ensure_ready: bool = True,
) -> dict:
    """Test helper: CV on DB-referenced AFTER image → projected_analysis."""
    from backend.pipeline_stages import run_projected_analysis_now
    from backend.photo_storage import load_projected_full
    from backend.repositories.assessment_repository import get_assessment_by_id

    assessment = await get_assessment_by_id(assessment_id)
    if not assessment:
        raise ValueError(f"Assessment not found: {assessment_id}")

    if ensure_ready:
        assessment = await ensure_projected_after_ready(assessment_id, assessment)
    else:
        pa = assessment.get("projectedAfter") or {}
        meta = resolve_from_db(assessment_id, pa)
        if not meta:
            raise FileNotFoundError(
                "projectedAfter.full relativePath/publicUrl missing or file not readable; "
                "pass --ensure-ready only if a local projected/full.* fallback is acceptable"
            )
        print(
            f"using DB projectedAfter.full → {meta['relativePath']} "
            f"({meta['byteSize']} bytes)"
        )

    pa = assessment.get("projectedAfter") or {}
    if pa.get("status") != "ready":
        raise RuntimeError(
            f"projectedAfter.status={pa.get('status')!r}; require status=ready "
            "(DB full.publicUrl / relativePath) or use --ensure-ready"
        )

    data = load_projected_full(assessment_id, pa)
    if not data:
        raise FileNotFoundError(
            "projectedAfter is ready but file for relativePath/publicUrl is missing on disk"
        )

    before_fp = _fingerprint_analysis(assessment.get("analysis"))

    updated = await run_projected_analysis_now({"id": assessment_id})

    after_fp = _fingerprint_analysis(updated.get("analysis"))
    if before_fp != after_fp:
        raise RuntimeError("BEFORE analysis was mutated — projected_analysis must not touch analysis")

    return updated


def _summarize_projected_analysis(proj: dict | None) -> dict:
    proj = proj or {}
    cv = proj.get("cvReport") or {}
    metrics = proj.get("metrics") or {}
    return {
        "status": proj.get("status"),
        "source": proj.get("source"),
        "error": proj.get("error"),
        "updatedAt": proj.get("updatedAt"),
        "landmarkCount": len(proj.get("landmarks") or []),
        "scores": {
            "overall": (cv.get("overall") or {}).get("score"),
            "skin": (cv.get("skin") or {}).get("score"),
            "symmetry": (cv.get("symmetry") or {}).get("score"),
            "harmonyScore": metrics.get("harmonyScore"),
        },
    }


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run projected AFTER CV into projected_analysis from the image URL/path "
            "stored on the assessment (does not regenerate AFTER)"
        )
    )
    parser.add_argument("assessment_id", help="Assessment UUID")
    parser.add_argument(
        "--ensure-ready",
        action="store_true",
        default=True,
        help="If status is not ready, mark ready using DB path or disk fallback (default).",
    )
    parser.add_argument(
        "--no-ensure-ready",
        action="store_true",
        help="Require projectedAfter.status=ready with a readable DB full URL/path.",
    )
    args = parser.parse_args()
    ensure_ready = not args.no_ensure_ready

    from backend.database import close_db, connect_db, is_db_configured

    if not is_db_configured():
        print("ERROR: Database not configured (set DATABASE_URL in .env)", file=sys.stderr)
        return 1

    await connect_db()
    try:
        print(
            f"Running projected_analysis from DB AFTER URL for {args.assessment_id} "
            f"(ensure_ready={ensure_ready}) ..."
        )
        try:
            updated = await run_projected_analysis_from_existing_image(
                args.assessment_id,
                ensure_ready=ensure_ready,
            )
        except Exception as exc:
            print(f"FAILED: {exc}", file=sys.stderr)
            return 1

        summary = _summarize_projected_analysis(updated.get("projectedAnalysis"))
        print(json.dumps(summary, indent=2))

        status = summary.get("status")
        if status == "ready":
            print("OK: projectedAnalysis ready (BEFORE analysis unchanged)")
            return 0
        if status == "skipped":
            print("SKIPPED: projectedAfter not ready", file=sys.stderr)
            return 1
        print(f"FAILED: {summary.get('error') or status}", file=sys.stderr)
        return 1
    finally:
        await close_db()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
