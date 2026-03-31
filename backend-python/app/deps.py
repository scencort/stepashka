from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.services import verify_access_token


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация")

    payload = verify_access_token(auth[7:])
    if payload is None:
        raise HTTPException(status_code=401, detail="Сессия недействительна")

    return {
        "id": int(payload["sub"]),
        "role": payload["role"],
        "email": payload["email"],
        "fullName": payload.get("fullName", ""),
    }


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_roles(*roles: str):
    async def _dep(user: CurrentUser) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return _dep


def get_request_meta(request: Request) -> tuple[str, str]:
    ua = (request.headers.get("user-agent") or "")[:512]
    ip = (request.client.host if request.client else "")[:128]
    return ua, ip
