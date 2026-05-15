// страница обратной связи — обычный пользователь пишет обращение и видит ответы
// никакого управления статусами — это только в AdminPanel
//
// КАК РАБОТАЕТ:
//   при монтировании → GET /feedback → список своих обращений → setItems([...])
//   пользователь заполняет поле и нажимает "Отправить"
//     → submit() → POST /feedback { message, subject } → бэк создаёт тикет
//       → оптимистичный update: setItems([created, ...prev]) — новое обращение сразу в начале списка
//       → текст и тема сбрасываются, success=true → через 3 сек success=false
//
// STATUS_META — объект-справочник где ключ = статус, значение = { label, icon, cls }
//   вместо switch/case или if/else: const meta = STATUS_META[item.status] — одна строка
//   если пришёл неизвестный статус — ?. и ?? STATUS_META["new"] защищают от падения
//
// useMemo для visibleItems: фильтрация пересчитывается только когда меняются items или filter
// useMemo для counts: .filter() по всему массиву выполняется один раз при изменении items
import { useEffect, useMemo, useState } from "react"

import MainLayout from "../layout/MainLayout"
import { api } from "../lib/api"
import { MessageSquare, Clock, CheckCircle2, Loader2, Send } from "lucide-react"

type FeedbackStatus = "new" | "in_progress" | "closed"

// одно обращение из списка
type FeedbackItem = {
  id: number
  message: string
  status: FeedbackStatus
  subject?: string
  adminReply?: string // ответ администратора если есть
  repliedAt?: string | null
  createdAt?: string | null
}

// метаданные статусов — лейбл, иконка и цвет бейджа
const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  new: {
    label: "Новое",
    icon: <Clock size={12} />,
    cls: "bg-primary/10 text-primary border-primary/20",
  },
  in_progress: {
    label: "В работе", // переведено с in_progress
    icon: <Loader2 size={12} className="animate-spin" />,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40",
  },
  closed: {
    label: "Закрыто",
    icon: <CheckCircle2 size={12} />,
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40",
  },
}

// форматируем дату для отображения — "15 мая, 14:30"
const formatDate = (iso?: string | null) => {
  if (!iso) return ""
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

export default function Feedback() {
  const [text, setText] = useState("")
  const [subject, setSubject] = useState("")
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<"all" | FeedbackStatus>("all")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false) // временный флаг успешной отправки

  // загружаем список своих обращений
  const loadFeedback = async () => {
    try {
      const data = await api.get<FeedbackItem[]>("/feedback")
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить обращения")
    }
  }

  useEffect(() => { void loadFeedback() }, [])

  // отправить новое обращение
  const submit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const created = await api.post<FeedbackItem>("/feedback", {
        message: text.trim(),
        subject: subject.trim() || undefined, // тема необязательна
      })
      // добавляем новое обращение в начало списка без перезагрузки
      setItems((prev) => [created, ...prev])
      setText("")
      setSubject("")
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000) // убираем уведомление через 3 секунды
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить обращение")
    } finally {
      setSubmitting(false)
    }
  }

  // фильтруем список по выбранному статусу
  const visibleItems = useMemo(() => {
    if (filter === "all") return items
    return items.filter((item) => item.status === filter)
  }, [items, filter])

  // счётчики для таблеток фильтра
  const counts = useMemo(() => ({
    all: items.length,
    new: items.filter(i => i.status === "new").length,
    active: items.filter(i => i.status === "in_progress").length,
    closed: items.filter(i => i.status === "closed").length,
  }), [items])

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* заголовок */}
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight">Обратная связь</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Напишите нам — мы ответим как можно скорее</p>
        </div>

        {/* форма нового обращения */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare size={14} className="text-primary" />
            </div>
            <p className="font-bold text-sm">Новое обращение</p>
          </div>

          {/* тема — необязательное поле */}
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Тема (необязательно)"
            className="input-field px-3 py-2.5 text-sm"
          />
          {/* текст обращения */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Опишите проблему или предложение…"
            rows={4}
            className="input-field px-3 py-2.5 text-sm resize-none"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}
          {/* сообщение об успешной отправке — исчезает через 3 сек */}
          {success && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Обращение отправлено — ждите ответа!
            </p>
          )}

          <button
            onClick={submit}
            disabled={!text.trim() || submitting}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? "Отправляем…" : "Отправить"}
          </button>
        </div>

        {/* список обращений — только если есть хоть одно */}
        {items.length > 0 && (
          <div className="space-y-3">
            {/* таблетки-фильтры — показываем только те у которых count > 0 */}
            <div className="flex gap-2 flex-wrap">
              {([
                { v: "all", l: `Все (${counts.all})` },
                { v: "new", l: `Новые (${counts.new})` },
                { v: "in_progress", l: `В работе (${counts.active})` },
                { v: "closed", l: `Закрытые (${counts.closed})` },
              ] as const).filter(f => {
                if (f.v === "all") return true
                const n = f.v === "in progress" ? counts.active : counts[f.v as keyof typeof counts]
                return (n as number) > 0
              }).map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    filter === f.v
                      ? "btn-gradient"
                      : "bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            {/* карточки обращений */}
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const meta = STATUS_META[item.status] ?? STATUS_META["new"]
                const hasReply = Boolean(item.adminReply?.trim())
                return (
                  <div
                    key={item.id}
                    className={`card p-5 space-y-3 transition-all ${
                      item.status === "new" && !hasReply
                        ? "border-primary/25 bg-[var(--bg-tint)]" // новые без ответа — выделяем
                        : ""
                    }`}
                  >
                    {/* шапка карточки: тема + текст */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {item.subject && (
                          <p className="text-xs font-semibold text-[var(--muted)] mb-1 truncate">
                            {item.subject}
                          </p>
                        )}
                        <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words leading-relaxed">
                          {item.message}
                        </p>
                      </div>
                    </div>

                    {/* строка статуса + дата */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold border ${meta.cls}`}>
                        {meta.icon}
                        {meta.label}
                      </span>
                      {/* бейдж "получен ответ" если есть adminReply */}
                      {hasReply && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40">
                          <CheckCircle2 size={11} />
                          Получен ответ
                        </span>
                      )}
                      {item.createdAt && (
                        <span className="text-xs text-[var(--muted)] ml-auto">
                          {formatDate(item.createdAt)}
                        </span>
                      )}
                    </div>

                    {/* блок ответа администратора */}
                    {hasReply && (
                      <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10 px-4 py-3 space-y-1">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          Ответ администратора
                        </p>
                        <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words leading-relaxed">
                          {item.adminReply}
                        </p>
                        {item.repliedAt && (
                          <p className="text-xs text-[var(--muted)]">{formatDate(item.repliedAt)}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* заглушка если обращений ещё нет */}
        {items.length === 0 && !submitting && (
          <div className="card p-10 text-center space-y-2">
            <MessageSquare size={32} className="mx-auto text-[var(--border)]" />
            <p className="text-sm text-[var(--muted)]">У вас пока нет обращений</p>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
