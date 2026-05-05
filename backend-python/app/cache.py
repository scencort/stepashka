from __future__ import annotations

import hashlib
import json
from typing import Any

from redis.asyncio import Redis

from app.config import settings


_client: Redis | None = None


def _redis_dsn() -> str:
    return settings.redis_url


async def get_client() -> Redis | None:
    global _client
    if not settings.redis_enabled:
        return None
    if _client is None:
        _client = Redis.from_url(_redis_dsn(), decode_responses=True)
    return _client


async def ping() -> bool:
    client = await get_client()
    if client is None:
        return False
    try:
        return bool(await client.ping())
    except Exception:
        return False


async def close() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


async def get_json(key: str) -> dict[str, Any] | None:
    client = await get_client()
    if client is None:
        return None
    try:
        raw = await client.get(key)
        if not raw:
            return None
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
        return None
    except Exception:
        return None


async def set_json(key: str, value: dict[str, Any], ttl_seconds: int | None = None) -> None:
    client = await get_client()
    if client is None:
        return
    ttl = ttl_seconds if ttl_seconds is not None else settings.ai_review_cache_ttl_seconds
    try:
        await client.set(name=key, value=json.dumps(value, ensure_ascii=False), ex=max(60, int(ttl)))
    except Exception:
        return


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
