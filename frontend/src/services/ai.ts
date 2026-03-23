export type AiCheckResult = {
  quality: number
  correctness: number
  style: number
  summary: string
}

export function runMockAiCheck(sourceCode: string): AiCheckResult {
  const code = sourceCode.trim()
  const lengthScore = Math.min(25, Math.floor(code.length / 8))
  const hasFunction = /function|=>/.test(code)
  const hasTypes = /:\s*[A-Za-z]+/.test(code) || /interface\s+[A-Za-z]/.test(code)
  const hasReturn = /return\s+/.test(code)
  const hasCondition = /if\s*\(|switch\s*\(/.test(code)

  const quality = Math.min(98, 55 + lengthScore + (hasTypes ? 12 : 0) + (hasCondition ? 8 : 0))
  const correctness = Math.min(99, 52 + lengthScore + (hasFunction ? 14 : 0) + (hasReturn ? 10 : 0))
  const style = Math.min(97, 50 + Math.floor(lengthScore / 2) + (hasTypes ? 16 : 4))

  const summary =
    code.length < 30
      ? "Решение слишком короткое для уверенной проверки. Добавьте основную логику и обработку edge-case сценариев."
      : hasFunction && hasReturn
        ? "Структура решения хорошая. Рекомендуется добавить тесты на пустой ввод и выровнять naming style."
        : "Логика реализована частично. Добавьте явную функцию, return value и валидацию входных данных."

  return {
    quality,
    correctness,
    style,
    summary,
  }
}
