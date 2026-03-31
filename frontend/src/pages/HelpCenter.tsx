import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"

type FaqItem = { id: number; question: string; answer: string; category: string }

const FAQ_DATA: FaqItem[] = [
  { id: 1, category: "Обучение", question: "Как начать обучение на платформе?", answer: "Зарегистрируйтесь, перейдите в каталог курсов и запишитесь на интересующий курс. После записи курс появится на вашей панели управления." },
  { id: 2, category: "Обучение", question: "Как отправить решение на проверку?", answer: "Откройте страницу задачи, введите код или текст ответа в поле ввода и нажмите кнопку «Проверить». Результат проверки появится сразу." },
  { id: 3, category: "Обучение", question: "Где отслеживать прогресс?", answer: "Ваш прогресс отображается на панели управления (Dashboard) и на странице каждого курса в виде процента завершения." },
  { id: 4, category: "Обучение", question: "Сколько попыток для решения задачи?", answer: "Количество попыток не ограничено. Вы можете отправлять решения столько раз, сколько нужно, пока не получите максимальный балл." },
  { id: 5, category: "Обучение", question: "Что такое учебные траектории?", answer: "Учебные траектории — это рекомендованные последовательности курсов, подобранные под вашу цель: стать frontend-разработчиком, backend-разработчиком и т.д." },
  { id: 6, category: "Обучение", question: "Можно ли проходить несколько курсов одновременно?", answer: "Да, вы можете записаться на любое количество курсов и проходить их параллельно. Прогресс по каждому курсу отслеживается независимо." },
  { id: 7, category: "AI-функции", question: "Как работает AI-проверка кода?", answer: "AI-ассистент анализирует ваш код по трём критериям: качество, корректность и стиль. Вы получите числовые оценки и текстовые рекомендации по улучшению." },
  { id: 8, category: "AI-функции", question: "Что делает AI-чат?", answer: "AI-чат — это ваш персональный помощник по обучению. Задавайте вопросы по программированию, просите объяснить тему или помочь с кодом." },
  { id: 9, category: "AI-функции", question: "AI-ассистент платный?", answer: "Нет, AI-функции доступны бесплатно для всех зарегистрированных пользователей без ограничений." },
  { id: 10, category: "Аккаунт", question: "Как сменить пароль?", answer: "Перейдите в «Настройки аккаунта» → раздел «Безопасность» → «Сменить пароль». Введите текущий и новый пароль." },
  { id: 11, category: "Аккаунт", question: "Как включить двухфакторную аутентификацию?", answer: "В настройках аккаунта в разделе «Безопасность» нажмите «Включить 2FA». Вам будет отправлен код подтверждения." },
  { id: 12, category: "Аккаунт", question: "Забыл пароль, что делать?", answer: "На странице входа нажмите «Забыли пароль?», введите свой email. Вы получите код для сброса пароля." },
  { id: 13, category: "Аккаунт", question: "Как изменить email?", answer: "В настройках аккаунта нажмите «Сменить email», введите новый адрес и подтвердите его кодом, который придёт на новый email." },
  { id: 14, category: "Курсы", question: "Как записаться на закрытый курс?", answer: "Для закрытых курсов нужно отправить заявку. Преподаватель рассмотрит её и примет решение о допуске." },
  { id: 15, category: "Курсы", question: "Курсы платные?", answer: "На платформе есть как бесплатные, так и платные курсы. Информация о стоимости указана на странице каждого курса." },
  { id: 16, category: "Курсы", question: "Как получить сертификат?", answer: "Сертификат выдаётся автоматически после прохождения всех шагов курса на 100%." },
  { id: 17, category: "Преподавателям", question: "Как создать свой курс?", answer: "Перейдите в «Кабинет преподавателя» → «Создать курс». Заполните информацию, добавьте модули, уроки и шаги. После этого отправьте курс на модерацию." },
  { id: 18, category: "Преподавателям", question: "Как добавить задания в курс?", answer: "В конструкторе заданий выберите тип (код, тест, эссе), настройте условия и прикрепите задание к уроку." },
  { id: 19, category: "Техническое", question: "Какие браузеры поддерживаются?", answer: "Поддерживаются последние версии Chrome, Firefox, Safari и Edge. Рекомендуем Chrome для лучшей производительности." },
  { id: 20, category: "Техническое", question: "Как связаться с поддержкой?", answer: "Используйте раздел «Обратная связь» в меню. Ваше обращение будет рассмотрено администрацией в кратчайшие сроки." },
]

const CATEGORIES = [...new Set(FAQ_DATA.map((item) => item.category))]

export default function HelpCenter() {
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  const filtered = useMemo(() => {
    let items = FAQ_DATA
    if (activeCategory) {
      items = items.filter((item) => item.category === activeCategory)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      items = items.filter((item) => item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q))
    }
    return items
  }, [query, activeCategory])

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
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
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
          {CATEGORIES.map((cat) => (
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
          {filtered.map((item) => {
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
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="text-sm mt-2 ml-6 text-slate-600 dark:text-slate-300">{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <p className="text-sm py-4 text-center text-slate-500">Ничего не найдено. Попробуйте задать вопрос AI-ассистенту.</p>
          )}
        </Card>
      </motion.div>
    </MainLayout>
  )
}
