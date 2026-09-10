"""Create the landing-page PostgreSQL database if missing."""

from __future__ import annotations

import asyncio
import os
import sys

import asyncpg

DEFAULT_ADMIN_URL = "postgresql://postgres:postgres@localhost:5432/postgres"
LANDING_DB = "myface_landing"


async def main() -> int:
    admin_url = os.environ.get("PG_ADMIN_URL", DEFAULT_ADMIN_URL)
    conn = await asyncpg.connect(admin_url)
    try:
        exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            LANDING_DB,
        )
        if exists:
            print(f"Database {LANDING_DB} already exists")
            return 0
        await conn.execute(f'CREATE DATABASE "{LANDING_DB}"')
        print(f"Created database {LANDING_DB}")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
