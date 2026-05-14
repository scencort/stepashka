// редактор кода с подсветкой синтаксиса
// архитектура: два слоя в одном контейнере
//   нижний слой — <pre> с подсвеченным кодом (prism-react-renderer), pointer-events:none
//   верхний слой — <textarea> с прозрачным текстом, colour: transparent, caret виден
//   пользователь пишет в textarea, видит подсветку из pre под ней
// синхронизация скролла: при прокрутке textarea → pre и номера строк двигаются синхронно
// тема: читаем useTheme() и переключаем prism-тему (oneDark / github) и цвета фона
//
// props:
//   value — текущий код (управляемый компонент)
//   onChange(value: string) — колбек при вводе, вызывается с новым полным текстом
//   language — строка языка из LANGUAGES константы (Task.tsx), маппится через LANG_MAP
//   placeholder — подсказка когда поле пустое
import { useRef, useCallback, useState, useEffect } from "react"
import { Highlight, themes, type Language } from "prism-react-renderer"
import { useTheme } from "../../context/theme"

type Props = {
  value: string
  onChange: (value: string) => void
  language: string
  placeholder?: string
}

// маппинг строк языка из нашего селекта в идентификаторы prism-react-renderer
// "auto" → "clike" (c-подобный синтаксис как общий fallback)
// "html" → "markup" (prism использует "markup" для html/xml)
// остальные совпадают с именами prism-грамматик один к одному
const LANG_MAP: Record<string, Language> = {
  auto: "clike",
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  csharp: "csharp",
  cpp: "cpp",
  go: "go",
  rust: "rust",
  php: "php",
  ruby: "ruby",
  swift: "swift",
  kotlin: "kotlin",
  sql: "sql",
  html: "markup",
}

export default function CodeEditor({ value, onChange, language, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const { theme } = useTheme()

  const prismLang = LANG_MAP[language] || "clike"
  const lines = value ? value.split("\n") : [""]
  const isDark = theme === "dark"

  // синхронизирует скролл textarea → pre и колонки номеров строк
  // вызывается на событие "scroll" textarea через addEventListener
  // useCallback без зависимостей — функция стабильна, не пересоздаётся
  // без синхронизации: пользователь скроллит код вниз, подсветка остаётся вверху
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = preRef.current
    const ln = lineNumbersRef.current
    if (!ta) return
    // копируем scrollTop и scrollLeft с textarea на подсвеченный pre
    if (pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
    // номера строк скроллятся только вертикально (нет горизонтального скролла)
    if (ln) {
      ln.scrollTop = ta.scrollTop
    }
  }, [])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.addEventListener("scroll", syncScroll)
    return () => ta.removeEventListener("scroll", syncScroll)
  }, [syncScroll])

  const bg = isDark ? "var(--surface)" : "#ffffff"
  const lineNumBg = isDark ? "var(--bg)" : "#f6f8fa"
  const lineNumColor = isDark ? "#6e7681" : "#999"
  const lineNumBorder = isDark ? "#30363d" : "#e2e4e7"
  const prismTheme = isDark ? themes.oneDark : themes.github

  return (
    <div
      className="relative flex overflow-hidden"
      style={{ minHeight: "230px", height: `${Math.max(230, lines.length * 21 + 40)}px` }}
      style={{ background: bg }}
    >
      {/* Line numbers column */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 overflow-hidden select-none pointer-events-none border-r"
        style={{
          width: `${Math.max(lines.length.toString().length, 2) * 10 + 32}px`,
          borderColor: lineNumBorder,
          background: lineNumBg,
        }}
      >
        <div className="h-full py-5 pr-3 text-right">
          {lines.map((_, i) => (
            <div
              key={i}
              className="font-mono text-[13px] leading-[1.625]"
              style={{ color: lineNumColor }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Highlighted code underlay */}
      <div className="relative flex-1 overflow-hidden">
        <Highlight theme={prismTheme} code={value || " "} language={prismLang}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre
              ref={preRef}
              className="absolute inset-0 py-5 pl-5 pr-4 overflow-hidden pointer-events-none font-mono text-[13px] leading-[1.625] whitespace-pre m-0"
              style={{ background: "transparent" }}
            >
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line })
                return (
                  <div key={i} {...lineProps} style={{ ...lineProps.style, background: "transparent" }}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                )
              })}
            </pre>
          )}
        </Highlight>

        {/* Transparent textarea for input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          spellCheck={false}
          className="absolute inset-0 w-full h-full py-5 pl-5 pr-4 font-mono text-[13px] leading-[1.625] bg-transparent text-transparent outline-none resize-none overflow-auto"
          style={{
            caretColor: isDark ? "#e6edf3" : "#1f2328",
            WebkitTextFillColor: isFocused || value ? "transparent" : undefined,
          }}
        />

        {/* Placeholder — заметный, явный */}
        {!value && (
          <div
            className="absolute top-5 left-5 font-mono text-[13px] leading-[1.625] pointer-events-none select-none"
            style={{ color: isDark ? "#484f58" : "#adb5bd" }}
          >
            {placeholder ?? (isDark ? "# вставьте или напишите код..." : "# вставьте или напишите код...")}
          </div>
        )}

      </div>
    </div>
  )
}
