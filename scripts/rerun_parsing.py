#!/usr/bin/env python3
"""Re-run SegFormer face parsing for an existing assessment (parsing stage only)."""

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
    parser = argparse.ArgumentParser(description="Re-run face parsing for one assessment")
    parser.add_argument("assessment_id", help="Assessment UUID")
    args = parser.parse_args()

    from backend.database import close_db, connect_db, is_db_configured
    from backend.face_parsing import face_parsing_enabled
    from backend.pipeline_stages import run_parsing_stage
    from backend.repositories.assessment_repository import get_assessment_by_id

    if not is_db_configured():
        print("ERROR: Database not configured (set DATABASE_URL in .env)", file=sys.stderr)
        return 1

    if not face_parsing_enabled():
        print(
            "ERROR: Face parsing disabled or PyTorch/transformers not installed.\n"
            "Install: backend\\.venv\\Scripts\\pip install -r backend\\requirements-face-parsing.txt",
            file=sys.stderr,
        )
        return 1

    await connect_db()
    try:
        assessment = await get_assessment_by_id(args.assessment_id)
        if not assessment:
            print(f"ERROR: Assessment not found: {args.assessment_id}", file=sys.stderr)
            return 1

        print(f"Running parsing stage for {args.assessment_id} ...")
        updated = await run_parsing_stage(assessment)
        fp = updated.get("featureParsing") or {}
        print(json.dumps(fp, indent=2))
        if fp.get("status") == "ready":
            print("OK: featureParsing ready")
            return 0
        print(f"FAILED: {fp.get('lastError')}", file=sys.stderr)
        return 1
    finally:
        await close_db()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
