# Интеллектуальная проверка заданий

## 1. Типы проверок
- code: автотесты + quality анализ + plagiarism
- essay: rubric scoring + NLP-сигналы + plagiarism
- quiz: быстрая проверка корректности

## 2. Формула оценки кода
Score = 0.5 * Tests + 0.2 * Quality + 0.2 * Style + 0.1 * Efficiency

## 3. Формула оценки эссе
Score = Relevance + Depth + Clarity + Practicality

## 4. Антиплагиат
- plagiarism_score от 0 до 100
- высокий риск (>=70) отправляет на manual_review

## 5. Подсказки
Возвращаются безопасные hints:
- не раскрывают готовый ответ
- фокус на граничных кейсах и улучшении структуры

## 6. API
- POST /api/submissions/:assignmentId
- GET /api/submissions/history
