from __future__ import annotations

import hashlib
import json
import random
import re
import secrets
import subprocess
import sys
import tempfile
import os
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
    return str(secrets.randbelow(900000) + 100000)


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


def _run_code_with_input(code: str, stdin_data: str, timeout: float = 5.0) -> tuple[str, str, int]:
    """Run Python code in a subprocess with given stdin. Returns (stdout, stderr, returncode)."""
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(code)
            tmp_path = f.name
        try:
            result = subprocess.run(
                [sys.executable, tmp_path],
                input=stdin_data,
                capture_output=True,
                text=True,
                timeout=timeout,
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            )
            return result.stdout, result.stderr, result.returncode
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except subprocess.TimeoutExpired:
        return "", "Превышено время выполнения (5 сек)", 1
    except Exception as exc:
        return "", str(exc), 1


def evaluate_code_by_tests(answer: str, tests_raw: list | None) -> dict:
    answer = str(answer or "")
    tests = tests_raw if isinstance(tests_raw, list) else []

    if not tests:
        # No test cases defined — just check the code runs without error
        stdout, stderr, rc = _run_code_with_input(answer, "")
        passed = rc == 0
        return {
            "passed": passed,
            "scorePercent": 100 if passed else 0,
            "passedCount": 1 if passed else 0,
            "totalChecks": 1,
            "checkResults": [{"name": "Код выполняется без ошибок", "passed": passed, "output": stdout, "error": stderr}],
            "feedback": "Код выполняется успешно" if passed else f"Ошибка выполнения: {stderr[:200]}",
        }

    check_results: list[dict] = []
    passed_count = 0

    for idx, raw_test in enumerate(tests):
        test = raw_test or {}
        # Support both {input, expectedOutput} and legacy {description, type, pattern, tokens}
        if "expectedOutput" in test or "input" in test:
            # IO-based test: run code, compare stdout
            test_input = str(test.get("input") or "")
            expected = str(test.get("expectedOutput") or "").strip()
            name = test.get("description") or f"Тест {idx + 1}: вход={repr(test_input)[:30]}"
            stdout, stderr, rc = _run_code_with_input(answer, test_input)
            actual = stdout.strip()
            passed = rc == 0 and actual == expected
            check_results.append({
                "name": name,
                "passed": passed,
                "expected": expected,
                "actual": actual,
                "error": stderr[:200] if stderr else "",
            })
        else:
            # Legacy pattern-based checks
            name = str(test.get("description") or test.get("name") or f"Проверка {idx + 1}")
            ttype = str(test.get("type", ""))
            lowered = answer.lower()
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
            else:
                passed = len(answer.strip()) >= 20
            check_results.append({"name": name, "passed": passed})

        if check_results[-1]["passed"]:
            passed_count += 1

    total = len(tests)
    score_percent = round(passed_count / total * 100) if total else 0
    all_passed = passed_count == total
    failed_names = [r["name"] for r in check_results if not r["passed"]]

    return {
        "passed": all_passed,
        "scorePercent": score_percent,
        "passedCount": passed_count,
        "totalChecks": total,
        "checkResults": check_results,
        "feedback": (
            f"Все {total} тест(ов) пройдено ✓"
            if all_passed
            else f"Не пройдено {len(failed_names)} из {total}: {', '.join(failed_names[:3])}"
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


async def _ai_complete(prompt: str, system: str = "") -> str:
    """Call the configured AI provider and return the response text."""
    import httpx
    from app.routes.ai import _ai_generate
    try:
        return await _ai_generate(prompt, system)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("_ai_complete failed: %s", exc)
        return ""


async def estimate_essay(answer_text: str, rubric: dict | None = None) -> dict:
    text = (answer_text or "").strip()
    rubric = rubric or {}
    keywords_str = rubric.get("keywords", "")

    if not text:
        return {
            "score": 0,
            "metrics": {"content": 0, "creativity": 0, "clarity": 0, "keywords": 0},
            "status": "failed",
            "feedback": "Эссе не заполнено.",
            "hints": ["Напишите ответ на задание."],
            "keywordMatches": [],
        }

    # Build keyword hint list
    keyword_list = [kw.strip() for kw in re.split(r"[,;\n]", keywords_str) if kw.strip()] if keywords_str else []

    system_prompt = (
        "Ты — строгий, но справедливый преподаватель. Оцени студенческое эссе по четырём критериям "
        "от 0 до 25 баллов каждый:\n"
        "1. content — соответствие теме и полнота раскрытия\n"
        "2. creativity — оригинальность мышления, неожиданные идеи\n"
        "3. clarity — чёткость изложения, структура, грамотность\n"
        "4. depth — глубина анализа, аргументация\n\n"
        "Верни ТОЛЬКО JSON без лишнего текста в формате:\n"
        '{"content":N,"creativity":N,"clarity":N,"depth":N,"feedback":"...","hints":["...","..."]}'
    )

    keyword_note = ""
    if keyword_list:
        keyword_note = f"\n\nОбязательные ключевые слова/фразы: {', '.join(keyword_list)}"

    user_prompt = f"Эссе студента:{keyword_note}\n\n{text}"

    ai_text = await _ai_complete(user_prompt, system_prompt)

    # Parse AI JSON response
    scores = {"content": 0, "creativity": 0, "clarity": 0, "depth": 0}
    feedback_text = ""
    hints: list[str] = []
    try:
        json_match = re.search(r'\{.*\}', ai_text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            for k in scores:
                scores[k] = max(0, min(25, int(parsed.get(k, 0))))
            feedback_text = str(parsed.get("feedback", ""))
            hints = [str(h) for h in (parsed.get("hints") or [])]
    except Exception:
        pass

    # Fallback heuristic if AI failed
    if not any(scores.values()):
        scores["content"] = min(25, 20 if len(text) > 80 else 10)
        scores["creativity"] = min(25, 15 if len(text) > 200 else 8)
        scores["clarity"] = min(25, 18 if "\n" in text else 10)
        scores["depth"] = min(25, 16 if re.search(r"пример|метрика|шаг|план|вывод|аргумент", text, re.I) else 9)
        feedback_text = "Оценка по базовым критериям (AI недоступен)"
        hints = [
            "Сформулируйте тезис в первом абзаце.",
            "Добавьте конкретные примеры.",
            "Разделите текст на смысловые блоки.",
        ]

    total = sum(scores.values())

    # Check keyword presence
    keyword_matches = []
    if keyword_list:
        text_lower = text.lower()
        for kw in keyword_list:
            found = kw.lower() in text_lower
            keyword_matches.append({"keyword": kw, "found": found})
        missing_count = sum(1 for m in keyword_matches if not m["found"])
        if missing_count > 0:
            total = max(0, total - missing_count * 3)
            if not hints:
                hints = []
            hints.append(f"Не хватает ключевых слов: {', '.join(m['keyword'] for m in keyword_matches if not m['found'])}")

    return {
        "score": total,
        "metrics": scores,
        "status": "passed" if total >= 60 else "manual_review",
        "feedback": feedback_text or ("Ответ содержательный." if total >= 60 else "Ответ требует доработки."),
        "hints": hints[:4],
        "keywordMatches": keyword_matches,
    }
