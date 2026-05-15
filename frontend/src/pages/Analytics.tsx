// страница аналитики — статистика прогресса студента по шагам курсов
// маршрут: /analytics, доступна учителям и администраторам (MainLayout показывает ссылку только им)
//
// КАК РАБОТАЕТ:
//   при монтировании и при смене period → useEffect запускает load()
//     → GET /analytics?period=week|month → { values[], stats }
//       values[] — массив чисел: количество выполненных шагов за каждый день (week) или неделю (month)
//                  для week: 7 элементов [пн, вт, ср, чт, пт, сб, вс]
//                  для month: 4 элемента [нед.1, нед.2, нед.3, нед.4]
//       stats.averageScore — "42%" строка — отношение выполненных шагов к общему количеству
//       stats.solvedTasks  — количество шагов выполненных за выбранный период
//       stats.completedCourses — количество курсов где progress_percent >= 100
//
// НОРМИРОВКА ГРАФИКА (горизонтальные полоски):
//   max = Math.max(...values, 1) — максимальное значение в периоде (минимум 1 чтобы не делить на 0)
//   ширина полоски = (v / max) * 100% — бар с максимальным значением всегда 100% ширины
//   остальные бары масштабируются пропорционально
//
// РУССКОЕ СКЛОНЕНИЕ:
//   v === 1 → "шаг", v < 5 → "шага", иначе → "шагов"
//   это правило работает для чисел 1-20 (для 11-14 всегда "шагов" — в данном контексте маловероятно)
//
// КАРТОЧКИ СТАТИСТИКИ:
//   statCards — массив объектов с { label, value, icon, color, bg, border }
//   рендерится через .map() вместо трёх отдельных JSX-блоков — меньше дублирования
//   loading → Skeleton заглушки, loaded → карточки с реальными данными
//
// СОСТОЯНИЯ ГРАФИКА:
//   loading → 7 Skeleton строк
//   error → красный текст ошибки
//   totalSteps === 0 → заглушка "Нет активности"
//   totalSteps > 0 → список горизонтальных полосок с данными

import { useEffect, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Skeleton from "../components/ui/Skeleton"
import { api } from "../lib/api"
import { BookOpen, CheckSquare, BarChart2 } from "lucide-react"

export default function Analytics() {
  const [period, setPeriod] = useState<"week" | "month">("week")
  const [values, setValues] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ averageScore: "0%", solvedTasks: 0, completedCourses: 0 })
  const [error, setError] = useState("")

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [period])

  const max = Math.max(...values, 1)
  const totalSteps = values.reduce((a, b) => a + b, 0)

  const statCards = [
    { label: "Прогресс платформы", value: stats.averageScore, icon: BarChart2, color: "text-primary", bg: "bg-[var(--bg-tint)]", border: "border-primary/20" },
    { label: period === "week" ? "Шагов за неделю" : "Шагов за месяц", value: stats.solvedTasks, icon: CheckSquare, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40" },
    { label: "Пройдено курсов", value: stats.completedCourses, icon: BookOpen, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40" },
  ]

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* Заголовок + переключатель периода */}
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
                  period === p ? "btn-gradient shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                {p === "week" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>
        </div>

        {/* Карточки статистики */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {statCards.map(s => (
              <div key={s.label} className="card p-5 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                  <s.icon size={20} className={s.color} />
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)] font-medium">{s.label}</p>
                  <p className="text-2xl font-bold tracking-tight font-display mt-0.5">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* График активности */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-bold font-display">Активность</p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {period === "week" ? "Шагов выполнено по дням" : "Шагов выполнено по неделям"}
              </p>
            </div>
            {!loading && totalSteps > 0 && (
              <span className="text-xs font-semibold text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] px-3 py-1 rounded-lg">
                Итого: {totalSteps} шагов
              </span>
            )}
          </div>

          {loading && (
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-7 w-full rounded-lg" />)}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {!loading && !error && totalSteps === 0 && (
            <div className="py-10 text-center">
              <p className="text-[var(--muted)] text-sm">Нет активности за этот период</p>
              <p className="text-[var(--muted)] text-xs mt-1">Пройдите несколько шагов курса</p>
            </div>
          )}

          {!loading && !error && totalSteps > 0 && (
            <div className="space-y-2.5">
              {values.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--muted)] w-14 shrink-0 text-right">
                    {period === "week" ? `День ${i + 1}` : `Нед. ${i + 1}`}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${(v / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[var(--text)] w-12 shrink-0 text-right">
                    {v} {v === 1 ? "шаг" : v < 5 ? "шага" : "шагов"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  )
}
