from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app import db
from app.deps import CurrentUser, get_request_meta
from app.schemas import (
    RegisterBody, LoginBody, ForgotPasswordBody, ResetPasswordBody,
    TwoFactorVerifyBody, RefreshBody, LogoutBody,
)
from app.services import (
    hash_token, create_reset_code, create_reset_token_in_db,
    sign_access_token, sign_refresh_token, verify_refresh_token,
    store_refresh_token, revoke_refresh_token,
    write_audit, sanitize_user,
    create_login_challenge, get_login_challenge, delete_login_challenge,
    hash_password, verify_password,
)
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(body: RegisterBody, request: Request):
    email = body.email.strip().lower()
    exists = await db.fetchrow("SELECT id FROM users WHERE email=$1 LIMIT 1", email)
    if exists:
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")

    password_hash = hash_password(body.password)

    user = await db.fetchrow(
        """INSERT INTO users (email, password_hash, full_name, role)
           VALUES ($1, $2, $3, 'student')
           RETURNING id, email, full_name, role, status, avatar_url""",
        email, password_hash, body.fullName.strip(),
    )

    ua, ip = get_request_meta(request)
    access = sign_access_token(dict(user))
    refresh = sign_refresh_token(dict(user))
    await store_refresh_token(user["id"], refresh, ua, ip)
    await write_audit(user["id"], "user.register", "user", user["id"], {"email": email})

    return {"user": sanitize_user(user), "accessToken": access, "refreshToken": refresh}


@router.post("/login")
async def login(body: LoginBody, request: Request):
    email = body.email.strip().lower()
    user = await db.fetchrow(
        "SELECT id, email, password_hash, full_name, role, status, avatar_url FROM users WHERE email=$1 LIMIT 1",
        email,
    )

    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if user["status"] == "banned":
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован")

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    profile = await db.fetchrow(
        "SELECT two_factor_enabled FROM account_profiles WHERE user_id=$1 LIMIT 1",
        user["id"],
    )
    two_factor = bool(profile and profile["two_factor_enabled"])

    if two_factor:
        code = create_reset_code()
        challenge_id = create_login_challenge(user["id"], code)

        dev_code = code if settings.show_dev_reset_code else None
        return {
            "requiresTwoFactor": True,
            "challengeId": challenge_id,
            "message": "Требуется подтверждение 2FA",
            "devCode": dev_code,
        }

    ua, ip = get_request_meta(request)
    access = sign_access_token(dict(user))
    refresh = sign_refresh_token(dict(user))
    await store_refresh_token(user["id"], refresh, ua, ip)
    await write_audit(user["id"], "auth.login", "user", user["id"])

    return {"user": sanitize_user(user), "accessToken": access, "refreshToken": refresh}


@router.post("/2fa/verify")
async def verify_2fa(body: TwoFactorVerifyBody, request: Request):
    challenge = get_login_challenge(body.challengeId)
    if not challenge:
        return {"error": "Challenge не найден или истек"}

    from app.services import utcnow
    if utcnow() > challenge["expiresAt"]:
        delete_login_challenge(body.challengeId)
        return {"error": "Код 2FA истек"}

    if hash_token(body.code) != challenge["codeHash"]:
        return {"error": "Неверный код 2FA"}

    user = await db.fetchrow(
        "SELECT id, email, full_name, role, status, avatar_url FROM users WHERE id=$1 LIMIT 1",
        challenge["userId"],
    )
    if not user or user["status"] != "active":
        delete_login_challenge(body.challengeId)
        return {"error": "Пользователь недоступен"}

    ua, ip = get_request_meta(request)
    access = sign_access_token(dict(user))
    refresh = sign_refresh_token(dict(user))
    await store_refresh_token(user["id"], refresh, ua, ip)
    await write_audit(user["id"], "auth.login.2fa", "user", user["id"])
    delete_login_challenge(body.challengeId)

    return {"user": sanitize_user(user), "accessToken": access, "refreshToken": refresh}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    email = body.email.strip().lower()
    neutral = {
        "success": True,
        "message": "Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля.",
    }

    user = await db.fetchrow(
        "SELECT id, email, full_name, status FROM users WHERE email=$1 LIMIT 1",
        email,
    )
    if not user or user["status"] != "active":
        return neutral

    raw_code, _ = await create_reset_token_in_db(user["id"])
    await write_audit(None, "auth.password_reset_requested", "user", user["id"], {"email": email})

    if settings.show_dev_reset_code:
        return {**neutral, "devCode": raw_code, "devMode": True}

    return neutral


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody):
    email = body.email.strip().lower()

    user = await db.fetchrow(
        "SELECT id, email, full_name, status FROM users WHERE email=$1 LIMIT 1",
        email,
    )
    if not user or user["status"] != "active":
        return {"error": "Неверный код или email"}

    token_hash = hash_token(body.code)
    token_row = await db.fetchrow(
        """SELECT id, user_id, expires_at, used_at, token_hash
           FROM password_reset_tokens
           WHERE user_id=$1 AND used_at IS NULL
           ORDER BY created_at DESC LIMIT 1""",
        user["id"],
    )
    if not token_row:
        return {"error": "Неверный код или email"}

    if token_row["token_hash"] != token_hash:
        return {"error": "Неверный код или email"}

    from app.services import utcnow
    if token_row["expires_at"].replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        return {"error": "Срок действия кода истёк"}

    password_hash = hash_password(body.password)
    await db.execute("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", password_hash, token_row["user_id"])
    await db.execute("UPDATE password_reset_tokens SET used_at=NOW() WHERE id=$1", token_row["id"])
    await db.execute("UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", token_row["user_id"])
    await write_audit(token_row["user_id"], "auth.password_reset_completed", "user", token_row["user_id"])

    return {"success": True, "message": "Пароль успешно обновлён"}


@router.post("/refresh")
async def refresh(body: RefreshBody, request: Request):
    payload = verify_refresh_token(body.refreshToken)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Невалидный refresh токен")

    token_hash = hash_token(body.refreshToken)
    token_db = await db.fetchrow(
        "SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash=$1 LIMIT 1",
        token_hash,
    )
    if not token_db:
        raise HTTPException(status_code=401, detail="Refresh токен не найден")
    if token_db["revoked_at"]:
        raise HTTPException(status_code=401, detail="Refresh токен отозван")

    from app.services import utcnow
    if token_db["expires_at"].replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        raise HTTPException(status_code=401, detail="Refresh токен истёк")

    ua, ip = get_request_meta(request)
    await db.execute(
        "UPDATE refresh_tokens SET last_used_at=NOW(), user_agent=$1, ip_address=$2 WHERE id=$3",
        ua, ip, token_db["id"],
    )

    user = await db.fetchrow(
        "SELECT id, email, full_name, role, status, avatar_url FROM users WHERE id=$1 LIMIT 1",
        token_db["user_id"],
    )
    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="Пользователь недоступен")

    await revoke_refresh_token(body.refreshToken)
    new_access = sign_access_token(dict(user))
    new_refresh = sign_refresh_token(dict(user))
    await store_refresh_token(user["id"], new_refresh, ua, ip)

    return {"user": sanitize_user(user), "accessToken": new_access, "refreshToken": new_refresh}


@router.post("/logout")
async def logout(body: LogoutBody, user: CurrentUser):
    if body.refreshToken:
        await revoke_refresh_token(body.refreshToken)
    await write_audit(user["id"], "auth.logout", "user", user["id"])
    return {"success": True}


@router.get("/me")
async def me(user: CurrentUser):
    row = await db.fetchrow(
        "SELECT id, email, full_name, role, status, avatar_url FROM users WHERE id=$1 LIMIT 1",
        user["id"],
    )
    if not row:
        return {"error": "Пользователь не найден"}
    return sanitize_user(row)
