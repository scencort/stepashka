import MainLayout from "../layout/MainLayout"
import { useEffect, useState } from "react"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import CodeEditor from "../components/ui/CodeEditor"
import { motion, AnimatePresence } from "framer-motion"
import { Code2, Sparkles, CheckCircle, AlertTriangle, Lightbulb, ThumbsUp } from "lucide-react"
import { api } from "../lib/api"
import EmptyState from "../components/ui/EmptyState"
import { useToast } from "../hooks/useToast"

import { fadeInUp } from "../lib/animations"

const LANGUAGES = [
  { value: "auto", label: "Авто-определение" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML/CSS" },
]

type CheckResult = {
  quality: number
  correctness: number
  style: number
  summary: string
  issues?: string[]
  improvements?: string[]
  goodParts?: string[]
  language?: string
}

export default function Task() {
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState("auto")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState("")
  const [history, setHistory] = useState<Array<CheckResult & { id: number; createdAt: string }>>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const toast = useToast()

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const data = await api.get<Array<CheckResult & { id: number; createdAt: string }>>("/ai-review/history")
      setHistory(data)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const handleCheck = async () => {
    if (!code.trim()) return
    setLoading(true)
    setResult(null)
    setError("")

    try {
      const data = await api.post<CheckResult>("/ai-review/check", {
        sourceCode: code,
        language,
      })
      setResult(data)
      toast.success("Ревью завершено")
      await loadHistory()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Проверка не удалась"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const avgScore = result ? Math.round((result.quality + result.correctness + result.style) / 3) : 0
  const scoreColor = avgScore >= 80 ? "text-emerald-600" : avgScore >= 50 ? "text-amber-600" : "text-red-600"

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-2xl md:text-3xl font-bold">AI Code Review</h2>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-xl glass-input px-3 py-2 text-sm w-full sm:w-auto"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Editor */}
          <div className="xl:col-span-2 rounded-2xl overflow-hidden glass-panel">
            <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold inline-flex items-center gap-2">
                <Code2 size={16} /> Ваш код
              </h3>
              <p className="text-xs text-slate-500">
                {LANGUAGES.find((l) => l.value === language)?.label || language}
              </p>
            </div>

            <CodeEditor
              value={code}
              onChange={setCode}
              language={language}
              placeholder="// вставьте код для ревью..."
            />
          </div>

          {/* Side panel */}
          <div className="space-y-4">

            <Button onClick={handleCheck} disabled={loading || !code.trim()} className="w-full">
              {loading ? "Анализирую..." : "Запустить ревью"}
            </Button>

            {loading && (
              <Card>
                <p className="text-slate-500 text-sm inline-flex items-center gap-2">
                  <Sparkles size={14} className="animate-pulse" /> AI анализирует код...
                </p>
              </Card>
            )}

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Scores */}
                  <Card className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Общая оценка</p>
                      <p className={`text-2xl font-bold ${scoreColor}`}>{avgScore}%</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Качество", value: result.quality },
                        { label: "Корректность", value: result.correctness },
                        { label: "Стиль", value: result.style },
                      ].map((m) => (
                        <div key={m.label} className="text-center">
                          <p className="text-lg font-bold">{m.value}%</p>
                          <p className="text-[10px] text-slate-500">{m.label}</p>
                          <progress
                            value={m.value}
                            max={100}
                            className="w-full h-1.5 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600"
                          />
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Summary */}
                  <Card>
                    <p className="text-sm font-semibold mb-1 inline-flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-blue-500" /> Резюме
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{result.summary}</p>
                  </Card>

                  {/* Issues */}
                  {result.issues && result.issues.length > 0 && (
                    <Card className="space-y-2">
                      <p className="text-sm font-semibold inline-flex items-center gap-1.5 text-red-700 dark:text-red-300">
                        <AlertTriangle size={14} /> Проблемы ({result.issues.length})
                      </p>
                      {result.issues.map((issue, i) => (
                        <p key={i} className="text-sm text-slate-700 dark:text-slate-200 pl-5">• {issue}</p>
                      ))}
                    </Card>
                  )}

                  {/* Improvements */}
                  {result.improvements && result.improvements.length > 0 && (
                    <Card className="space-y-2">
                      <p className="text-sm font-semibold inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                        <Lightbulb size={14} /> Рекомендации ({result.improvements.length})
                      </p>
                      {result.improvements.map((item, i) => (
                        <p key={i} className="text-sm text-slate-700 dark:text-slate-200 pl-5">• {item}</p>
                      ))}
                    </Card>
                  )}

                  {/* Good parts */}
                  {result.goodParts && result.goodParts.length > 0 && (
                    <Card className="space-y-2">
                      <p className="text-sm font-semibold inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <ThumbsUp size={14} /> Что хорошо ({result.goodParts.length})
                      </p>
                      {result.goodParts.map((item, i) => (
                        <p key={i} className="text-sm text-slate-700 dark:text-slate-200 pl-5">• {item}</p>
                      ))}
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {!loading && error && (
              <Card><p className="text-sm text-red-700 dark:text-red-300">{error}</p></Card>
            )}

            {!result && !loading && !error && (
              <Card>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Вставьте код, выберите язык и запустите ревью. AI проанализирует качество, найдёт баги и предложит улучшения.
                </p>
              </Card>
            )}

            {/* History */}
            <Card className="space-y-2">
              <h5 className="font-semibold">История ревью</h5>
              {historyLoading && <p className="text-sm text-slate-500">Загрузка...</p>}
              {!historyLoading && history.length === 0 && (
                <EmptyState title="Пусто" description="Отправьте первый код на ревью." />
              )}
              {!historyLoading && history.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {history.map((item) => {
                    const avg = Math.round((item.quality + item.correctness + item.style) / 3)
                    return (
                      <div key={item.id} className="rounded-xl glass-panel p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{avg}%</p>
                          <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("ru-RU")}</p>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Q:{item.quality} C:{item.correctness} S:{item.style}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

          </div>
        </div>
      </motion.div>
    </MainLayout>
  )
}