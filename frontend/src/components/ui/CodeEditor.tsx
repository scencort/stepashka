import { useRef, useCallback, useState, useEffect } from "react"
import { Highlight, themes, type Language } from "prism-react-renderer"

type Props = {
  value: string
  onChange: (value: string) => void
  language: string
  placeholder?: string
}

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

  const prismLang = LANG_MAP[language] || "clike"
  const lines = value ? value.split("\n") : [""]

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    const pre = preRef.current
    const ln = lineNumbersRef.current
    if (!ta) return
    if (pre) {
      pre.scrollTop = ta.scrollTop
      pre.scrollLeft = ta.scrollLeft
    }
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

  return (
    <div className="relative flex h-[360px] md:h-[520px] overflow-hidden bg-[#1a1a2e]">
      {/* Line numbers */}
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 overflow-hidden select-none pointer-events-none"
        style={{ width: `${Math.max(lines.length.toString().length, 2) * 10 + 24}px` }}
      >
        <div className="h-full py-4 pr-2 text-right">
          {lines.map((_, i) => (
            <div
              key={i}
              className="text-[13px] leading-[1.5] font-mono text-slate-500/70"
              style={{ height: "1.5em" }}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Highlighted code underlay */}
      <div className="relative flex-1 overflow-hidden">
        <Highlight theme={themes.dracula} code={value || " "} language={prismLang}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre
              ref={preRef}
              className="absolute inset-0 py-4 pl-2 pr-4 overflow-hidden pointer-events-none font-mono text-[13px] leading-[1.5] whitespace-pre m-0"
              style={{ background: "transparent" }}
            >
              {tokens.map((line, i) => {
                const lineProps = getLineProps({ line })
                return (
                  <div key={i} {...lineProps} style={{ ...lineProps.style, height: "1.5em", background: "transparent" }}>
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
          className="absolute inset-0 w-full h-full py-4 pl-2 pr-4 font-mono text-[13px] leading-[1.5] bg-transparent text-transparent caret-rose-400 outline-none resize-none selection:bg-rose-500/25 overflow-auto"
          placeholder={placeholder}
          style={{ WebkitTextFillColor: isFocused || value ? "transparent" : undefined }}
        />

        {/* Placeholder */}
        {!value && !isFocused && (
          <div className="absolute top-4 left-2 font-mono text-[13px] text-slate-500/50 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}
