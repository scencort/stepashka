from __future__ import annotations

import hashlib
import json
import random
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt, JWTError
import bcrypt as _bcrypt

from app.config import settings
from app import db


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return _bcrypt.checkpw(password.encode(), hashed.encode())


# --------------- helpers ---------------

def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_reset_code() -> str:
    return str(random.randint(100000, 999999))


def utcnow() -> datetime:
    return datetime.utcnow()


def sign_access_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "role": user["role"],
        "email": user["email"],
        "fullName": user["full_name"],
        "exp": utcnow() + timedelta(minutes=settings.jwt_access_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_access_secret, algorithm="HS256")


def sign_refresh_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "type": "refresh",
        "exp": utcnow() + timedelta(days=settings.jwt_refresh_days),
    }
    return jwt.encode(payload, settings.jwt_refresh_secret, algorithm="HS256")


def verify_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_access_secret, algorithms=["HS256"])
    except JWTError:
        return None


def verify_refresh_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_refresh_secret, algorithms=["HS256"])
    except JWTError:
        return None


async def store_refresh_token(user_id: int, refresh_token: str, user_agent: str = "", ip_address: str = "") -> None:
    token_hash = hash_token(refresh_token)
    expires_at = utcnow() + timedelta(days=settings.jwt_refresh_days)
    await db.execute(
        """INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, last_used_at, expires_at)
           VALUES ($1, $2, $3, $4, NOW(), $5)""",
        user_id, token_hash, user_agent[:512], ip_address[:128], expires_at,
    )


async def revoke_refresh_token(refresh_token: str) -> None:
    token_hash = hash_token(refresh_token)
    await db.execute(
        "UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL",
        token_hash,
    )


async def write_audit(actor_user_id: int | None, action: str, target_type: str, target_id: Any, details: dict | None = None) -> None:
    await db.execute(
        """INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
           VALUES ($1, $2, $3, $4, $5::jsonb)""",
        actor_user_id, action, target_type, str(target_id), json.dumps(details or {}),
    )


def sanitize_user(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "fullName": row["full_name"],
        "role": row["role"],
        "status": row["status"],
        "avatarUrl": row.get("avatar_url", ""),
    }


async def get_or_create_profile(user_id: int):
    row = await db.fetchrow("SELECT * FROM account_profiles WHERE user_id=$1 LIMIT 1", user_id)
    if row:
        return row
    return await db.fetchrow(
        "INSERT INTO account_profiles (user_id) VALUES ($1) RETURNING *", user_id,
    )


async def create_reset_token_in_db(user_id: int) -> tuple[str, datetime]:
    raw_code = create_reset_code()
    token_hash = hash_token(raw_code)
    expires_at = utcnow() + timedelta(minutes=settings.reset_token_ttl_minutes)

    await db.execute(
        "UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL",
        user_id,
    )
    await db.execute(
        """INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)""",
        user_id, token_hash, expires_at,
    )
    return raw_code, expires_at


# --------------- login challenges (in-memory, same as Node) ---------------

_login_challenges: dict[str, dict] = {}


def create_login_challenge(user_id: int, code: str) -> str:
    challenge_id = str(uuid.uuid4())
    _login_challenges[challenge_id] = {
        "userId": user_id,
        "codeHash": hash_token(code),
        "expiresAt": utcnow() + timedelta(minutes=10),
    }
    return challenge_id


def get_login_challenge(challenge_id: str) -> dict | None:
    return _login_challenges.get(challenge_id)


def delete_login_challenge(challenge_id: str) -> None:
    _login_challenges.pop(challenge_id, None)


# --------------- code evaluation (same heuristics as Node) ---------------

def evaluate_tree_pattern(code: str, levels: list[int] | None = None) -> bool:
    if levels is None:
        levels = [1, 2]
    has_loop = bool(re.search(r"\b(for|while)\b", code))
    has_print = bool(re.search(r"print\s*\(", code))
    has_star = "*" in code
    has_star_mult = bool(re.search(r'(["\']\\*["\']\\s*\\*\\s*\\w+)|(\\*\\s*\\w+\\s*\\))', code, re.I))

    required = ["*" * lv for lv in levels if isinstance(lv, int) and lv > 0]
    has_literal = all(f'"{line}"' in code or f"'{line}'" in code for line in required)

    return has_loop and has_print and has_star and (has_star_mult or has_literal)


def evaluate_code_by_tests(answer: str, tests_raw: list | None) -> dict:
    answer = str(answer or "")
    lowered = answer.lower()
    tests = tests_raw if isinstance(tests_raw, list) else []

    if not tests:
        passed = len(answer.strip()) >= 20
        return {
            "passed": passed,
            "scorePercent": 100 if passed else 0,
            "passedCount": 1 if passed else 0,
            "totalChecks": 1,
            "checkResults": [{"name": "Базовая проверка: длина ответа", "passed": passed}],
            "feedback": "Решение принято: базовая проверка пройдена" if passed else "Добавьте более полное решение: минимум 20 символов",
        }

    failed_checks: list[str] = []
    check_results: list[dict] = []
    passed_count = 0

    for raw_test in tests:
        test = raw_test or {}
        name = str(test.get("name", "Проверка"))
        ttype = str(test.get("type", ""))
        passed = False

        if ttype == "regex":
            try:
                passed = bool(re.search(str(test.get("pattern", "")), answer, re.I))
            except re.error:
                passed = False
        elif ttype == "includesAny":
            tokens = [str(t).lower() for t in (test.get("tokens") or [])]
            passed = any(t and t in lowered for t in tokens)
        elif ttype == "includesAll":
            tokens = [str(t).lower() for t in (test.get("tokens") or [])]
            passed = len(tokens) > 0 and all(t and t in lowered for t in tokens)
        elif ttype == "minCountRegex":
            try:
                pattern = re.compile(str(test.get("pattern", "")), re.I)
                min_count = max(1, int(test.get("min", 1)))
                matches = pattern.findall(answer)
                passed = len(matches) >= min_count
            except (re.error, ValueError):
                passed = False
        elif ttype == "treePattern":
            passed = evaluate_tree_pattern(answer, test.get("levels"))
        else:
            passed = len(answer.strip()) >= 20

        if passed:
            passed_count += 1
        else:
            failed_checks.append(name)

        check_results.append({"name": name, "passed": passed})

    total = len(tests)
    score_percent = round(passed_count / total * 100) if total else 0
    all_passed = passed_count == total

    return {
        "passed": all_passed,
        "scorePercent": score_percent,
        "passedCount": passed_count,
        "totalChecks": total,
        "checkResults": check_results,
        "feedback": (
            f"Решение принято: пройдено {passed_count}/{total} проверок"
            if all_passed
            else f"Не пройдено {len(failed_checks)} из {total} проверок: {', '.join(failed_checks)}"
        ),
    }


def estimate_code_quality(code_text: str, tests_weight: int) -> dict:
    code = (code_text or "").strip()
    complexity_penalty = 15 if len(code.split("\n")) > 120 else 0
    keyword_boost = 10 if re.search(r"class |function |async |await |try|catch", code) else 0

    tests = max(0, min(100, tests_weight + (15 if len(code) > 80 else 0)))
    quality = max(0, min(100, 60 + keyword_boost - complexity_penalty))
    style = max(0, min(100, 50 + (20 if "\n" in code else 0)))
    efficiency = max(0, min(100, 55 + (15 if "map(" in code or "reduce(" in code else 0)))
    plagiarism_score = min(95, 8 + random.randint(0, 19)) if code else 0

    score = round(0.5 * tests + 0.2 * quality + 0.2 * style + 0.1 * efficiency)

    return {
        "score": score,
        "metrics": {"tests": tests, "quality": quality, "style": style, "efficiency": efficiency, "plagiarismScore": plagiarism_score},
        "status": "passed" if score >= 70 else "failed",
        "feedback": "Решение прошло проверку." if score >= 70 else "Решение требует доработки.",
        "hints": [
            "Проверьте обработку пустых входных данных.",
            "Добавьте отдельный тест на невалидный payload.",
            "Упростите ветвления в основном обработчике.",
        ],
    }


def estimate_essay(answer_text: str, rubric: dict | None = None) -> dict:
    text = (answer_text or "").strip()
    relevance = min(30, 24 if len(text) > 80 else 12)
    depth = min(30, 25 if len(text) > 200 else 13)
    clarity = min(20, 16 if "\n" in text else 10)
    practicality = min(20, 16 if re.search(r"пример|метрика|шаг|план", text, re.I) else 9)
    plagiarism_score = min(95, 6 + random.randint(0, 17)) if text else 0
    total = relevance + depth + clarity + practicality

    return {
        "score": total,
        "metrics": {"relevance": relevance, "depth": depth, "clarity": clarity, "practicality": practicality, "rubric": rubric or {}, "plagiarismScore": plagiarism_score},
        "status": "passed" if total >= 70 else "manual_review",
        "feedback": "Ответ содержательный и хорошо структурирован." if total >= 70 else "Ответ частично покрывает задачу.",
        "hints": [
            "Сформулируйте тезис в первом абзаце.",
            "Добавьте минимум один измеримый критерий.",
            "Разделите выводы и рекомендации по пунктам.",
        ],
    }
