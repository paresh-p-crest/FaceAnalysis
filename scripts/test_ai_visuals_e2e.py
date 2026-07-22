#!/usr/bin/env python3
"""End-to-end AI visuals test: generate, persist to DB, reload assessment.

Mirrors the normal UI flow:
  POST /api/assessments/{id}/ai-visuals  →  ai_visuals JSONB on assessment row
  GET  /api/assessments/{id}             →  aiVisuals.variants[].imageSrc

Usage:
  PYTHONPATH=. python scripts/test_ai_visuals_e2e.py e79b59c8-dfcc-49fd-90c6-da25668fc4c7
  PYTHONPATH=. python scripts/test_ai_visuals_e2e.py <id> --dry-run   # GET only, no generate
  PYTHONPATH=. python scripts/test_ai_visuals_e2e.py <id> --save-dir ./tmp/ai-visuals
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")


def request(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict | None = None,
    token: str | None = None,
    timeout: float = 180,
):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            body = res.read().decode("utf-8")
            return res.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"raw": body[:800]}
        return exc.code, parsed


def _save_data_url(path: Path, data_url: str) -> None:
    if not data_url.startswith("data:"):
        return
    header, _, b64 = data_url.partition(",")
    if not b64:
        return
    ext = "png"
    if "jpeg" in header or "jpg" in header:
        ext = "jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(base64.b64decode(b64))


def _summarize_variants(ai_visuals: dict | None) -> list[str]:
    lines = []
    for v in (ai_visuals or {}).get("variants") or []:
        src = v.get("imageSrc") or ""
        src_kind = "data_url" if src.startswith("data:") else ("url" if src else "none")
        src_len = len(src) if src else 0
        lines.append(
            f"  - {v.get('type')}/{v.get('styleId')}: status={v.get('status')} "
            f"title={v.get('title')!r} image={src_kind}({src_len} chars)"
        )
        if v.get("error"):
            lines.append(f"      error: {v['error'][:200]}")
    return lines


def _print_and_save(ai_visuals: dict | None, save_dir: Path | None) -> int:
    generated_count = 0
    for line in _summarize_variants(ai_visuals):
        print(line)
    for v in (ai_visuals or {}).get("variants") or []:
        if v.get("imageSrc"):
            generated_count += 1
        if save_dir and v.get("imageSrc", "").startswith("data:"):
            out = save_dir / f"{v.get('type')}_{v.get('styleId', 'variant')}.png"
            _save_data_url(out, v["imageSrc"])
            print(f"[OK] saved {out}")
    return generated_count


async def _run_direct(assessment_id: str, variants: list[str]) -> tuple[dict | None, dict | None]:
    from backend.database import connect_db
    from backend.repositories.assessment_repository import get_assessment_by_id, update_assessment_ai_visuals
    from backend.visual_generation import generate_visual_variants

    await connect_db()
    existing = await get_assessment_by_id(assessment_id)
    if not existing:
        raise SystemExit(f"[FAIL] assessment not found: {assessment_id}")

    analysis = existing.get("analysis") or {}
    cv_report = analysis.get("cvReport")
    if not cv_report:
        raise SystemExit("[FAIL] assessment has no analysis.cvReport")

    ai_visuals = await generate_visual_variants(
        answers=existing.get("answers") or {},
        cv_report=cv_report,
        metrics=analysis.get("metrics"),
        variant_types=variants,
        assessment_id=assessment_id,
        assessment_photos=existing.get("photos") or {},
        projected_after=existing.get("projectedAfter"),
    )
    updated = await update_assessment_ai_visuals(assessment_id, ai_visuals)
    reloaded = await get_assessment_by_id(assessment_id)
    return updated, reloaded


def main() -> int:
    parser = argparse.ArgumentParser(description="E2E AI visuals generation test")
    parser.add_argument("assessment_id", help="Assessment UUID")
    parser.add_argument("--base-url", default=os.environ.get("MYFACE_API_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--email", default=os.environ.get("MYFACE_TEST_EMAIL") or os.environ.get("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.environ.get("MYFACE_TEST_PASSWORD") or os.environ.get("ADMIN_PASSWORD"))
    parser.add_argument("--dry-run", action="store_true", help="Skip POST; only load stored aiVisuals")
    parser.add_argument(
        "--direct",
        action="store_true",
        help="Bypass HTTP: load assessment from DB, generate, persist (needs DATABASE_URL + OPENAI_API_KEY)",
    )
    parser.add_argument("--save-dir", type=Path, help="Write variant images to this folder")
    parser.add_argument(
        "--variants",
        nargs="+",
        default=["hair", "outfit", "aging"],
        choices=["hair", "outfit", "aging"],
    )
    args = parser.parse_args()
    aid = args.assessment_id

    if args.direct:
        import asyncio

        has_key = bool(os.environ.get("OPENAI_API_KEY", "").strip())
        print(f"[INFO] --direct mode OPENAI_API_KEY configured={has_key}")
        print(f"[RUN] generate_visual_variants + DB persist for {aid}...")
        updated, reloaded = asyncio.run(_run_direct(aid, args.variants))
        ai_visuals = (updated or {}).get("aiVisuals") or {}
        print(
            f"[OK] generated source={ai_visuals.get('source')} model={ai_visuals.get('model')} "
            f"sourceKind={ai_visuals.get('sourceKind')} variants={len(ai_visuals.get('variants') or [])}"
        )
        generated_count = _print_and_save(ai_visuals, args.save_dir)

        stored = (reloaded or {}).get("aiVisuals") or {}
        stored_variants = stored.get("variants") or []
        if len(stored_variants) != len(ai_visuals.get("variants") or []):
            print("[FAIL] persistence mismatch after reload")
            return 1
        print(f"[OK] persisted to DB — {generated_count}/{len(stored_variants)} variants have imageSrc")
        if generated_count == 0:
            print("[FAIL] all variants blocked — check OPENAI_API_KEY and front photo storage")
            return 1
        return 0

    status, health = request(args.base_url, "/api/health")
    if status != 200:
        print(f"[FAIL] health HTTP {status}")
        return 1
    print(f"[OK] health status={health.get('status')} database={health.get('database')}")

    if not args.email or not args.password:
        print("[FAIL] set MYFACE_TEST_EMAIL/PASSWORD or ADMIN_EMAIL/PASSWORD in .env")
        return 1

    status, login = request(
        args.base_url,
        "/api/auth/login",
        method="POST",
        payload={"email": args.email, "password": args.password},
    )
    token = login.get("token")
    if status != 200 or not token:
        print(f"[FAIL] login HTTP {status}: {login}")
        return 1
    role = (login.get("user") or {}).get("role")
    print(f"[OK] login role={role}")

    aid = args.assessment_id
    status, before = request(args.base_url, f"/api/assessments/{aid}", token=token)
    if status != 200:
        print(f"[FAIL] GET assessment HTTP {status}: {before}")
        return 1

    cv = (before.get("analysis") or {}).get("cvReport")
    if not cv:
        print("[FAIL] assessment has no analysis.cvReport — run CV analysis first")
        return 1
    print(f"[OK] assessment loaded id={aid} cvReport=yes")

    before_visuals = before.get("aiVisuals")
    print(f"[INFO] before: aiVisuals={'yes' if before_visuals else 'no'} variants={len((before_visuals or {}).get('variants') or [])}")
    for line in _summarize_variants(before_visuals):
        print(line)

    if args.dry_run:
        print("[SKIP] --dry-run: not calling POST ai-visuals")
        return 0

    has_key = bool(os.environ.get("OPENAI_API_KEY", "").strip())
    print(f"[INFO] OPENAI_API_KEY configured={has_key}")
    if not has_key:
        print("[WARN] generation will likely return status=blocked without an API key")

    print(f"[RUN] POST ai-visuals variants={args.variants} (may take 1–3 min)...")
    status, generated = request(
        args.base_url,
        f"/api/assessments/{aid}/ai-visuals",
        method="POST",
        payload={"variants": args.variants},
        token=token,
        timeout=300,
    )
    if status != 200:
        print(f"[FAIL] POST ai-visuals HTTP {status}: {generated}")
        return 1

    ai_visuals = generated.get("aiVisuals") or {}
    print(
        f"[OK] generated source={ai_visuals.get('source')} model={ai_visuals.get('model')} "
        f"sourceKind={ai_visuals.get('sourceKind')} variants={len(ai_visuals.get('variants') or [])}"
    )
    for line in _summarize_variants(ai_visuals):
        print(line)

    status, reloaded = request(args.base_url, f"/api/assessments/{aid}", token=token)
    if status != 200:
        print(f"[FAIL] reload GET HTTP {status}")
        return 1

    stored = reloaded.get("aiVisuals") or {}
    stored_variants = stored.get("variants") or []
    gen_variants = ai_visuals.get("variants") or []
    if len(stored_variants) != len(gen_variants):
        print(f"[FAIL] persistence mismatch: POST returned {len(gen_variants)}, GET has {len(stored_variants)}")
        return 1

    generated_count = _print_and_save(stored, args.save_dir)
    print(f"[OK] persisted to DB — {generated_count}/{len(stored_variants)} variants have imageSrc")

    blocked = [v for v in stored_variants if v.get("status") == "blocked"]
    if blocked and not generated_count:
        print("[FAIL] all variants blocked — check OPENAI_API_KEY and front photo storage")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
