from __future__ import annotations

import asyncpg

from app.config import settings

pool: asyncpg.Pool | None = None


def _pg_dsn() -> str:
    url = settings.database_url
    if url.startswith("postgresql://"):
        url = "postgres://" + url[len("postgresql://"):]
    return url


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(dsn=_pg_dsn(), min_size=2, max_size=10)
    return pool


async def close_pool() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


async def fetch(query: str, *args):
    p = await get_pool()
    return await p.fetch(query, *args)


async def fetchrow(query: str, *args):
    p = await get_pool()
    return await p.fetchrow(query, *args)


async def fetchval(query: str, *args):
    p = await get_pool()
    return await p.fetchval(query, *args)


async def execute(query: str, *args):
    p = await get_pool()
    return await p.execute(query, *args)
