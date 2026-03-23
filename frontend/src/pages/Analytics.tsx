import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"
import Skeleton from "../components/ui/Skeleton"
import EmptyState from "../components/ui/EmptyState"

export default function Analytics() {
  const [period, setPeriod] = useState<"week" | "month">("week")
  const [values, setValues] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    averageScore: "0%",
    solvedTasks: 0,
    completedCourses: 0,
  })
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      setError("")
      setLoading(true)
      try {
        const data = await api.get<{
          values: number[]
          stats: {
            averageScore: string
            solvedTasks: number
            completedCourses: number
          }
        }>(`/analytics?period=${period}`)
        setValues(data.values)
        setStats(data.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [period])

  const lastValue = values[values.length - 1] ?? 0
  const firstValue = values[0] ?? 0
  const delta = lastValue - firstValue
  const goal = 80
  const goalStatus = lastValue >= goal ? "goal-reached" : "in-progress"

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h2 className="text-2xl font-bold">Аналитика и успеваемость</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod("week")}
              className={`px-4 py-2 rounded-xl ${period === "week" ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
            >
              Неделя
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-4 py-2 rounded-xl ${period === "month" ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
            >
              Месяц
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><p className="text-sm text-slate-500">Средний балл</p><p className="text-2xl font-bold mt-2">{stats.averageScore}</p></Card>
          <Card><p className="text-sm text-slate-500">Решено задач</p><p className="text-2xl font-bold mt-2">{stats.solvedTasks}</p></Card>
          <Card><p className="text-sm text-slate-500">Пройдено курсов</p><p className="text-2xl font-bold mt-2">{stats.completedCourses}</p></Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-slate-500">Тренд периода</p>
            <p className={`text-2xl font-bold mt-2 ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {delta >= 0 ? "+" : ""}{delta}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Сравнение начала и конца периода</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Текущий sprint score</p>
            <p className="text-2xl font-bold mt-2">{lastValue}%</p>
            <p className="text-xs text-slate-500 mt-1">Последняя точка в выбранном интервале</p>
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Цель обучения</p>
            <p className="text-2xl font-bold mt-2">{goal}%</p>
            <p className={`text-xs mt-1 ${goalStatus === "goal-reached" ? "text-emerald-600" : "text-amber-600"}`}>
              {goalStatus === "goal-reached" ? "Цель достигнута" : "Продолжайте практику до цели"}
            </p>
          </Card>
        </div>

        <Card>
          <h3 className="font-semibold mb-4">Динамика прогресса</h3>
          {error && <p className="text-sm text-red-700 dark:text-rose-300 mb-3">{error}</p>}

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          )}

          {!loading && values.length === 0 && (
            <EmptyState
              title="Пока недостаточно данных"
              description="Пройдите несколько шагов курса, чтобы построить динамику."
            />
          )}

          {!loading && values.length > 0 && (
            <div className="space-y-3">
              {values.map((value, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>{period === "week" ? `День ${idx + 1}` : `Неделя ${idx + 1}`}</span>
                    <span>{value}%</span>
                  </div>
                  <progress
                    value={value}
                    max={100}
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600 dark:[&::-webkit-progress-value]:bg-rose-600"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {!loading && values.length > 0 && (
          <Card className="space-y-3">
            <h3 className="font-semibold">AI insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl glass-panel p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Сильная зона</p>
                <p className="font-medium mt-1">Практические шаги: стабильный рост {Math.max(0, delta)}%</p>
              </div>
              <div className="rounded-xl glass-panel p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Зона риска</p>
                <p className="font-medium mt-1">Рекомендуется увеличить регулярность и довести sprint до {goal}%</p>
              </div>
              <div className="rounded-xl glass-panel p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Следующий шаг</p>
                <p className="font-medium mt-1">Добавить 2 code-практики и пройти 1 quiz на этой неделе</p>
              </div>
            </div>
          </Card>
        )}
      </motion.div>
    </MainLayout>
  )
}
