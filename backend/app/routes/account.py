from __future__ import annotations

from fastapi import APIRouter, Request

from app import db
from app.deps import CurrentUser
from fastapi import HTTPException

from app.schemas import (
    ProfilePatchBody, ChangePasswordBody, ConfirmEmailBody,
    TwoFactorVerifyBody, TwoFactorDisableBody,
)
from app.services import (
    hash_token, create_reset_code, write_audit,
    get_or_create_profile, utcnow,
    hash_password, verify_password,
)
from app.two_factor import (
    generate_totp_secret, build_otpauth_uri, build_qr_data_uri,
    verify_totp_code, TOTP_ISSUER,
)
from app.config import settings
from app.email_service import send_email_change

router = APIRouter(prefix="/api/account", tags=["account"])


@router.get("/profile")
async def get_profile(user: CurrentUser):
    u = await db.fetchrow(
        """SELECT id, email, full_name AS "fullName", role, avatar_url AS "avatarUrl"
           FROM users WHERE id=$1 LIMIT 1""",
        user["id"],
    )
    if not u:
        return {"error": "Пользователь не найден"}

    p = await get_or_create_profile(user["id"])
    return {
        "id": u["id"],
        "name": u["fullName"],
        "email": u["email"],
        "role": u["role"],
        "avatarUrl": u["avatarUrl"] or "",
        "phone": p["phone"] or "",
        "bio": p["bio"] or "",
        "timezone": p["timezone"] or "Europe/Moscow",
        "language": p["language"] or "ru",
        "emailNotifications": bool(p["email_notifications"]),
        "marketingNotifications": bool(p["marketing_notifications"]),
        "twoFactorEnabled": bool(p["two_factor_enabled"]),
        "pendingEmail": p["pending_email"] or None,
    }


@router.patch("/profile")
async def patch_profile(body: ProfilePatchBody, user: CurrentUser):
    await get_or_create_profile(user["id"])

    # Update users table
    u_updates, u_vals = [], []
    idx = 1
    if body.fullName is not None:
        u_updates.append(f"full_name = ${idx}")
        u_vals.append(body.fullName.strip())
        idx += 1
    if body.avatarUrl is not None:
        u_updates.append(f"avatar_url = ${idx}")
        u_vals.append(body.avatarUrl.strip()[:2_000_000])
        idx += 1
    if u_updates:
        u_vals.append(user["id"])
        await db.execute(
            f"UPDATE users SET {', '.join(u_updates)}, updated_at=NOW() WHERE id=${idx}",
            *u_vals,
        )

    # Update profile table
    p_updates, p_vals = [], []
    pi = 1
    if body.phone is not None:
        p_updates.append(f"phone = ${pi}")
        p_vals.append(body.phone.strip()[:40])
        pi += 1
    if body.bio is not None:
        p_updates.append(f"bio = ${pi}")
        p_vals.append(body.bio.strip()[:280])
        pi += 1
    if body.timezone is not None:
        p_updates.append(f"timezone = ${pi}")
        p_vals.append(body.timezone.strip() or "Europe/Moscow")
        pi += 1
    if body.language is not None:
        p_updates.append(f"language = ${pi}")
        p_vals.append(body.language)
        pi += 1
    if body.emailNotifications is not None:
        p_updates.append(f"email_notifications = ${pi}")
        p_vals.append(body.emailNotifications)
        pi += 1
    if body.marketingNotifications is not None:
        p_updates.append(f"marketing_notifications = ${pi}")
        p_vals.append(body.marketingNotifications)
        pi += 1
    if p_updates:
        p_vals.append(user["id"])
        await db.execute(
            f"UPDATE account_profiles SET {', '.join(p_updates)}, updated_at=NOW() WHERE user_id=${pi}",
            *p_vals,
        )

    email_change_required = False
    dev_email_code = None

    if body.email is not None:
        next_email = body.email.strip().lower()
        current = await db.fetchval("SELECT email FROM users WHERE id=$1 LIMIT 1", user["id"])
        if next_email != current:
            exists = await db.fetchrow("SELECT id FROM users WHERE email=$1 AND id<>$2 LIMIT 1", next_email, user["id"])
            if exists:
                return {"error": "Пользователь с таким email уже существует"}

            code = create_reset_code()
            code_hash = hash_token(code)
            from datetime import timedelta
            expires = utcnow() + timedelta(minutes=10)
            await db.execute(
                """UPDATE account_profiles
                   SET pending_email=$1, pending_email_code_hash=$2, pending_email_expires_at=$3, updated_at=NOW()
                   WHERE user_id=$4""",
                next_email, code_hash, expires, user["id"],
            )
            # Отправляем письмо на новый адрес
            sent = await send_email_change(next_email, user.get("fullName") or user["email"], code)
            if not sent and settings.show_dev_reset_code:
                dev_email_code = code
            email_change_required = True

    await write_audit(user["id"], "account.profile.update", "user", user["id"], {
        "fields": [k for k, v in body.model_dump().items() if v is not None],
        "emailChangeRequired": email_change_required,
    })

    u = await db.fetchrow(
        """SELECT id, email, full_name AS "fullName", role, avatar_url AS "avatarUrl"
           FROM users WHERE id=$1 LIMIT 1""",
        user["id"],
    )
    fp = await get_or_create_profile(user["id"])

    return {
        "id": u["id"],
        "name": u["fullName"],
        "email": u["email"],
        "role": u["role"],
        "avatarUrl": u["avatarUrl"] or "",
        "phone": fp["phone"] or "",
        "bio": fp["bio"] or "",
        "timezone": fp["timezone"] or "Europe/Moscow",
        "language": fp["language"] or "ru",
        "emailNotifications": bool(fp["email_notifications"]),
        "marketingNotifications": bool(fp["marketing_notifications"]),
        "twoFactorEnabled": bool(fp["two_factor_enabled"]),
        "pendingEmail": fp["pending_email"] or None,
        "emailChangeRequired": email_change_required,
        "devEmailCode": dev_email_code,
    }


@router.post("/confirm-email-change")
async def confirm_email_change(body: ConfirmEmailBody, user: CurrentUser):
    profile = await get_or_create_profile(user["id"])
    if not profile["pending_email"] or not profile["pending_email_code_hash"]:
        return {"error": "Нет ожидающей смены email"}

    if profile["pending_email_expires_at"] and profile["pending_email_expires_at"].replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        return {"error": "Код подтверждения истек"}

    if hash_token(body.code) != profile["pending_email_code_hash"]:
        return {"error": "Неверный код подтверждения"}

    exists = await db.fetchrow("SELECT id FROM users WHERE email=$1 AND id<>$2 LIMIT 1", profile["pending_email"], user["id"])
    if exists:
        return {"error": "Пользователь с таким email уже существует"}

    await db.execute("UPDATE users SET email=$1, updated_at=NOW() WHERE id=$2", profile["pending_email"], user["id"])
    await db.execute(
        """UPDATE account_profiles
           SET pending_email=NULL, pending_email_code_hash=NULL, pending_email_expires_at=NULL, updated_at=NOW()
           WHERE user_id=$1""",
        user["id"],
    )
    await write_audit(user["id"], "account.email.confirmed", "user", user["id"])
    return {"success": True, "message": "Email успешно обновлен"}


@router.post("/change-password")
async def change_password(body: ChangePasswordBody, user: CurrentUser):
    if body.newPassword != body.confirmPassword:
        return {"error": "Подтверждение пароля не совпадает"}

    row = await db.fetchrow("SELECT id, password_hash FROM users WHERE id=$1 LIMIT 1", user["id"])
    if not row:
        return {"error": "Пользователь не найден"}

    if not verify_password(body.currentPassword, row["password_hash"]):
        return {"error": "Текущий пароль указан неверно"}

    new_hash = hash_password(body.newPassword)
    await db.execute("UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2", new_hash, user["id"])
    await db.execute("UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL", user["id"])
    await write_audit(user["id"], "account.password.changed", "user", user["id"])
    return {"success": True, "message": "Пароль успешно изменен."}


@router.get("/sessions")
async def get_sessions(request: Request, user: CurrentUser):
    # X-Refresh-Token — фронт передаёт свой текущий refresh token в заголовке
    # хэшируем его и сравниваем с записями в БД чтобы пометить текущую сессию
    current_token = request.headers.get("X-Refresh-Token", "")
    current_hash = hash_token(current_token) if current_token else ""

    rows = await db.fetch(
        """SELECT id, user_agent AS "userAgent", ip_address AS "ipAddress", last_used_at AS "lastUsedAt",
                  expires_at AS "expiresAt", created_at AS "createdAt", token_hash AS "tokenHash"
           FROM refresh_tokens
           WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > NOW()
           ORDER BY created_at DESC""",
        user["id"],
    )
    result = []
    for r in rows:
        row = dict(r)
        row["isCurrent"] = (current_hash != "" and row["tokenHash"] == current_hash)
        del row["tokenHash"]  # не отдаём хэш клиенту — чувствительные данные
        result.append(row)
    return result


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, user: CurrentUser):
    if session_id <= 0:
        return {"error": "Некорректная сессия"}

    revoked = await db.fetchrow(
        """UPDATE refresh_tokens SET revoked_at=NOW()
           WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id""",
        session_id, user["id"],
    )
    if not revoked:
        return {"error": "Сессия не найдена"}

    await write_audit(user["id"], "account.session.revoked", "session", session_id)
    return {"success": True}


@router.post("/logout-all")
async def logout_all(request: Request, user: CurrentUser):
    # keepCurrentRefreshToken — фронт передаёт свой текущий токен
    # исключаем его из отзыва чтобы пользователь не потерял текущую сессию
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    keep_token = body.get("keepCurrentRefreshToken", "")
    if keep_token:
        keep_hash = hash_token(keep_token)
        await db.execute(
            "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL AND token_hash != $2",
            user["id"], keep_hash,
        )
    else:
        await db.execute(
            "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL",
            user["id"],
        )
    await write_audit(user["id"], "account.logout_all", "user", user["id"])
    return {"success": True}


# ---------- Two-factor authentication (TOTP / Google Authenticator) ----------


@router.get("/2fa/status")
async def two_factor_status(user: CurrentUser):
    p = await get_or_create_profile(user["id"])
    return {
        "enabled": bool(p["two_factor_enabled"]),
        "pending": bool(p["two_factor_pending_secret"]),
    }


@router.post("/2fa/setup")
async def two_factor_setup(user: CurrentUser):
    p = await get_or_create_profile(user["id"])
    if p["two_factor_enabled"]:
        raise HTTPException(status_code=400, detail="Двухфакторная аутентификация уже включена")

    u = await db.fetchrow("SELECT email FROM users WHERE id=$1 LIMIT 1", user["id"])
    if not u:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    secret = generate_totp_secret()
    await db.execute(
        """UPDATE account_profiles
           SET two_factor_pending_secret=$1, updated_at=NOW()
           WHERE user_id=$2""",
        secret, user["id"],
    )
    uri = build_otpauth_uri(secret, u["email"])
    qr = build_qr_data_uri(uri)
    await write_audit(user["id"], "account.2fa.setup_started", "user", user["id"])
    return {
        "secret": secret,
        "otpauthUrl": uri,
        "qrCodeDataUrl": qr,
        "issuer": TOTP_ISSUER,
        "accountEmail": u["email"],
    }


@router.post("/2fa/verify")
async def two_factor_verify(body: TwoFactorVerifyBody, user: CurrentUser):
    p = await get_or_create_profile(user["id"])
    if p["two_factor_enabled"]:
        raise HTTPException(status_code=400, detail="Двухфакторная аутентификация уже включена")

    pending = p["two_factor_pending_secret"]
    if not pending:
        raise HTTPException(status_code=400, detail="Сначала начните настройку 2FA")

    if not verify_totp_code(pending, body.code):
        raise HTTPException(status_code=400, detail="Неверный код подтверждения")

    await db.execute(
        """UPDATE account_profiles
           SET two_factor_enabled=TRUE,
               two_factor_secret=$1,
               two_factor_pending_secret=NULL,
               updated_at=NOW()
           WHERE user_id=$2""",
        pending, user["id"],
    )
    await write_audit(user["id"], "account.2fa.enabled", "user", user["id"])
    return {"success": True, "enabled": True}


@router.post("/2fa/disable")
async def two_factor_disable(body: TwoFactorDisableBody, user: CurrentUser):
    p = await get_or_create_profile(user["id"])
    if not p["two_factor_enabled"] or not p["two_factor_secret"]:
        raise HTTPException(status_code=400, detail="Двухфакторная аутентификация не включена")

    row = await db.fetchrow("SELECT password_hash FROM users WHERE id=$1 LIMIT 1", user["id"])
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Неверный пароль")

    if not verify_totp_code(p["two_factor_secret"], body.code):
        raise HTTPException(status_code=400, detail="Неверный код подтверждения")

    await db.execute(
        """UPDATE account_profiles
           SET two_factor_enabled=FALSE,
               two_factor_secret=NULL,
               two_factor_pending_secret=NULL,
               updated_at=NOW()
           WHERE user_id=$1""",
        user["id"],
    )
    await write_audit(user["id"], "account.2fa.disabled", "user", user["id"])
    return {"success": True, "enabled": False}


@router.post("/2fa/cancel")
async def two_factor_cancel(user: CurrentUser):
    await db.execute(
        """UPDATE account_profiles
           SET two_factor_pending_secret=NULL, updated_at=NOW()
           WHERE user_id=$1""",
        user["id"],
    )
    return {"success": True}
