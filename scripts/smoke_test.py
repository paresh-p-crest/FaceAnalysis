"""Local smoke checks for MyFace backend services.

Run after FastAPI is up:
    python scripts/smoke_test.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env")


def request(base_url: str, path: str, *, method: str = "GET", payload: dict | None = None, token: str | None = None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(f"{base_url.rstrip('/')}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            body = res.read().decode("utf-8")
            return res.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return exc.code, json.loads(body) if body else {}


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    suffix = f" - {detail}" if detail else ""
    print(f"[{status}] {name}{suffix}")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("MYFACE_API_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--email", default=os.environ.get("MYFACE_TEST_EMAIL") or os.environ.get("ADMIN_EMAIL"))
    parser.add_argument("--password", default=os.environ.get("MYFACE_TEST_PASSWORD") or os.environ.get("ADMIN_PASSWORD"))
    args = parser.parse_args()

    passed = []

    status, health = request(args.base_url, "/api/health")
    passed.append(check("health", status == 200 and health.get("status") == "ok", f"mongodb={health.get('mongodb')}"))

    if not args.email or not args.password:
        passed.append(check("auth credentials", False, "set MYFACE_TEST_EMAIL/PASSWORD or ADMIN_EMAIL/PASSWORD"))
        return 1

    status, login = request(
        args.base_url,
        "/api/auth/login",
        method="POST",
        payload={"email": args.email, "password": args.password},
    )
    token = login.get("token")
    user = login.get("user") or {}
    passed.append(check("login", status == 200 and bool(token), f"role={user.get('role', 'unknown')}"))

    if token:
        status, reports = request(args.base_url, "/api/my/assessments?limit=3", token=token)
        passed.append(check("my assessments", status == 200 and isinstance(reports.get("items"), list), f"count={len(reports.get('items', []))}"))

        status, payments = request(args.base_url, "/api/payments/my?limit=3", token=token)
        passed.append(check("my payments", status == 200 and isinstance(payments.get("items"), list), f"count={len(payments.get('items', []))}"))

        status, config = request(args.base_url, "/api/payments/config")
        providers = config.get("stripe", {}).get("configured"), config.get("paypal", {}).get("configured")
        passed.append(check("payment config", status == 200, f"stripe={providers[0]} paypal={providers[1]}"))

        status, admin_probe = request(
            args.base_url,
            "/api/assessments/000000000000000000000000/admin-review",
            method="PATCH",
            payload={"status": "approved"},
            token=token,
        )
        expected = 404 if user.get("role") == "admin" else 403
        passed.append(check("admin review guard", status == expected, f"status={status} detail={admin_probe.get('detail')}"))

    return 0 if all(passed) else 1


if __name__ == "__main__":
    sys.exit(main())
