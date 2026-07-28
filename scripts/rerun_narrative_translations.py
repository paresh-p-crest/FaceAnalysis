#!/usr/bin/env python3
"""Force re-translate stored English narratives into a target locale.

Does not regenerate English protocol text. Currently only ``de`` is supported
(ADR-044 plain-text per-field translation).

Usage (do not run automatically — invoke manually):

  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_narrative_translations.py <assessment_uuid> --language de

  PYTHONPATH=. .venv/Scripts/python.exe scripts/rerun_narrative_translations.py <id> -l de
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Force re-translate EN narratives for one assessment (no EN regen)"
    )
    parser.add_argument("assessment_id", help="Assessment UUID")
    parser.add_argument(
        "-l",
        "--language",
        "--locale",
        dest="locale",
        required=True,
        help="Target translation locale (currently: de). English is source — not valid here.",
    )
    args = parser.parse_args()

    from backend.database import close_db, connect_db, is_db_configured
    from backend.protocol_service import (
        SUPPORTED_TRANSLATION_LOCALES,
        regenerate_narrative_translations,
    )
    from backend.repositories.assessment_repository import get_assessment_by_id

    locale = (args.locale or "").strip().lower()
    if locale in ("", "en"):
        print(
            "ERROR: English is the source narrative language; pass --language de "
            "to force German translation.",
            file=sys.stderr,
        )
        return 2
    if locale not in SUPPORTED_TRANSLATION_LOCALES:
        print(
            f"ERROR: Unsupported locale '{locale}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_TRANSLATION_LOCALES))}",
            file=sys.stderr,
        )
        return 2

    if not is_db_configured():
        print("ERROR: Database not configured (set DATABASE_URL in .env)", file=sys.stderr)
        return 1

    await connect_db()
    try:
        assessment = await get_assessment_by_id(args.assessment_id)
        if not assessment:
            print(f"ERROR: Assessment not found: {args.assessment_id}", file=sys.stderr)
            return 1

        features = assessment.get("featureNarratives") or {}
        pn = assessment.get("protocolNarrative") or {}
        print(
            f"Re-translating narratives for {args.assessment_id} → locale={locale} "
            f"(features={len(features) if isinstance(features, dict) else 0}, "
            f"has_overview={bool(isinstance(pn, dict) and pn.get('summary'))}, "
            f"has_closing={bool(isinstance(pn, dict) and pn.get('closing'))}) ..."
        )

        bundle = await regenerate_narrative_translations(assessment, locale=locale)
        updated = bundle.get("assessment") or {}
        de_features = 0
        fn = updated.get("featureNarratives") or assessment.get("featureNarratives") or {}
        if isinstance(fn, dict):
            de_features = sum(
                1
                for v in fn.values()
                if isinstance(v, dict) and isinstance(v.get("de"), dict) and v["de"].get("summary")
            )
        print(
            f"OK locale={bundle.get('locale')} source={bundle.get('source')} "
            f"features_with_de_summary={de_features}"
        )
        return 0
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"ERROR: translation failed: {exc}", file=sys.stderr)
        return 1
    finally:
        await close_db()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
