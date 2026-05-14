"""Helpers for TOTP-based two-factor authentication (Google Authenticator)."""

from __future__ import annotations

import base64
import io
from datetime import timedelta
from typing import Any

import pyotp
import qrcode
from jose import jwt, JWTError

from app.config import settings
from app.services import utcnow


TOTP_ISSUER = "Gradus"
TWO_FACTOR_PENDING_TTL_MINUTES = 5


def generate_totp_secret() -> str:
    """Generate a fresh base32 TOTP secret compatible with Google Authenticator."""
    return pyotp.random_base32()


def build_otpauth_uri(secret: str, account_email: str) -> str:
    """Build the otpauth:// URI used by Google Authenticator and similar apps."""
    return pyotp.TOTP(secret).provisioning_uri(
        name=account_email,
        issuer_name=TOTP_ISSUER,
    )


def build_qr_data_uri(uri: str) -> str:
    """Render an otpauth URI as a base64-encoded PNG data URI."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def verify_totp_code(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify a 6-digit TOTP code against the given secret.

    A ``valid_window`` of 1 accepts the previous and next step (±30 seconds),
    which keeps the UX forgiving for users with slight clock drift.
    """
    if not secret or not code:
        return False
    cleaned = code.strip().replace(" ", "")
    if not cleaned.isdigit() or len(cleaned) != 6:
        return False
    try:
        return pyotp.TOTP(secret).verify(cleaned, valid_window=valid_window)
    except Exception:
        return False


def sign_two_factor_pending_token(user_id: int) -> str:
    """Mint a short-lived JWT used between password and TOTP verification."""
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "2fa_pending",
        "exp": utcnow() + timedelta(minutes=TWO_FACTOR_PENDING_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_access_secret, algorithm="HS256")


def verify_two_factor_pending_token(token: str) -> int | None:
    """Decode a pending 2FA token and return the user id (or None)."""
    try:
        payload = jwt.decode(token, settings.jwt_access_secret, algorithms=["HS256"])
    except JWTError:
        return None
    if payload.get("type") != "2fa_pending":
        return None
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None
