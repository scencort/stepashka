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
                input=stdin_data.encode("utf-8", errors="replace"),
                capture_output=True,
                timeout=timeout,
                env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"},
            )
            stdout = result.stdout.decode("utf-8", errors="replace")
            stderr = result.stderr.decode("utf-8", errors="replace")
            return stdout, stderr, result.returncode
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except subprocess.TimeoutExpired:
        return "", "Превышено время выполнения (5 сек)", 1
    except Exception as exc:
        return "", str(exc), 1


_ERROR_MAP = [
    ("SyntaxError:",        "Синтаксическая ошибка:"),
    ("NameError:",          "Имя не определено:"),
    ("IndentationError:",   "Ошибка отступа:"),
    ("ModuleNotFoundError:","Модуль не найден:"),
    ("TypeError:",          "Ошибка типа:"),
    ("AttributeError:",     "Атрибут не найден:"),
    ("ValueError:",         "Ошибка значения:"),
    ("ZeroDivisionError:",  "Деление на ноль:"),
    ("IndexError:",         "Индекс за пределами:"),
    ("KeyError:",           "Ключ не найден:"),
    ("RecursionError:",     "Слишком глубокая рекурсия:"),
    ("RuntimeError:",       "Ошибка выполнения:"),
    ("ImportError:",        "Ошибка импорта:"),
]


def _format_python_error(stderr: str) -> str:
    """Turn Python traceback into a clean, readable error message."""
    lines = stderr.strip().splitlines()
    if not lines:
        return "Неизвестная ошибка"

    # Find the last 'File "...", line N' in the traceback (the user's code, not stdlib)
    last_file_idx = -1
    for i, line in enumerate(lines):
        if re.match(r'\s*File ".*", line \d+', line):
            last_file_idx = i

    parts: list[str] = []

    if last_file_idx >= 0:
        # Extract line number
        m = re.search(r'line (\d+)', lines[last_file_idx])
        if m:
            parts.append(f"Строка {m.group(1)}:")
        # Next line is the actual code (if present and not another File/Error line)
        code_idx = last_file_idx + 1
        if code_idx < len(lines) and not re.match(r'\s*File "|^\w.*Error:', lines[code_idx]):
            code_text = lines[code_idx].rstrip()
            parts.append(f"  {code_text}")
            # Caret pointer?
            ptr_idx = code_idx + 1
            if ptr_idx < len(lines) and re.match(r'[\s~^]+$', lines[ptr_idx].strip()):
                parts.append(f"  {lines[ptr_idx].rstrip()}")

    # Last line = the error itself
    error_line = lines[-1]
    for en, ru in _ERROR_MAP:
        if en in error_line:
            error_line = error_line.replace(en, ru, 1)
            break

    parts.append(error_line)
    return "\n".join(parts)


def evaluate_code_by_tests(answer: str, tests_raw: list | None) -> dict:
    answer = str(answer or "")
    tests = tests_raw if isinstance(tests_raw, list) else []

    # Determine if any test is IO-based (will run code itself)
    # Note: outputLineCount/outputContainsLine also have "input" but are NOT IO-comparison tests
    _io_types = {"outputLineCount", "outputContainsLine", "regex", "includesAny", "includesAll", "minCountRegex"}
    has_io = any(("expectedOutput" in t or ("input" in t and t.get("type") not in _io_types)) for t in tests)

    # For pattern-only tests: ALWAYS run code first.
    # If it crashes → fail all checks immediately.
    if not has_io:
        _, run_stderr, run_rc = _run_code_with_input(answer, "")
        if run_rc != 0:
            err_detail = _format_python_error(run_stderr)
            failed_results = [{"name": t.get("description") or t.get("name") or f"Проверка {i+1}", "passed": False}
                              for i, t in enumerate(tests)] if tests else \
                             [{"name": "Код выполняется без ошибок", "passed": False}]
            return {
                "passed": False,
                "scorePercent": 0,
                "passedCount": 0,
                "totalChecks": len(failed_results),
                "checkResults": failed_results,
                "feedback": err_detail,
            }

    if not tests:
        stdout, stderr, rc = _run_code_with_input(answer, "")
        passed = rc == 0
        return {
            "passed": passed,
            "scorePercent": 100 if passed else 0,
            "passedCount": 1 if passed else 0,
            "totalChecks": 1,
            "checkResults": [{"name": "Код выполняется без ошибок", "passed": passed, "error": stderr[:200] if stderr else ""}],
            "feedback": "Код выполняется успешно" if passed else f"Ошибка выполнения: {stderr[:200]}",
        }

    check_results: list[dict] = []
    passed_count = 0

    for idx, raw_test in enumerate(tests):
        test = raw_test or {}
        if "expectedOutput" in test or ("input" in test and test.get("type") not in _io_types):
            # IO-based test: run code, compare stdout
            test_input = str(test.get("input") or "")
            expected = str(test.get("expectedOutput") or "").strip()
            name = test.get("description") or f"Тест {idx + 1}"
            stdout, stderr, rc = _run_code_with_input(answer, test_input)

            # Smart comparison: input("prompt") writes prompts to stdout,
            # so we check if ALL expected lines appear in actual output
            # as a subsequence (ignoring prompt lines in between).
            actual_lines = [l.rstrip() for l in stdout.split("\n")]
            expected_lines = [l.rstrip() for l in expected.split("\n") if l.rstrip()]

            def _is_subsequence(needle: list[str], haystack: list[str]) -> bool:
                it = iter(haystack)
                return all(line in it for line in needle)

            # First try exact match (fastest); then subsequence match for input()-prompts
            actual_stripped = stdout.strip()
            if rc == 0 and actual_stripped == expected:
                ok = True
            elif rc == 0 and expected_lines and _is_subsequence(expected_lines, actual_lines):
                ok = True
            else:
                ok = False

            err_msg = _format_python_error(stderr) if stderr and rc != 0 else ""
            # Show actual without prompt noise: keep only lines that are NOT
            # a prefix of any stdin value (best-effort cleanup for display)
            stdin_values = {v.strip() for v in test_input.split("\n") if v.strip()}
            display_actual_lines = [
                l for l in actual_lines
                if not any(l.endswith(v) or l.endswith(v + " ") for v in stdin_values)
                   and l.rstrip() not in {""}
            ] if stdin_values else actual_lines
            display_actual = "\n".join(display_actual_lines).strip() or actual_stripped

            check_results.append({
                "name": name,
                "passed": ok,
                "expected": expected,
                "actual": display_actual,
                "error": err_msg,
            })
        else:
            # Pattern-based or output-based (code already passed execution check above)
            name = str(test.get("description") or test.get("name") or f"Проверка {idx + 1}")
            ttype = str(test.get("type", ""))
            lowered = answer.lower()
            ok = False
            if ttype == "regex":
                try:
                    ok = bool(re.search(str(test.get("pattern", "")), answer, re.I | re.MULTILINE))
                except re.error:
                    ok = False
            elif ttype == "includesAny":
                tokens = [str(t).lower() for t in (test.get("tokens") or [])]
                ok = any(t and t in lowered for t in tokens)
            elif ttype == "includesAll":
                raw_tokens = test.get("tokens") or []
                if isinstance(raw_tokens, str):
                    raw_tokens = [t.strip() for t in raw_tokens.split(",") if t.strip()]
                tokens = [str(t).lower() for t in raw_tokens]
                ok = len(tokens) > 0 and all(t and t in lowered for t in tokens)
            elif ttype == "minCountRegex":
                try:
                    matches = re.findall(str(test.get("pattern", "")), answer, re.I | re.MULTILINE)
                    ok = len(matches) >= int(test.get("min", 1))
                except (re.error, ValueError):
                    ok = False
            elif ttype == "outputContainsLine":
                # Run code, check stdout has at least one line matching the pattern
                _inp = str(test.get("input") or "")
                _stdout, _stderr, _rc = _run_code_with_input(answer, _inp)
                if _rc != 0:
                    ok = False
                else:
                    _pat = str(test.get("pattern", ""))
                    _lines = [l.rstrip() for l in _stdout.split("\n")]
                    try:
                        ok = any(re.fullmatch(_pat, line) for line in _lines if line)
                    except re.error:
                        ok = False
            elif ttype == "outputLineCount":
                # Run code, check stdout has >= min non-empty lines
                _inp = str(test.get("input") or "")
                _stdout, _stderr, _rc = _run_code_with_input(answer, _inp)
                _min = int(test.get("min", 1))
                if _rc != 0:
                    ok = False
                    check_results.append({"name": name, "passed": False, "error": _format_python_error(_stderr)})
                else:
                    _non_empty = [l for l in _stdout.split("\n") if l.strip()]
                    ok = len(_non_empty) >= _min
                    check_results.append({
                        "name": name,
                        "passed": ok,
                        "expected": f"минимум {_min} строк",
                        "actual": f"{len(_non_empty)} строк: {_stdout.strip()[:200]}",
                    })
                if check_results[-1]["passed"]:
                    passed_count += 1
                continue
            else:
                ok = len(answer.strip()) >= 20
            check_results.append({"name": name, "passed": ok})

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


def estimate_essay(answer_text: str, rubric: dict | None = None) -> dict:
    """Проверяет эссе только по ключевым словам — без баллов и AI.
    Возвращает passed=True если все обязательные слова найдены (или их нет вовсе).
    """
    text = (answer_text or "").strip()
    rubric = rubric or {}
    keywords_str = rubric.get("keywords", "")

    if not text:
        return {"passed": False, "feedback": "Эссе не заполнено.", "missingKeywords": []}

    keyword_list = [kw.strip() for kw in re.split(r"[,;\n]", keywords_str) if kw.strip()] if keywords_str else []

    # Если ключевых слов нет — любой непустой ответ засчитывается
    if not keyword_list:
        return {"passed": True, "feedback": "Верно", "missingKeywords": []}

    text_lower = text.lower()
    missing = [kw for kw in keyword_list if kw.lower() not in text_lower]

    if missing:
        hint = "Не найдены обязательные слова: " + ", ".join(f'«{w}»' for w in missing)
        return {"passed": False, "feedback": hint, "missingKeywords": missing}

    return {"passed": True, "feedback": "Верно", "missingKeywords": []}
