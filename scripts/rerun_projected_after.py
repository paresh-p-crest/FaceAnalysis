#!/usr/bin/env python3
"""Re-run full-face projected AFTER for an existing assessment (projected_after stage only).

Always generates/overwrites projected/full.jpg|png, updates projected_after JSONB,
then runs CV into projected_analysis (BEFORE analysis untouched) — same as the admin
POST /api/assessments/{id}/projected-after path (ignores PROJECTED_AFTER_ENABLED
unless --respect-enabled-flag is passed).

Usage (do not run automatically — invoke manually):

  PYTHONPATH=. backend/.venv/Scripts/python.exe scripts/rerun_projected_after.py <assessment_uuid>

  # Soft-skip when PROJECTED_AFTER_ENABLED=false (pipeline-like):
  PYTHONPATH=. backend/.venv/Scripts/python.exe scripts/rerun_projected_after.py <id> --respect-enabled-flag
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


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Re-run projected AFTER generation for one assessment"
    )
    parser.add_argument("assessment_id", help="Assessment UUID")
    parser.add_argument(
        "--respect-enabled-flag",
        action="store_true",
        help="Honor PROJECTED_AFTER_ENABLED (may skip). Default: always run like admin.",
    )
    parser.add_argument(
        "--soft-fail",
        action="store_true",
        help="Persist failed/skipped status instead of raising on missing front/landmarks/errors.",
    )
    args = parser.parse_args()

    from backend.database import close_db, connect_db, is_db_configured
    from backend.pipeline_stages import generate_projected_after_now
    from backend.repositories.assessment_repository import get_assessment_by_id

    if not is_db_configured():
        print("ERROR: Database not configured (set DATABASE_URL in .env)", file=sys.stderr)
        return 1

    await connect_db()
    try:
        assessment = await get_assessment_by_id(args.assessment_id)
        if not assessment:
            print(f"ERROR: Assessment not found: {args.assessment_id}", file=sys.stderr)
            return 1

        analysis = assessment.get("analysis") or {}
        has_front_meta = bool((assessment.get("photos") or {}).get("front"))
        landmark_count = len(analysis.get("landmarks") or [])
        print(
            f"Running projected AFTER for {args.assessment_id} "
            f"(front_meta={has_front_meta}, landmarks={landmark_count}, "
            f"respect_enabled={args.respect_enabled_flag}) ..."
        )

        try:
            updated = await generate_projected_after_now(
                assessment,
                respect_enabled_flag=args.respect_enabled_flag,
                raise_on_error=not args.soft_fail,
            )
        except Exception as exc:
            print(f"FAILED: {exc}", file=sys.stderr)
            return 1

        pa = updated.get("projectedAfter") or {}
        print(json.dumps(pa, indent=2))

        status = pa.get("status")
        if status == "ready":
            public_url = (pa.get("full") or {}).get("publicUrl")
            print(f"OK: projectedAfter ready → {public_url}")
            return 0
        if status == "skipped":
            print("SKIPPED: PROJECTED_AFTER_ENABLED is false (use without --respect-enabled-flag to force)")
            return 0
        print(f"FAILED: {pa.get('lastError') or status}", file=sys.stderr)
        return 1
    finally:
        await close_db()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
