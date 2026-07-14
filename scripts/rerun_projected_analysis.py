#!/usr/bin/env python3
"""Run projected AFTER CV only — uses the image referenced in DB (no regen).

Resolves AFTER from assessment `projectedAfter.full.relativePath` / `publicUrl`,
then runs `run_projected_analysis_now` → `projected_analysis` without regenerating
AFTER art (saves cost). Does not mutate BEFORE `analysis`.

Usage (manual invoke only):

  PYTHONPATH=. backend/.venv/Scripts/python.exe scripts/rerun_projected_analysis.py <assessment_uuid>

  # If status is not ready but a local file still exists for the DB path (or under
  # projected/), mark ready then CV:
  PYTHONPATH=. backend/.venv/Scripts/python.exe scripts/rerun_projected_analysis.py <id> --ensure-ready
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

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


def _local_path_from_relative(relative_path: str) -> Path | None:
    """Map DB relativePath (uploads/assessments/…) → public/ file."""
    if not relative_path:
        return None
    rel = relative_path.replace("\\", "/").lstrip("/")
    if rel.startswith("uploads/"):
        return ROOT / "public" / rel
    return ROOT / "public" / "uploads" / rel


def _local_path_from_public_url(public_url: str, assessment_id: str) -> Path | None:
    """Map /uploads/assessments/{id}/projected/full.png → disk path."""
    if not public_url:
        return None
    path = urlparse(public_url).path if "://" in public_url else public_url
    path = path.replace("\\", "/")
    marker = f"/uploads/assessments/{assessment_id}/"
    idx = path.find("/uploads/assessments/")
    if idx >= 0:
        # uploads/assessments/... relative to public/
        rel = path[idx + 1 :]  # strip leading /
        return ROOT / "public" / rel
    if path.startswith("/uploads/"):
        return ROOT / "public" / path.lstrip("/")
    # Bare filename under projected/
    name = Path(path).name
    if name.startswith("full."):
        from backend.photo_storage import get_photo_storage

        return get_photo_storage().upload_root / assessment_id / "projected" / name
    _ = marker
    return None


def resolve_from_db(assessment_id: str, projected_after: dict | None) -> dict | None:
    """Prefer DB projectedAfter.full.relativePath / publicUrl (canonical source)."""
    pa = projected_after or {}
    full = pa.get("full") if isinstance(pa.get("full"), dict) else {}
    if not full:
        return None

    relative = full.get("relativePath") or ""
    public_url = full.get("publicUrl") or ""

    path = _local_path_from_relative(relative) if relative else None
    if path is None or not path.exists():
        path = _local_path_from_public_url(public_url, assessment_id) if public_url else None

    if path is None or not path.exists() or path.stat().st_size <= 0:
        return None

    from backend.photo_storage import get_photo_storage

    storage = get_photo_storage()
    filename = path.name
    rel = relative or f"uploads/assessments/{assessment_id}/projected/{filename}"
    url = public_url or f"{storage.public_url_prefix}/{assessment_id}/projected/{filename}"
    return {
        "publicUrl": url,
        "relativePath": rel,
        "byteSize": path.stat().st_size,
        "filename": filename,
        "source": "db",
        "path": str(path),
    }


def resolve_from_disk_scan(assessment_id: str) -> dict | None:
    """Fallback only: scan projected/ for full.jpg|png when DB has no usable URL."""
    from backend.photo_storage import get_photo_storage

    storage = get_photo_storage()
    dest_dir = storage.upload_root / assessment_id / "projected"
    for name in ("full.jpg", "full.jpeg", "full.png"):
        path = dest_dir / name
        if path.exists() and path.stat().st_size > 0:
            return {
                "publicUrl": f"{storage.public_url_prefix}/{assessment_id}/projected/{name}",
                "relativePath": f"uploads/assessments/{assessment_id}/projected/{name}",
                "byteSize": path.stat().st_size,
                "filename": name,
                "source": "disk_scan",
                "path": str(path),
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
