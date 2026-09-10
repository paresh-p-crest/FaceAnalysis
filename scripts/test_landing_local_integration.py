#!/usr/bin/env python3
"""End-to-end local test: landing DB + Stripe test PI + syncPaidOrderToApp handoff."""

from __future__ import annotations

import asyncio
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parents[1]
LANDING_ENV = ROOT / "project1-LandingPage" / ".env"
LANDING_DB = os.environ.get(
    "LANDING_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/myface_landing",
)
APP_HANDOFF_BASE = os.environ.get("LANDING_URL", "http://localhost:5000")
APP_API_BASE = os.environ.get("APP_API_URL", "http://localhost:8000")


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def stripe_post(secret: str, path: str, data: dict[str, str]) -> dict:
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.stripe.com{path}",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise RuntimeError(f"Stripe API {path} failed ({exc.code}): {detail}") from exc


def http_json(method: str, url: str, headers: dict[str, str] | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(url, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"detail": raw or exc.reason}
        return exc.code, payload


async def seed_order(
    conn: asyncpg.Connection,
    *,
    email: str,
    first_name: str,
    last_name: str,
    stripe_customer_id: str,
    payment_intent_id: str,
) -> tuple[str, str]:
    customer_id = str(uuid.uuid4())
    order_id = str(uuid.uuid4())
    order_number = f"MF-LOCAL-{secrets.token_hex(3).upper()}"

    await conn.execute(
        """
        INSERT INTO customers (id, email, first_name, last_name, stripe_customer_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
          SET first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              stripe_customer_id = EXCLUDED.stripe_customer_id
        """,
        customer_id,
        email.lower(),
        first_name,
        last_name,
        stripe_customer_id,
    )
    row = await conn.fetchrow("SELECT id FROM customers WHERE email = $1", email.lower())
    customer_id = row["id"]

    await conn.execute(
        """
        INSERT INTO orders (
          id, order_number, first_name, last_name, email, package_id, package_name,
          addons, total_cents, delivery, customer_id, stripe_customer_id,
          stripe_payment_intent_id, payment_verified_at, status, source
        ) VALUES (
          $1, $2, $3, $4, $5, 'analyse', 'MyFace Analysis',
          'color,express', 4900, 'standard', $6, $7,
          $8, NOW(), 'paid', 'integration-test'
        )
        """,
        order_id,
        order_number,
        first_name,
        last_name,
        email.lower(),
        customer_id,
        stripe_customer_id,
        payment_intent_id,
    )
    return customer_id, order_id


async def wait_for_handoff(payment_intent_id: str, timeout_s: float = 45.0) -> dict:
    url = (
        f"{APP_HANDOFF_BASE}/api/orders/by-payment-intent/"
        f"{urllib.parse.quote(payment_intent_id, safe='')}/app-handoff"
    )
    deadline = asyncio.get_event_loop().time() + timeout_s
    last: dict = {"status": "pending"}
    while asyncio.get_event_loop().time() < deadline:
        status, body = await asyncio.to_thread(http_json, "GET", url)
        if status != 200:
            raise RuntimeError(f"Handoff poll failed ({status}): {body}")
        last = body
        if body.get("status") == "ready":
            return body
        if body.get("status") == "failed":
            raise RuntimeError(f"Handoff failed: {body.get('message', body)}")
        await asyncio.sleep(1.5)
    raise TimeoutError(f"Handoff still pending after {timeout_s}s: {last}")


async def main() -> int:
    env = {**load_env_file(ROOT / ".env"), **load_env_file(LANDING_ENV), **os.environ}
    stripe_secret = env.get("STRIPE_SECRET_KEY", "").strip()
    import_secret = env.get("MYFACE_IMPORT_SECRET", "").strip()
    if not stripe_secret:
        print("Missing STRIPE_SECRET_KEY in project1-LandingPage/.env or root .env", file=sys.stderr)
        return 1
    if not import_secret:
        print("Missing MYFACE_IMPORT_SECRET", file=sys.stderr)
        return 1

    suffix = secrets.token_hex(4)
    email = f"landing.integration.{suffix}@example.com"
    first_name = "Landing"
    last_name = "Integration"

    print("1/4 Creating Stripe test customer + PaymentIntent…")
    customer = stripe_post(stripe_secret, "/v1/customers", {"email": email, "name": f"{first_name} {last_name}"})
    pi = stripe_post(
        stripe_secret,
        "/v1/payment_intents",
        {
            "amount": "4900",
            "currency": "eur",
            "customer": customer["id"],
            "payment_method_data[type]": "card",
            "payment_method_data[card][token]": "tok_visa",
            "confirm": "true",
            "metadata[packageId]": "analyse",
            "metadata[addons]": "color,express",
            "metadata[delivery]": "standard",
            "metadata[email]": email,
            "metadata[firstName]": first_name,
            "metadata[lastName]": last_name,
            "receipt_email": email,
        },
    )
    if pi.get("status") != "succeeded":
        print(f"PaymentIntent not succeeded: {pi.get('status')}", file=sys.stderr)
        return 1
    payment_intent_id = pi["id"]
    print(f"   PI {payment_intent_id} succeeded")

    print("2/4 Seeding landing order row…")
    conn = await asyncpg.connect(LANDING_DB)
    try:
        customer_id, order_id = await seed_order(
            conn,
            email=email,
            first_name=first_name,
            last_name=last_name,
            stripe_customer_id=customer["id"],
            payment_intent_id=payment_intent_id,
        )
        print(f"   customer={customer_id} order={order_id}")
    finally:
        await conn.close()

    print("3/4 Polling landing app-handoff (syncPaidOrderToApp)…")
    print(f"   Expect landing server at {APP_HANDOFF_BASE}")
    try:
        handoff = await wait_for_handoff(payment_intent_id)
    except (urllib.error.URLError, ConnectionRefusedError) as exc:
        print(f"Cannot reach landing server: {exc}", file=sys.stderr)
        print("Start it with: cd project1-LandingPage && pnpm exec cross-env NODE_ENV=development node --env-file=.env ./node_modules/tsx/dist/cli.mjs server/index.ts", file=sys.stderr)
        return 1

    redirect = handoff.get("redirectUrl", "")
    print(f"   Handoff ready → {redirect}")
    if not redirect.startswith("http://localhost:3000/auth"):
        print(f"Unexpected redirect URL: {redirect}", file=sys.stderr)
        return 1

    print("4/4 Verifying app import idempotency…")
    status, body = await asyncio.to_thread(
        http_json,
        "POST",
        f"{APP_API_BASE}/api/import/myface-session",
        {
            "Authorization": f"Bearer {import_secret}",
            "Idempotency-Key": payment_intent_id,
            "Content-Type": "application/json",
        },
    )
    if status != 200 or not body.get("success"):
        print(f"App import verify failed ({status}): {body}", file=sys.stderr)
        return 1

    print("Integration test passed.")
    print(json.dumps({"email": email, "paymentIntentId": payment_intent_id, "redirectUrl": redirect}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
