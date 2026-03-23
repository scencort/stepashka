import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"

type Faq = {
  id: number
  question: string
  answer: string
}

export default function HelpCenter() {
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<number | null>(1)
  const [faqData, setFaqData] = useState<Faq[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<Faq[]>("/help-faq")
        setFaqData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить справку")
      }
    }

    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return faqData
    }
    return faqData.filter((item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q))
  }, [query, faqData])

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <h2 className="text-2xl font-bold">Центр помощи</h2>

        <Card>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по вопросам"
            className="w-full rounded-xl glass-panel px-3 py-2 outline-none"
          />
        </Card>

        <Card className="space-y-2">
          {error && <p className="text-sm text-red-700 dark:text-rose-300">{error}</p>}
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl glass-panel px-3 py-2">
              <button
                className="w-full text-left font-semibold"
                onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
              >
                {item.question}
              </button>
              {openId === item.id && <p className="text-sm mt-2 text-slate-600 dark:text-slate-300">{item.answer}</p>}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-300">Ничего не найдено. Попробуйте другой запрос.</p>
          )}
        </Card>
      </motion.div>
    </MainLayout>
  )
}
