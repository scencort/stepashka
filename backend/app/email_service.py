from __future__ import annotations

import logging
import resend

from app.config import settings

log = logging.getLogger(__name__)


def _client_ready() -> bool:
    return bool(settings.resend_api_key)


def _init():
    resend.api_key = settings.resend_api_key


# ── HTML-шаблон ────────────────────────────────────────────────────────────

def _base_template(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#b91c1c);
                        padding:32px 40px 28px;text-align:center;">
              <div style="font-size:28px;font-weight:900;color:#ffffff;
                          letter-spacing:-0.5px;">Gradus</div>
              <div style="font-size:13px;color:#fca5a5;margin-top:4px;">
                Образовательная платформа
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;">
              {body_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:20px 40px;
                        border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Это письмо отправлено автоматически — отвечать на него не нужно.<br/>
                © 2026 Gradus — учебная платформа
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _code_block(code: str) -> str:
    return f"""
<div style="margin:28px 0;text-align:center;">
  <div style="display:inline-block;background:#f1f5f9;border:2px dashed #cbd5e1;
              border-radius:12px;padding:18px 40px;">
    <span style="font-size:36px;font-weight:900;letter-spacing:10px;
                 color:#0f172a;font-family:monospace;">{code}</span>
  </div>
  <p style="margin:10px 0 0;font-size:13px;color:#94a3b8;">
    Код действителен 30 минут
  </p>
</div>"""


# ── Письмо: сброс пароля ──────────────────────────────────────────────────

async def send_password_reset(to_email: str, to_name: str, code: str) -> bool:
    if not _client_ready():
        log.warning("Resend API key not set — email not sent")
        return False
    _init()

    body = f"""
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">
  Сброс пароля
</h2>
<p style="margin:0 0 20px;font-size:15px;color:#475569;">
  Привет, <strong>{to_name}</strong>! Мы получили запрос на сброс пароля
  для вашего аккаунта на Gradus.
</p>
<p style="margin:0 0 4px;font-size:15px;color:#475569;">
  Введите этот код на странице восстановления пароля:
</p>
{_code_block(code)}
<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
  Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
  Ваш пароль останется прежним.
</p>"""

    try:
        resend.Emails.send({
            "from": settings.email_from,
            "to": [to_email],
            "subject": "Восстановление пароля — Gradus",
            "html": _base_template("Сброс пароля", body),
        })
        log.info("Password reset email sent to %s", to_email)
        return True
    except Exception as e:
        log.error("Failed to send password reset email: %s", e)
        return False


# ── Письмо: подтверждение смены email ─────────────────────────────────────

async def send_email_change(to_email: str, to_name: str, code: str) -> bool:
    if not _client_ready():
        log.warning("Resend API key not set — email not sent")
        return False
    _init()

    body = f"""
<h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;">
  Подтверждение нового email
</h2>
<p style="margin:0 0 20px;font-size:15px;color:#475569;">
  Привет, <strong>{to_name}</strong>! Вы запросили смену email-адреса
  на вашем аккаунте Gradus.
</p>
<p style="margin:0 0 4px;font-size:15px;color:#475569;">
  Для подтверждения введите этот код:
</p>
{_code_block(code)}
<p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
  Если вы не меняли email — немедленно смените пароль в настройках аккаунта.
</p>"""

    try:
        resend.Emails.send({
            "from": settings.email_from,
            "to": [to_email],
            "subject": "Подтверждение нового email — Gradus",
            "html": _base_template("Смена email", body),
        })
        log.info("Email change confirmation sent to %s", to_email)
        return True
    except Exception as e:
        log.error("Failed to send email change email: %s", e)
        return False
