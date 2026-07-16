#!/usr/bin/env python3
"""Print the fixed projected-AFTER image-edit prompt for manual provider testing.

MANUAL DEV TOOL — do not run automatically; AI agents must not invoke this script.

Usage (human/dev only):

  uv run python scripts/preview_projected_after_prompt.py
  uv run python scripts/preview_projected_after_prompt.py e79b59c8-dfcc-49fd-90c6-da25668fc4c7

Optional assessment_id prints a front.jpg media path hint for playground pairing.
Does not call generate_image_edit or require DATABASE_URL for the prompt text.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.media_storage import assessment_key, public_url_for_key
from backend.projected_after_ai import PROJECTED_AFTER_PROMPT

DEFAULT_ASSESSMENT_ID = "e79b59c8-dfcc-49fd-90c6-da25668fc4c7"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Print the fixed projected-AFTER prompt (manual dev tool only)"
    )
    parser.add_argument(
        "assessment_id",
        nargs="?",
        default=DEFAULT_ASSESSMENT_ID,
        help=f"Optional assessment UUID for front.jpg path hint (default: {DEFAULT_ASSESSMENT_ID})",
    )
    args = parser.parse_args()

    print(PROJECTED_AFTER_PROMPT)
    if args.assessment_id:
        key = assessment_key(args.assessment_id, "front.jpg")
        print(f"\n--- front image hint ---\n{public_url_for_key(key)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
