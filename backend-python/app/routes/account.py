from __future__ import annotations

from fastapi import APIRouter

from app import db
from app.deps import CurrentUser
from app.schemas import (
    ProfilePatchBody, ChangePasswordBody, ConfirmEmailBody,
    TwoFactorConfirmBody, TwoFactorDisableBody,
)
from app.services import (
    hash_token, create_reset_code, write_audit,
    get_or_create_profile, utcnow,
    hash_password, verify_password,
)
from app.config import settings

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
            if settings.show_dev_reset_code:
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
async def get_sessions(user: CurrentUser):
    rows = await db.fetch(
        """SELECT id, user_agent AS "userAgent", ip_address AS "ipAddress", last_used_at AS "lastUsedAt",
                  expires_at AS "expiresAt", created_at AS "createdAt"
           FROM refresh_tokens
           WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > NOW()
           ORDER BY created_at DESC""",
        user["id"],
    )
    return [dict(r) for r in rows]


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
async def logout_all(user: CurrentUser):
    await db.execute(
        "UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL",
        user["id"],
    )
    await write_audit(user["id"], "account.logout_all", "user", user["id"])
    return {"success": True}


@router.post("/2fa/request-enable")
async def request_enable_2fa(user: CurrentUser):
    u = await db.fetchrow("SELECT email, full_name FROM users WHERE id=$1 LIMIT 1", user["id"])
    if not u:
        return {"error": "Пользователь не найден"}

    code = create_reset_code()
    code_hash = hash_token(code)
    from datetime import timedelta
    expires = utcnow() + timedelta(minutes=10)
    await db.execute(
        """UPDATE account_profiles
           SET two_factor_temp_code_hash=$1, two_factor_temp_expires_at=$2, updated_at=NOW()
           WHERE user_id=$3""",
        code_hash, expires, user["id"],
    )

    dev_code = code if settings.show_dev_reset_code else None
    return {"success": True, "message": "Код подтверждения отправлен", "devCode": dev_code}


@router.post("/2fa/confirm-enable")
async def confirm_enable_2fa(body: TwoFactorConfirmBody, user: CurrentUser):
    profile = await get_or_create_profile(user["id"])
    if not profile["two_factor_temp_code_hash"]:
        return {"error": "Нет активного запроса на включение 2FA"}

    if profile["two_factor_temp_expires_at"] and profile["two_factor_temp_expires_at"].replace(tzinfo=None) < utcnow().replace(tzinfo=None):
        return {"error": "Код истек"}

    if hash_token(body.code) != profile["two_factor_temp_code_hash"]:
        return {"error": "Неверный код"}

    await db.execute(
        """UPDATE account_profiles
           SET two_factor_enabled=TRUE, two_factor_temp_code_hash=NULL, two_factor_temp_expires_at=NULL, updated_at=NOW()
           WHERE user_id=$1""",
        user["id"],
    )
    await write_audit(user["id"], "account.2fa.enabled", "user", user["id"])
    return {"success": True, "message": "2FA включена"}


@router.post("/2fa/disable")
async def disable_2fa(body: TwoFactorDisableBody, user: CurrentUser):
    u = await db.fetchrow("SELECT password_hash FROM users WHERE id=$1 LIMIT 1", user["id"])
    if not u:
        return {"error": "Пользователь не найден"}

    if not verify_password(body.password, u["password_hash"]):
        return {"error": "Неверный пароль"}

    await db.execute(
        """UPDATE account_profiles
           SET two_factor_enabled=FALSE, two_factor_temp_code_hash=NULL, two_factor_temp_expires_at=NULL, updated_at=NOW()
           WHERE user_id=$1""",
        user["id"],
    )
    await write_audit(user["id"], "account.2fa.disabled", "user", user["id"])
    return {"success": True, "message": "2FA отключена"}
