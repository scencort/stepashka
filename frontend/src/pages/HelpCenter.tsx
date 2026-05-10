import { useEffect, useMemo, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import { api } from "../lib/api"

type FaqItem = { id: number; question: string; answer: string; category: string }

export default function HelpCenter() {
  const [faqData, setFaqData] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    api.get<FaqItem[]>("/help/faq")
      .then(setFaqData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => [...new Set(faqData.map((item) => item.category))], [faqData])

  const filtered = useMemo(() => {
    let items = faqData
    if (activeCategory) {
      items = items.filter((item) => item.category === activeCategory)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      items = items.filter((item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q))
    }
    return items
  }, [faqData, query, activeCategory])

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const askAi = async () => {
    const q = query.trim()
    if (!q) return
    setAiLoading(true)
    setAiAnswer("")
    try {
      const data = await api.post<{ answer: string }>("/ai/faq", { question: q })
      setAiAnswer(data.answer || "Не удалось получить ответ.")
    } catch {
      setAiAnswer("AI-ассистент временно недоступен. Попробуйте позже.")
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold">Справка</h2>

        <Card>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") askAi() }}
              placeholder="Поиск по вопросам или задайте вопрос AI..."
              className="flex-1 rounded-xl glass-input px-3 py-2"
            />
            <button
              onClick={askAi}
              disabled={aiLoading || !query.trim()}
              className="shrink-0 px-4 py-2 rounded-xl text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900 disabled:opacity-50"
            >
              {aiLoading ? "Думаю..." : "Спросить AI"}
            </button>
          </div>
        </Card>

        {aiAnswer && (
          <Card className="space-y-2">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Ответ AI-ассистента</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{aiAnswer}</p>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded-xl text-xs transition ${!activeCategory ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
          >
            Все
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory((prev) => (prev === cat ? null : cat))}
              className={`px-3 py-1.5 rounded-xl text-xs transition ${activeCategory === cat ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <Card className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
          {loading && <p className="text-sm py-4 text-center text-slate-500">Загрузка...</p>}

          {!loading && filtered.map((item) => {
            const isOpen = openIds.has(item.id)
            return (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <button
                  className="w-full flex items-center gap-3 text-left"
                  onClick={() => toggle(item.id)}
                >
                  <span
                    className={`shrink-0 text-xs text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <span className="font-medium flex-1">{item.question}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{item.category}</span>
                </button>
                  {isOpen && (
                    <div
                      className="overflow-hidden"
                    >
                      <p className="text-sm mt-2 ml-6 text-slate-600 dark:text-slate-300">{item.answer}</p>
                    </div>
                  )}
              </div>
            )
          })}

          {!loading && filtered.length === 0 && (
            <p className="text-sm py-4 text-center text-slate-500">Ничего не найдено. Попробуйте задать вопрос AI-ассистенту.</p>
          )}
        </Card>
      </div>
    </MainLayout>
  )
}
