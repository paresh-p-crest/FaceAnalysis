"""PostgreSQL connection (SQLAlchemy async + asyncpg)."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .models import Base

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_database_url() -> Optional[str]:
    """Return async SQLAlchemy URL, preferring Replit's PG* vars over DATABASE_URL secret."""
    from urllib.parse import quote_plus

    # Prefer Replit's injected individual PG vars — they point to the internal
    # Postgres and are never shadowed by user-set secrets.
    pghost = os.environ.get("PGHOST")
    pgport = os.environ.get("PGPORT", "5432")
    pguser = os.environ.get("PGUSER")
    pgpassword = os.environ.get("PGPASSWORD")
    pgdatabase = os.environ.get("PGDATABASE")

    if pghost and pguser and pgdatabase:
        password_part = f":{quote_plus(pgpassword)}@" if pgpassword else "@"
        return f"postgresql+asyncpg://{pguser}{password_part}{pghost}:{pgport}/{pgdatabase}"

    # Fall back to DATABASE_URL / POSTGRES_URL if PG* vars are absent
    raw = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if not raw:
        return None
    # Strip libpq-only params (sslmode, channel_binding, ...) — asyncpg rejects them;
    # SSL is applied via connect_args in connect_db().
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    _libpq_only = {
        "sslmode", "channel_binding", "sslrootcert", "sslcert",
        "sslkey", "sslpassword", "gssencmode", "options",
    }
    parsed = urlparse(raw)
    qs = {k: v for k, v in parse_qs(parsed.query).items() if k not in _libpq_only}
    cleaned = urlunparse(parsed._replace(query=urlencode({k: v[0] for k, v in qs.items()})))
    if cleaned.startswith("postgresql+asyncpg://"):
        return cleaned
    if cleaned.startswith("postgres://"):
        return "postgresql+asyncpg://" + cleaned[len("postgres://"):]
    if cleaned.startswith("postgresql://"):
        return "postgresql+asyncpg://" + cleaned[len("postgresql://"):]
    return cleaned


def is_db_configured() -> bool:
    return bool(get_database_url())


async def connect_db() -> None:
    """Connect on app startup and ensure schema exists (greenfield create_all)."""
    global _engine, _session_factory
    url = get_database_url()
    if not url:
        return
    # SSL: off for Replit's internal Postgres (built from PG* vars), on for a
    # managed/remote DATABASE_URL (e.g. Neon) unless it explicitly disables SSL.
    raw_url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL") or ""
    using_pg_vars = bool(
        os.environ.get("PGHOST")
        and os.environ.get("PGUSER")
        and os.environ.get("PGDATABASE")
    )
    if using_pg_vars:
        needs_ssl = False
    else:
        needs_ssl = "sslmode=disable" not in raw_url
    connect_args = {"ssl": True} if needs_ssl else {}
    _engine = create_async_engine(url, pool_pre_ping=True, connect_args=connect_args)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        raise RuntimeError("Database is not connected. Set DATABASE_URL in your environment.")
    return _session_factory


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def ping_db() -> bool:
    if _engine is None:
        return False
    try:
        async with _engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
