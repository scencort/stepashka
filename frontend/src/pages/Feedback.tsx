import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"

type FeedbackItem = {
  id: number
  message: string
  status: "new" | "in progress" | "closed"
}

export default function Feedback() {
  const [text, setText] = useState("")
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<"all" | FeedbackItem["status"]>("all")
  const [error, setError] = useState("")

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
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось изменить статус")
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
          <p className="font-semibold">Новое предложение</p>
          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Что можно улучшить на платформе?"
            className="w-full h-28 rounded-xl glass-input px-3 py-2"
          />
          <Button onClick={submit} className="w-full md:w-auto">Отправить</Button>
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="font-semibold">Список обращений</p>
            <div className="flex gap-2">
              {(["all", "new", "in progress", "closed"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs ${filter === item ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
                >
                  {item === "all" ? "все" : item === "new" ? "новые" : item === "in progress" ? "в работе" : "закрытые"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <div key={item.id} className="glass-panel rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="font-medium">{item.message}</p>
                  <p className="text-xs text-slate-500 mt-1">Статус: {item.status === "new" ? "новое" : item.status === "in progress" ? "в работе" : "закрыто"}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => moveStatus(item.id)}>Следующий статус</Button>
                  <Button variant="outline" onClick={() => removeFeedback(item.id)}>Удалить</Button>
                </div>
              </div>
            ))}
            {visibleItems.length === 0 && <p className="text-sm text-slate-500">По выбранному фильтру обращений нет.</p>}
          </div>
        </Card>
      </motion.div>
    </MainLayout>
  )
}
