#!/usr/bin/env python3
"""Manual tester for MiVOLO v2 age estimation.

Usage:
  python scripts/test_age_estimation.py --image path/to/photo.jpg
  python scripts/test_age_estimation.py --assessment <id>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add repo root to Python path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass

from backend.age_estimation import estimate_visual_age
from backend.opencv_metrics import visual_age_range_label


def main() -> int:
    parser = argparse.ArgumentParser(description="Test MiVOLO v2 age estimation")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image", type=str, help="Path to local image file")
    group.add_argument("--assessment", type=str, help="Assessment ID to load front photo for")

    args = parser.parse_args()

    image_bytes = None
    source_desc = ""

    if args.image:
        p = Path(args.image)
        if not p.is_file():
            print(f"Error: File not found: {args.image}", file=sys.stderr)
            return 1
        image_bytes = p.read_bytes()
        source_desc = f"image '{args.image}'"
    elif args.assessment:
        from backend.media_storage import get_media_storage, assessment_key
        storage = get_media_storage()
        key = assessment_key(args.assessment, "front.jpg")
        image_bytes = storage.get_bytes(key)
        if not image_bytes:
            print(f"Error: front.jpg not found for assessment '{args.assessment}'", file=sys.stderr)
            return 1
        source_desc = f"assessment '{args.assessment}' (front.jpg)"

    print(f"Running MiVOLO v2 age estimation on {source_desc}...")
    age = estimate_visual_age(image_bytes)

    if age is None:
        print("Result: Model unavailable or no face detected (estimate_visual_age returned None).")
        return 0

    bucket_label = visual_age_range_label(age)
    print(f"Result: Raw Prediction = {age} years | 5-Year Bucket = {bucket_label}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
