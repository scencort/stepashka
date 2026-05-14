// страница аналитики — графики прогресса и AI-рекомендации
// доступна только преподавателям и администраторам (ProtectedRoute ограничивает)
import { useEffect, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Skeleton from "../components/ui/Skeleton"
import { api } from "../lib/api"
import { TrendingUp, TrendingDown, BookOpen, CheckSquare, Star, Sparkles } from "lucide-react"

export default function Analytics() {
  // период: неделя или месяц — влияет на запрос к серверу
  const [period, setPeriod] = useState<"week" | "month">("week")
  // массив значений для построения графика (по дням или неделям)
  const [values, setValues] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ averageScore: "0%", solvedTasks: 0, completedCourses: 0 })
  const [error, setError] = useState("")
  // ai-инсайты грузятся отдельно — могут быть медленными
  const [insights, setInsights] = useState<Array<{ label: string; text: string }>>([])
  const [insightsLoading, setInsightsLoading] = useState(false)

  // при смене периода перезагружаем всё
  useEffect(() => {
    const load = async () => {
      setError("")
      setLoading(true)
      try {
        const data = await api.get<{
          values: number[]
          stats: { averageScore: string; solvedTasks: number; completedCourses: number }
        }>(`/analytics?period=${period}`)
        setValues(data.values)
        setStats(data.stats)

        // ai-инсайты запрашиваем отдельно — отправляем данные графика и ждём анализ
        setInsightsLoading(true)
        try {
          const ins = await api.post<{ insights: Array<{ label: string; text: string }> }>("/ai/insights", {
            period, values: data.values, ...data.stats,
          })
          setInsights(ins.insights || [])
        } catch { setInsights([]) } finally { setInsightsLoading(false) }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки")
      } finally { setLoading(false) }
    }
    void load()
  }, [period])

  // вычисляем дельту — разница между последним и первым значением
  const last = values[values.length - 1] ?? 0
  const first = values[0] ?? 0
  const delta = last - first
  const max = Math.max(...values, 1) // нужен для нормировки ширины полосок графика

  const statCards = [
    {
      label: "Средний балл",
      value: stats.averageScore,
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200/60 dark:border-amber-800/40",
    },
    {
      label: "Решено задач",
      value: stats.solvedTasks,
      icon: CheckSquare,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
    },
    {
      label: "Пройдено курсов",
      value: stats.completedCourses,
      icon: BookOpen,
      color: "text-primary",
      bg: "bg-[var(--bg-tint)]",
      border: "border-primary/20",
    },
  ]

  return (
    <MainLayout>
      <div className="space-y-6 lg:space-y-8">

        {/* заголовок + переключатель периода */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Аналитика</h1>
            <p className="text-[var(--muted)] mt-1">Ваш прогресс и успеваемость</p>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] self-start sm:self-auto">
            {(["week", "month"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  period === p
                    ? "btn-gradient shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {p === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>
        </div>

        {/* карточки статистики — скелетон пока грузятся */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map(s => (
              <div key={s.label} className="card p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                  <s.icon size={22} className={s.color} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">{s.label}</p>
                  <p className="text-3xl font-bold tracking-tight font-display mt-0.5">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* график динамики прогресса */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <p className="text-base font-bold font-display">Динамика прогресса</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {period === "week" ? "По дням за последние 7 дней" : "По неделям за последний месяц"}
              </p>
            </div>
            {/* бейдж с дельтой — зелёный если рост, красный если падение */}
            {!loading && values.length > 0 && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold ${
                delta >= 0
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200/60 dark:border-red-800/40 text-red-600 dark:text-red-400"
              }`}>
                {delta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {delta >= 0 ? "+" : ""}{delta}% за период
              </div>
            )}
          </div>

          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-xl" />)}
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          )}

          {/* заглушка если данных ещё нет */}
          {!loading && values.length === 0 && !error && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tint)] border border-primary/20 flex items-center justify-center">
                <TrendingUp size={24} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-[var(--text)]">Данных пока нет</p>
                <p className="text-sm text-[var(--muted)] mt-1">Пройдите несколько шагов курса, чтобы увидеть динамику</p>
              </div>
            </div>
          )}

          {/* горизонтальные полоски — нормированы относительно максимального значения */}
          {!loading && values.length > 0 && (
            <div className="space-y-3">
              {values.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--muted)] w-16 shrink-0 text-right">
                    {period === "week" ? `День ${i + 1}` : `Нед. ${i + 1}`}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(v / max) * 100}%`,
                        background: "linear-gradient(135deg, var(--btn-grad-from) 0%, var(--btn-grad-to) 100%)",
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-[var(--text)] w-10 shrink-0 text-right">{v}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* блок ai-рекомендаций — появляется только если есть данные */}
        {!loading && values.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-primary" />
              <p className="text-sm font-bold font-display text-[var(--text)]">AI-рекомендации</p>
            </div>

            {/* пока ai думает — показываем скелетоны */}
            {insightsLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            )}

            {!insightsLoading && insights.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {insights.map((item, i) => (
                  <div key={i} className="card p-4 border-l-4 border-l-primary/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] mb-2">{item.label}</p>
                    <p className="text-sm text-[var(--text-2)] leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ai недоступен или вернул пустой ответ */}
            {!insightsLoading && insights.length === 0 && (
              <div className="card p-4 text-sm text-[var(--muted)]">
                AI-инсайты недоступны — попробуйте позже
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
