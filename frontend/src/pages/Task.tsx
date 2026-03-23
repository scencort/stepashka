import MainLayout from "../layout/MainLayout"
import { useEffect, useState } from "react"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import { motion } from "framer-motion"
import { Code2, Sparkles } from "lucide-react"
import { api } from "../lib/api"
import EmptyState from "../components/ui/EmptyState"
import { useToast } from "../hooks/useToast"

import { fadeInUp } from "../lib/animations"

type CheckResult = {
  quality: number
  correctness: number
  style: number
  summary: string
}

export default function Task() {
  const [code, setCode] = useState("")
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
    setLoading(true)
    setResult(null)
    setError("")

    try {
      const data = await api.post<CheckResult>("/ai-review/check", {
        sourceCode: code,
      })
      setResult(data)
      toast.success("Проверка завершена")
      await loadHistory()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Проверка не удалась"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <MainLayout>

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 h-auto"
      >

        {/* EDITOR */}
        <div className="xl:col-span-2 rounded-2xl overflow-hidden glass-panel">

          <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/60 flex items-center justify-between">
            <h3 className="text-sm md:text-base font-semibold inline-flex items-center gap-2">
              <Code2 size={16} /> solution.tsx
            </h3>
            <p className="text-xs text-slate-500">TypeScript • Monaco-ready</p>
          </div>

          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full h-[360px] md:h-[520px] bg-[#19070b] text-rose-200 outline-none resize-none text-sm p-4 md:p-6 font-mono"
            placeholder="// напишите ваш код..."
          />

        </div>

        {/* PANEL */}
        <div className="glass-panel rounded-2xl p-4 md:p-5 flex flex-col gap-4 h-fit">

          <h4 className="font-semibold">AI-проверка решения</h4>

          <Button onClick={handleCheck}>
            Проверить
          </Button>

          {loading && (
            <p className="text-slate-500 text-sm inline-flex items-center gap-2">
              <Sparkles size={14} /> Анализируем код...
            </p>
          )}

          {result && (
            <Card>

              <p className="text-red-700 dark:text-rose-300 font-bold text-lg md:text-xl mb-2">
                Quality: {result.quality}%
              </p>

              <div className="space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-200">Корректность: {result.correctness}%</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">Стиль: {result.style}%</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{result.summary}</p>
              </div>

            </Card>
          )}

          {!loading && error && (
            <Card>
              <p className="text-sm text-red-700 dark:text-rose-300">{error}</p>
            </Card>
          )}

          {!result && !loading && (
            <Card>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                После проверки вы увидите оценки, рекомендации и улучшения по стилю/архитектуре.
              </p>
            </Card>
          )}

          <Card>
            <h5 className="font-semibold mb-2">История решений</h5>

            {historyLoading && <p className="text-sm text-slate-500">Загрузка истории...</p>}

            {!historyLoading && history.length === 0 && (
              <EmptyState
                title="История пуста"
                description="Отправьте первое решение, и результаты проверки появятся здесь."
              />
            )}

            {!historyLoading && history.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {history.map((item) => (
                  <div key={item.id} className="rounded-xl glass-panel p-3">
                    <p className="text-sm font-medium">Quality: {item.quality}% • Correctness: {item.correctness}%</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString("ru-RU")}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

      </motion.div>

    </MainLayout>
  )
}