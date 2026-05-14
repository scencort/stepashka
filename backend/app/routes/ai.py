from __future__ import annotations

import asyncio
import json

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app import db
from app.config import settings
from app.deps import CurrentUser, require_roles
from app.schemas import (
    AiChatBody,
    AiCodeReviewBody,
    AiDailyPlanBody,
    AiFaqBody,
    AiInsightsBody,
)
from app.services import write_audit

router = APIRouter(prefix="/api/ai", tags=["ai"])

AllRoles = Depends(require_roles("student", "teacher", "admin"))


@router.get("/debug/provider", dependencies=[AllRoles])
async def ai_debug_provider(user: CurrentUser):
    provider = (settings.ai_provider or "").strip().lower()
    return {
        "provider": provider,
        "model": _current_model(),
        "openaiBaseUrl": settings.openai_base_url,
        "hasOpenaiKey": bool(settings.openai_api_key),
        "hasGeminiKey": bool(settings.gemini_api_key),
        "hasGroqKey": bool(settings.groq_api_key),
    }


GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


def _chat_fallback(message: str) -> str:
    """Simple keyword-based fallback when Gemini is unavailable."""
    msg = message.lower()
    if "async" in msg and "await" in msg:
        return (
            "**async/await в Python**\n\n"
            "`async def` объявляет корутину — функцию, которая может приостанавливать выполнение.\n\n"
            "`await` используется внутри корутины для ожидания результата другой корутины "
            "без блокировки основного потока.\n\n"
            "```python\nimport asyncio\n\nasync def fetch_data():\n    await asyncio.sleep(1)  # не блокирует\n    return 'данные'\n\nasync def main():\n    result = await fetch_data()\n    print(result)\n\nasyncio.run(main())\n```\n\n"
            "Ключевые моменты:\n"
            "- `asyncio.run()` запускает event loop\n"
            "- `await` можно использовать только внутри `async def`\n"
            "- Для параллельных задач: `asyncio.gather()`"
        )
    if "python" in msg:
        return (
            "Python — высокоуровневый язык программирования с динамической типизацией. "
            "Основные особенности: простой синтаксис, богатая стандартная библиотека, "
            "поддержка ООП и функционального программирования. "
            "Для конкретного вопроса по Python — задайте его подробнее."
        )
    if "javascript" in msg or "js" in msg:
        return (
            "JavaScript — основной язык веб-разработки. Используется как на клиенте (браузер), "
            "так и на сервере (Node.js). Поддерживает async/await, промисы, модули ES6+. "
            "Задайте конкретный вопрос для более подробного ответа."
        )
    if any(w in msg for w in ["помощь", "помоги", "как", "что такое", "объясни"]):
        return (
            "Я AI-ассистент платформы Gradus. Сейчас основная модель Gemini временно "
            "недоступна (квота исчерпана), поэтому мои ответы ограничены. "
            "Попробуйте позже или задайте вопрос по конкретной теме: Python, JavaScript, "
            "веб-разработка, базы данных, алгоритмы."
        )
    return (
        "Сейчас AI-сервис работает в ограниченном режиме (провайдер временно недоступен). "
        "Попробуйте задать вопрос позже или сформулируйте его конкретнее. "
        "Я могу помочь с Python, JavaScript, веб-разработкой и другими IT-темами."
    )


OPENAI_CHAT_PATH = "/chat/completions"


class RateLimitError(Exception):
    """Raised when provider returns HTTP 429 Too Many Requests."""


def _gemini_url(model: str) -> str:
    return f"{GEMINI_BASE}/{model}:generateContent?key={settings.gemini_api_key}"


def _gemini_stream_url(model: str) -> str:
    return f"{GEMINI_BASE}/{model}:streamGenerateContent?alt=sse&key={settings.gemini_api_key}"


async def _openai_compatible_stream(
    *,
    base_url: str,
    api_key: str,
    model: str,
    provider_name: str,
    prompt: str,
    system: str = "",
):
    """Yield SSE chunks from an OpenAI-compatible streaming endpoint."""
    if not api_key:
        raise ValueError(
            f"AI-сервис не настроен. Укажите API key для {provider_name} в .env"
        )

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    url = f"{base_url.rstrip('/')}{OPENAI_CHAT_PATH}"

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 4096,
                "stream": True,
            },
        ) as resp:
            if resp.status_code == 429:
                body = await resp.aread()
                raise RateLimitError(
                    f"{provider_name} rate limit (429): {body.decode()[:200]}"
                )
            if resp.status_code != 200:
                body = await resp.aread()
                raise ValueError(
                    f"{provider_name} API error ({resp.status_code}): {body.decode()[:400]}"
                )
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                delta = (
                    chunk.get("choices", [{}])[0]
                    .get("delta", {})
                    .get("content")
                )
                if delta:
                    yield delta


async def _gemini_stream(prompt: str, system: str = ""):
    """Yield text chunks from Gemini streaming endpoint."""
    if not settings.gemini_api_key:
        raise ValueError("AI-сервис не настроен. Укажите GEMINI_API_KEY в .env")

    contents = []
    if system:
        contents.append(
            {"role": "user", "parts": [{"text": f"[System instruction]: {system}"}]}
        )
        contents.append(
            {
                "role": "model",
                "parts": [{"text": "Understood. I will follow these instructions."}],
            }
        )
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            _gemini_stream_url(settings.gemini_model),
            headers={"Content-Type": "application/json"},
            json={
                "contents": contents,
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
            },
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise ValueError(
                    f"Gemini API error ({resp.status_code}): {body.decode()[:400]}"
                )
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    chunk = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                candidates = chunk.get("candidates", [])
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts", [])
                for p in parts:
                    text = p.get("text", "")
                    if text:
                        yield text


async def _aitunnel_stream(prompt: str, system: str = ""):
    """Fallback: stream via aitunnel (OpenAI-compatible)."""
    async for chunk in _openai_compatible_stream(
        base_url=settings.openai_base_url,
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        provider_name="aitunnel",
        prompt=prompt,
        system=system,
    ):
        yield chunk


async def _ai_stream(prompt: str, system: str = ""):
    """Route to the configured AI provider's streaming endpoint.
    Falls back to aitunnel if Groq returns 429."""
    provider = (settings.ai_provider or "").strip().lower()
    if provider == "groq":
        try:
            async for chunk in _openai_compatible_stream(
                base_url="https://api.groq.com/openai/v1",
                api_key=settings.groq_api_key,
                model=settings.groq_model,
                provider_name="Groq",
                prompt=prompt,
                system=system,
            ):
                yield chunk
        except RateLimitError:
            import logging
            logging.getLogger(__name__).warning("Groq rate limit — switching to aitunnel")
            async for chunk in _aitunnel_stream(prompt, system):
                yield chunk
    elif provider == "openai":
        async for chunk in _openai_compatible_stream(
            base_url=settings.openai_base_url,
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            provider_name="aitunnel",
            prompt=prompt,
            system=system,
        ):
            yield chunk
    else:
        async for chunk in _gemini_stream(prompt, system):
            yield chunk


async def _openai_compatible_generate(
    *,
    base_url: str,
    api_key: str,
    model: str,
    provider_name: str,
    prompt: str,
    system: str = "",
) -> str:
    if not api_key:
        raise ValueError(
            f"AI-сервис не настроен. Укажите API key для {provider_name} в .env"
        )

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    url = f"{base_url.rstrip('/')}{OPENAI_CHAT_PATH}"

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.3,
                "max_tokens": 4096,
            },
        )
        if resp.status_code == 429:
            raise RateLimitError(
                f"{provider_name} rate limit (429): {resp.text[:200]}"
            )
        if resp.status_code != 200:
            raise ValueError(
                f"{provider_name} API error ({resp.status_code}): {resp.text[:400]}"
            )

        data = resp.json()
        choices = data.get("choices", [])
        if not choices:
            raise ValueError(f"{provider_name} не вернул ответ")
        return choices[0].get("message", {}).get("content", "").strip()


async def _groq_generate(prompt: str, system: str = "") -> str:
    return await _openai_compatible_generate(
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        provider_name="Groq",
        prompt=prompt,
        system=system,
    )


async def _openai_generate(prompt: str, system: str = "") -> str:
    return await _openai_compatible_generate(
        base_url=settings.openai_base_url,
        api_key=settings.openai_api_key,
        model=settings.openai_model,
        provider_name="OpenAI-compatible",
        prompt=prompt,
        system=system,
    )


async def _gemini_generate(prompt: str, system: str = "") -> str:
    """Call Gemini API and return text response."""
    if not settings.gemini_api_key:
        raise ValueError("AI-сервис не настроен. Укажите GEMINI_API_KEY в .env")

    contents = []
    if system:
        contents.append(
            {"role": "user", "parts": [{"text": f"[System instruction]: {system}"}]}
        )
        contents.append(
            {
                "role": "model",
                "parts": [{"text": "Understood. I will follow these instructions."}],
            }
        )
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            _gemini_url(settings.gemini_model),
            headers={"Content-Type": "application/json"},
            json={
                "contents": contents,
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
            },
        )
        if resp.status_code != 200:
            raise ValueError(
                f"Gemini API error ({resp.status_code}): {resp.text[:400]}"
            )

        data = resp.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini не вернул ответ")
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts).strip()


async def _ai_generate(prompt: str, system: str = "") -> str:
    """Route to the configured AI provider.
    Falls back to aitunnel if Groq returns 429."""
    provider = (settings.ai_provider or "").strip().lower()
    if provider == "groq":
        try:
            return await _groq_generate(prompt, system)
        except RateLimitError:
            import logging
            logging.getLogger(__name__).warning("Groq rate limit — switching to aitunnel")
            return await _openai_generate(prompt, system)
    if provider == "openai":
        return await _openai_generate(prompt, system)
    return await _gemini_generate(prompt, system)


def _current_model() -> str:
    provider = (settings.ai_provider or "").strip().lower()
    if provider == "groq":
        return f"{settings.groq_model} (fallback: {settings.openai_model})"
    if provider == "openai":
        return settings.openai_model
    return settings.gemini_model


@router.post("/chat", dependencies=[AllRoles])
async def ai_chat(body: AiChatBody, user: CurrentUser):
    model_used = _current_model()
    try:
        context_text = ""
        if body.context:
            for m in body.context[-10:]:
                context_text += f"{m.role}: {m.content}\n"

        prompt = f"{context_text}user: {body.message}" if context_text else body.message
        system = "Ты учебный AI-ассистент платформы Gradus. Отвечай на русском, структурно и практично."

        answer = await _ai_generate(prompt, system)
    except ValueError as exc:
        import logging

        logging.getLogger(__name__).warning("AI chat fallback: %s", exc)
        if _current_model().startswith("accounts/fireworks"):
            answer = (
                "AI-провайдер Fireworks недоступен для текущего ключа: "
                f"{str(exc)[:220]}. "
                "Проверьте billing/лимиты Fireworks или переключитесь на другой провайдер."
            )
        else:
            answer = _chat_fallback(body.message)
        model_used = "fallback"

    await write_audit(
        user["id"],
        "ai.chat.request",
        "user",
        user["id"],
        {
            "promptSize": len(body.message),
            "model": model_used,
        },
    )

    return {"reply": answer, "model": model_used}


@router.post("/chat/stream", dependencies=[AllRoles])
async def ai_chat_stream(body: AiChatBody, user: CurrentUser):
    context_text = ""
    if body.context:
        for m in body.context[-10:]:
            context_text += f"{m.role}: {m.content}\n"

    prompt = f"{context_text}user: {body.message}" if context_text else body.message
    system = "Ты учебный AI-ассистент платформы Gradus. Отвечай на русском, структурно и практично."

    await write_audit(
        user["id"],
        "ai.chat.stream.request",
        "user",
        user["id"],
        {
            "promptSize": len(body.message),
            "model": _current_model(),
        },
    )

    async def generate():
        try:
            async for chunk in _ai_stream(prompt, system):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
        except ValueError:
            fallback = _chat_fallback(body.message)
            yield f"data: {json.dumps({'content': fallback}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/review/check", dependencies=[AllRoles])
async def ai_code_review(body: AiCodeReviewBody, user: CurrentUser):
    lang = body.language if body.language != "auto" else "не указан"
    try:
        system = (
            "Ты опытный старший разработчик и строгий code-reviewer на платформе Gradus. "
            f"Язык программирования: {lang}. "
            "Проанализируй предоставленный код МАКСИМАЛЬНО подробно. "
            "Ответь СТРОГО в JSON формате без markdown, без ```json, только чистый JSON:\n"
            "{\n"
            '  "quality": <число 0-100>,\n'
            '  "correctness": <число 0-100>,\n'
            '  "style": <число 0-100>,\n'
            '  "summary": "<общая оценка, 2-3 предложения>",\n'
            '  "issues": ["<проблема 1>", "<проблема 2>", ...],\n'
            '  "improvements": ["<рекомендация 1>", "<рекомендация 2>", ...],\n'
            '  "goodParts": ["<что хорошо 1>", "<что хорошо 2>", ...]\n'
            "}\n"
            "В issues укажи конкретные баги, уязвимости, проблемы. "
            "В improvements — конкретные предложения с примерами кода, как улучшить. "
            "В goodParts — что сделано хорошо. Всё на русском языке. "
            "Учитывай идиоматику и best-practices конкретного языка."
        )
        raw = await _ai_generate(
            f"Проверь этот код ({lang}):\n\n```{body.language}\n{body.sourceCode}\n```",
            system,
        )

        # Strip markdown fences if present
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

        result = json.loads(cleaned)
        quality = max(0, min(100, int(result.get("quality", 50))))
        correctness = max(0, min(100, int(result.get("correctness", 50))))
        style = max(0, min(100, int(result.get("style", 50))))
        summary = str(result.get("summary", "Нет комментариев"))
        issues = [str(i) for i in result.get("issues", [])][:10]
        improvements = [str(i) for i in result.get("improvements", [])][:10]
        good_parts = [str(i) for i in result.get("goodParts", [])][:10]
    except (ValueError, json.JSONDecodeError, KeyError) as exc:
        # Fallback: heuristic analysis
        lines = body.sourceCode.strip().split("\n")
        quality = min(95, max(20, len(lines) * 3 + 30))
        correctness = min(90, max(25, quality - 5))
        style = min(85, max(20, quality - 10))
        summary = "Не удалось получить AI-анализ. Базовая эвристика: код принят."
        if isinstance(exc, ValueError) and _current_model().startswith(
            "accounts/fireworks"
        ):
            summary = (
                "Fireworks временно недоступен для текущего аккаунта/ключа. "
                "Проверьте billing/лимиты в Fireworks. "
                f"Техническая причина: {str(exc)[:200]}"
            )
        issues = []
        improvements = ["Проверьте форматирование и naming conventions"]
        good_parts = []

    # Save to DB
    try:
        review_id = await db.fetchval(
            """INSERT INTO ai_reviews (user_id, quality, correctness, style, summary, source_code, language, issues, improvements, good_parts)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb) RETURNING id""",
            user["id"],
            quality,
            correctness,
            style,
            summary,
            body.sourceCode,
            body.language,
            json.dumps(issues, ensure_ascii=False),
            json.dumps(improvements, ensure_ascii=False),
            json.dumps(good_parts, ensure_ascii=False),
        )
    except Exception:
        review_id = 0

    await write_audit(
        user["id"],
        "ai.review.check",
        "user",
        user["id"],
        {
            "codeSize": len(body.sourceCode),
            "quality": quality,
        },
    )

    return {
        "id": review_id,
        "quality": quality,
        "correctness": correctness,
        "style": style,
        "summary": summary,
        "issues": issues,
        "improvements": improvements,
        "goodParts": good_parts,
        "language": body.language,
    }


@router.get("/review/history", dependencies=[AllRoles])
async def ai_review_history(user: CurrentUser):
    rows = await db.fetch(
        """SELECT id, quality, correctness, style, summary, source_code AS "sourceCode",
                  language, issues, improvements, good_parts AS "goodParts",
                  created_at AS "createdAt"
           FROM ai_reviews WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20""",
        user["id"],
    )
    result = []
    for r in rows:
        row = dict(r)
        # JSONB fields come as strings or lists depending on asyncpg version
        for field in ("issues", "improvements", "goodParts"):
            val = row.get(field)
            if isinstance(val, str):
                try:
                    row[field] = json.loads(val)
                except Exception:
                    row[field] = []
            elif val is None:
                row[field] = []
        result.append(row)
    return result


@router.post("/insights", dependencies=[AllRoles])
async def ai_insights(body: AiInsightsBody, user: CurrentUser):
    """Generate AI-powered analytics insights based on user's progress data."""
    try:
        system = (
            "Ты аналитик обучения на платформе Gradus. "
            "Ответь СТРОГО в JSON массиве из 3 объектов без markdown, только чистый JSON: "
            '[{"label": "<категория>", "text": "<рекомендация на русском>"}]. '
            "Первый объект — сильная зона ученика, второй — зона риска, третий — конкретный следующий шаг. "
            "Используй данные для персонализации. Будь конкретен и практичен."
        )

        last_value = body.values[-1] if body.values else 0
        first_value = body.values[0] if body.values else 0
        delta = last_value - first_value

        prompt = (
            f"Данные ученика за {body.period}:\n"
            f"- Динамика: {body.values}\n"
            f"- Тренд: {'+' if delta >= 0 else ''}{delta}%\n"
            f"- Текущий балл: {last_value}%\n"
            f"- Средний балл: {body.averageScore}\n"
            f"- Решено задач: {body.solvedTasks}\n"
            f"- Пройдено курсов: {body.completedCourses}\n"
            "Сгенерируй 3 инсайта."
        )

        raw = await _ai_generate(prompt, system)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

        insights = json.loads(cleaned)
        if not isinstance(insights, list) or len(insights) < 3:
            raise ValueError("Invalid insights format")

        result = [
            {
                "label": str(insights[0].get("label", "Сильная зона")),
                "text": str(insights[0].get("text", "")),
            },
            {
                "label": str(insights[1].get("label", "Зона риска")),
                "text": str(insights[1].get("text", "")),
            },
            {
                "label": str(insights[2].get("label", "Следующий шаг")),
                "text": str(insights[2].get("text", "")),
            },
        ]
    except (ValueError, json.JSONDecodeError, KeyError, IndexError):
        last_value = body.values[-1] if body.values else 0
        first_value = body.values[0] if body.values else 0
        delta = last_value - first_value
        goal = 80
        result = [
            {
                "label": "Сильная зона",
                "text": f"Практические шаги: стабильный рост {max(0, delta)}%",
            },
            {
                "label": "Зона риска",
                "text": f"Рекомендуется увеличить регулярность и довести sprint до {goal}%",
            },
            {
                "label": "Следующий шаг",
                "text": "Добавить 2 code-практики и пройти 1 quiz на этой неделе",
            },
        ]

    return {"insights": result}


@router.post("/daily-plan", dependencies=[AllRoles])
async def ai_daily_plan(body: AiDailyPlanBody, user: CurrentUser):
    """Generate AI-powered personalized daily learning plan."""
    try:
        system = (
            "Ты персональный учебный планировщик платформы Gradus. "
            "Ответь СТРОГО в JSON без markdown, только чистый JSON: "
            '{"today": ["<пункт 1>", "<пункт 2>"], "tomorrow": ["<пункт 1>", "<пункт 2>"]}. '
            "Каждый план содержит 2-3 конкретных и коротких пункта на русском языке. "
            "Учитывай прогресс ученика и его текущий шаг."
        )

        step_info = ""
        if body.continueStep:
            step_info = (
                f"- Текущий курс: {body.continueStep.get('courseTitle', 'неизвестен')}\n"
                f"- Текущий шаг: №{body.continueStep.get('stepOrder', '?')} — {body.continueStep.get('stepTitle', '')}\n"
            )
        else:
            step_info = "- Текущих незавершённых шагов нет.\n"

        prompt = (
            f"Данные ученика:\n"
            f"{step_info}"
            f"- Активных курсов: {body.activeCourses}\n"
            f"- Серия дней подряд: {body.streakDays}\n"
            f"- Выполнено за неделю: {body.weeklyCompleted}/{body.weeklyGoal} шагов\n"
            "Составь план на сегодня и завтра."
        )

        raw = await _ai_generate(prompt, system)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()

        plan = json.loads(cleaned)
        today = [str(item) for item in plan.get("today", [])[:3]]
        tomorrow = [str(item) for item in plan.get("tomorrow", [])[:3]]
        if not today or not tomorrow:
            raise ValueError("Empty plan")
    except (ValueError, json.JSONDecodeError, KeyError):
        if body.continueStep:
            step_title = body.continueStep.get("stepTitle", "текущий шаг")
            step_order = body.continueStep.get("stepOrder", "?")
            today = [
                f"Шаг {step_order}: {step_title}",
                "Повторить 1 прошлую ошибку по коду",
            ]
            tomorrow = [
                "Закрыть ещё 1 шаг после текущего",
                "Проверить обсуждение и задать вопрос",
            ]
        else:
            today = [
                "Выберите новый курс из каталога",
                "Сделайте 1 шаг для поддержания серии",
            ]
            tomorrow = [
                "Соберите персональный трек из 1-2 курсов",
                "Поставьте реальную недельную цель",
            ]

    return {"today": today, "tomorrow": tomorrow}


@router.post("/faq", dependencies=[AllRoles])
async def ai_faq(body: AiFaqBody, user: CurrentUser):
    """Answer FAQ questions using Gemini AI."""
    try:
        system = (
            "Ты бот справочного центра платформы Gradus — онлайн-платформы для обучения IT. "
            "Отвечай на русском языке. Давай точные, полезные и краткие ответы. "
            "Если вопрос не связан с платформой, вежливо перенаправь к теме обучения."
        )

        answer = await _ai_generate(body.question, system)
    except ValueError:
        answer = (
            "К сожалению, сейчас не удалось получить ответ от AI. "
            "Попробуйте позже или свяжитесь с поддержкой через email."
        )

    return {"answer": answer}
