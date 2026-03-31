import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"

type Verdict = {
  id?: number
  quality: number
  correctness: number
  style: number
  summary: string
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export default function AiReview() {
  const [code, setCode] = useState("")
  const [isChecking, setIsChecking] = useState(false)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [history, setHistory] = useState<Array<{ id: number; quality: number; created_at: string }>>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Привет. Я AI-ассистент Stepashka. Могу помочь с кодом, архитектурой, SQL, алгоритмами и roadmap по задачам.",
    },
  ])
  const [error, setError] = useState("")

  const loadHistory = async () => {
    try {
      const data = await api.get<Array<{ id: number; quality: number; created_at: string }>>("/ai-review/history")
      setHistory(data)
    } catch {
      setHistory([])
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const runCheck = async () => {
    setIsChecking(true)
    setVerdict(null)
    setError("")

    try {
      const response = await api.post<Verdict>("/ai-review/check", {
        sourceCode: code,
      })
      setVerdict(response)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверка не удалась")
    } finally {
      setIsChecking(false)
    }
  }

  const askAi = async () => {
    const message = chatInput.trim()
    if (!message) {
      return
    }

    const nextMessages = [...chatMessages, { role: "user" as const, content: message }]
    setChatMessages(nextMessages)
    setChatInput("")
    setChatLoading(true)
    setError("")

    try {
      const baseUrl = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")
      const accessToken = localStorage.getItem("stepashka_access_token")
      const streamResponse = baseUrl
        ? await fetch(`${baseUrl}/ai/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            message,
            context: nextMessages.slice(-8).map((item) => ({ role: item.role, content: item.content })),
          }),
        })
        : null

      if (streamResponse && streamResponse.ok && streamResponse.body) {
        const reader = streamResponse.body.getReader()
        const decoder = new TextDecoder()
        let streamed = ""

        setChatMessages((prev) => [...prev, { role: "assistant", content: "" }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }
          streamed += decoder.decode(value, { stream: true })
          setChatMessages((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: "assistant", content: streamed }
            return next
          })
        }
      } else {
        const response = await api.post<{ reply: string; model: string }>("/ai/chat", {
          message,
          context: nextMessages.slice(-8).map((item) => ({ role: item.role, content: item.content })),
        })

        setChatMessages((prev) => [...prev, { role: "assistant", content: `${response.reply}\n\nmodel: ${response.model}` }])
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Не удалось получить ответ AI"
      setError(messageText)
      setChatMessages((prev) => [...prev, { role: "assistant", content: `Ошибка: ${messageText}` }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <h2 className="text-2xl font-bold">AI-проверка</h2>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card className="xl:col-span-2 space-y-3">
            <p className="font-semibold">Код решения</p>
            <textarea
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Вставьте код для проверки"
              className="w-full h-[360px] rounded-xl glass-panel p-3 bg-[#19070b] text-rose-200 outline-none"
            />
            <Button onClick={runCheck} className="w-full md:w-auto">Запустить проверку</Button>
          </Card>

          <Card className="space-y-3">
            <p className="font-semibold">Результат</p>

            {isChecking && <p className="text-sm text-slate-600 dark:text-slate-300">Идет проверка...</p>}

            {!isChecking && verdict && (
              <div className="space-y-2 text-sm">
                <p>Quality: <strong>{verdict.quality}%</strong></p>
                <p>Корректность: <strong>{verdict.correctness}%</strong></p>
                <p>Стиль: <strong>{verdict.style}%</strong></p>
                <p className="pt-2 text-slate-600 dark:text-slate-300">{verdict.summary}</p>
              </div>
            )}

            {!isChecking && !verdict && (
              <p className="text-sm text-slate-600 dark:text-slate-300">Запустите проверку, чтобы увидеть оценки и рекомендации.</p>
            )}

            {!isChecking && error && (
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            )}
          </Card>

          <Card className="space-y-2">
            <p className="font-semibold">История проверок</p>
            {history.map((item) => (
              <p key={item.id} className="text-sm text-slate-600 dark:text-slate-300">
                Проверка #{item.id}: {item.quality}%
              </p>
            ))}
            {history.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">История пуста.</p>}
          </Card>

          <Card className="xl:col-span-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">AI-чат для реальной помощи</p>
              <span className="text-xs text-slate-500">Backend proxy + provider API</span>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
              {chatMessages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`rounded-xl p-3 ${item.role === "assistant" ? "glass-panel" : "bg-gradient-to-r from-rose-700 via-red-700 to-red-900 text-white"}`}
                >
                  <p className="text-xs opacity-80 mb-1">{item.role === "assistant" ? "AI" : "Вы"}</p>
                  <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Спросите про архитектуру, баг, SQL, тесты, оптимизацию..."
                className="w-full min-h-[96px] rounded-xl glass-panel p-3 outline-none"
              />
              <Button onClick={askAi} disabled={chatLoading} className="md:self-end md:min-w-[160px]">
                {chatLoading ? "Думаю..." : "Спросить AI"}
              </Button>
            </div>
          </Card>
        </div>
      </motion.div>
    </MainLayout>
  )
}
