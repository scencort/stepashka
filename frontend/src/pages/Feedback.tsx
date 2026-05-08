import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"
import { useAppStore } from "../store/AppStore"

type FeedbackStatus = "new" | "in progress" | "closed"

type FeedbackItem = {
  id: number
  message: string
  status: FeedbackStatus
  subject?: string
  adminReply?: string
  repliedBy?: number | null
  repliedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "новое",
  "in progress": "в работе",
  closed: "закрыто",
}

const STATUS_COLOR: Record<FeedbackStatus, string> = {
  new: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
  "in progress": "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  closed: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
}

export default function Feedback() {
  const { user } = useAppStore()
  const isAdmin = user?.role === "admin"

  const [text, setText] = useState("")
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all")
  const [error, setError] = useState("")
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [replyingId, setReplyingId] = useState<number | null>(null)

  const loadFeedback = async () => {
    try {
      const data = await api.get<FeedbackItem[]>("/feedback")
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить обращения")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadFeedback()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  const submit = async () => {
    if (!text.trim()) {
      return
    }

    try {
      const created = await api.post<FeedbackItem>("/feedback", { message: text.trim() })
      setItems((prev) => [created, ...prev])
      setText("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить обращение")
    }
  }

  const moveStatus = async (id: number) => {
    try {
      const updated = await api.patch<FeedbackItem>(`/feedback/${id}/status`, {})
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус")
    }
  }

  const sendReply = async (id: number) => {
    const draft = (replyDrafts[id] || "").trim()
    if (!draft) return
    setReplyingId(id)
    try {
      const updated = await api.post<FeedbackItem>(`/feedback/${id}/reply`, {
        reply: draft,
      })
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)))
      setReplyDrafts((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить ответ")
    } finally {
      setReplyingId(null)
    }
  }

  const removeFeedback = async (id: number) => {
    try {
      await api.delete<{ success: boolean }>(`/feedback/${id}`)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить обращение")
    }
  }

  const visibleItems = useMemo(() => {
    if (filter === "all") {
      return items
    }
    return items.filter((item) => item.status === filter)
  }, [items, filter])

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold">Обратная связь</h2>

        <Card className="space-y-3">
          <p className="font-semibold">Новое обращение</p>
          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Опишите проблему или предложение"
            className="w-full h-28 rounded-xl glass-input px-3 py-2"
          />
          <Button onClick={submit} className="w-full md:w-auto">Отправить</Button>
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="font-semibold">
              {isAdmin ? "Список обращений пользователей" : "Мои обращения"}
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["all", "new", "in progress", "closed"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs ${
                    filter === item
                      ? "btn-gradient text-white"
                      : "glass-panel"
                  }`}
                >
                  {item === "all" ? "все" : STATUS_LABEL[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {visibleItems.map((item) => {
              const status = (item.status || "new") as FeedbackStatus
              const draft = replyDrafts[item.id] ?? ""
              const hasReply = Boolean(item.adminReply && item.adminReply.trim())
              return (
                <div key={item.id} className="glass-panel rounded-xl p-3 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {item.subject && (
                        <p className="text-xs text-slate-500 mb-1">{item.subject}</p>
                      )}
                      <p className="font-medium whitespace-pre-wrap break-words">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] || ""}`}
                        >
                          {STATUS_LABEL[status] || status}
                        </span>
                        {hasReply && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                            Ответ получен
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {isAdmin && (
                        <Button variant="outline" onClick={() => moveStatus(item.id)}>
                          Следующий статус
                        </Button>
                      )}
                      {isAdmin && (
                        <Button variant="outline" onClick={() => removeFeedback(item.id)}>
                          Удалить
                        </Button>
                      )}
                    </div>
                  </div>

                  {hasReply && (
                    <div className="rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 bg-emerald-50/40 dark:bg-emerald-900/10 px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                        Ответ администратора
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {item.adminReply}
                      </p>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="rounded-lg border border-[var(--border)] px-3 py-2 space-y-2">
                      <p className="text-xs font-semibold text-[var(--muted)]">
                        {hasReply ? "Изменить ответ" : "Ответить пользователю"}
                      </p>
                      <textarea
                        value={draft}
                        onChange={(event) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder={
                          hasReply
                            ? "Введите новый ответ..."
                            : "Введите ответ пользователю..."
                        }
                        className="w-full h-20 rounded-xl glass-input px-3 py-2 text-sm"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => sendReply(item.id)}
                          disabled={!draft.trim() || replyingId === item.id}
                        >
                          {replyingId === item.id ? "Отправляем..." : "Отправить ответ"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {visibleItems.length === 0 && (
              <p className="text-sm text-slate-500">По выбранному фильтру обращений нет.</p>
            )}
          </div>
        </Card>
      </motion.div>
    </MainLayout>
  )
}
