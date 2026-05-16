// страница аналитики — статистика прогресса по шагам курсов
// маршрут: /analytics, доступна всем ролям
//
// РЕЖИМЫ:
//   student — GET /analytics?period=week|month → { values[], stats }
//   teacher/admin — GET /teacher/analytics → { summary, weakLessons[] }
//     summary.coursesTotal — сколько курсов создал учитель
//     summary.studentsTotal — сколько студентов записано
//     summary.avgProgress — средний процент прохождения по всем записям
//     weakLessons[] — уроки с наибольшим числом failed/manual_review сабмишнов
//
// КАК РАБОТАЕТ СТУДЕНЧЕСКИЙ РЕЖИМ:
//   при монтировании и при смене period → useEffect запускает load()
//     → GET /analytics?period=week|month → { values[], stats }
//       values[] — массив чисел: количество выполненных шагов за каждый день (week) или неделю (month)
//                  для week: 7 элементов [пн, вт, ср, чт, пт, сб, вс]
//                  для month: 4 элемента [нед.1, нед.2, нед.3, нед.4]
//       stats.averageScore — "42%" строка — отношение выполненных шагов к общему количеству
//       stats.solvedTasks  — количество шагов выполненных за выбранный период
//       stats.completedCourses — количество курсов где progress_percent >= 100
//
// НОРМИРОВКА ГРАФИКА:
//   max = Math.max(...values, 1) — минимум 1 чтобы не делить на 0
//   ширина полоски = (v / max) * 100% — бар с максимальным значением всегда 100% ширины
//
// КАРТОЧКИ СТАТИСТИКИ:
//   statCards — массив объектов с { label, value, icon, color, bg, border }
//   рендерится через .map() — меньше дублирования кода

import { useEffect, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Skeleton from "../components/ui/Skeleton"
import { api } from "../lib/api"
import { BookOpen, CheckSquare, BarChart2, Users, TrendingUp, AlertTriangle } from "lucide-react"
import { useAppStore } from "../store/AppStore"

// Данные учительской аналитики от GET /teacher/analytics
type TeacherAnalytics = {
  summary: { coursesTotal: number; studentsTotal: number; avgProgress: number }
  weakLessons: Array<{ id: number; title: string; problemSubmissions: number }>
}

export default function Analytics() {
  const { user } = useAppStore()
  const isTeacher = user?.role === "teacher" || user?.role === "admin"

  const [period, setPeriod] = useState<"week" | "month">("week")
  const [values, setValues] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ averageScore: "0%", solvedTasks: 0, completedCourses: 0 })
  const [error, setError] = useState("")

  // Teacher analytics state
  const [teacherData, setTeacherData] = useState<TeacherAnalytics | null>(null)

  useEffect(() => {
    const load = async () => {
      setError("")
      setLoading(true)
      try {
        if (isTeacher) {
          // Учитель/админ видит статистику своих студентов и курсов
          const data = await api.get<TeacherAnalytics>("/teacher/analytics")
          setTeacherData(data)
        } else {
          // Студент видит свой личный прогресс
          const data = await api.get<{
            values: number[]
            stats: { averageScore: string; solvedTasks: number; completedCourses: number }
          }>(`/analytics?period=${period}`)
          setValues(data.values)
          setStats(data.stats)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [period, isTeacher])

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
            <p className="text-[var(--muted)] mt-1">
              {isTeacher ? "Статистика ваших студентов и курсов" : "Ваш прогресс и успеваемость"}
            </p>
          </div>
          {/* Переключатель периода — только для студентов */}
          {!isTeacher && (
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
          )}
        </div>

        {/* ── Режим учителя/администратора ── */}
        {isTeacher ? (
          <>
            {/* Карточки с данными о студентах и курсах */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            ) : teacherData ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Курсов создано", value: teacherData.summary.coursesTotal, icon: BookOpen, color: "text-primary", bg: "bg-[var(--bg-tint)]", border: "border-primary/20" },
                  { label: "Студентов записано", value: teacherData.summary.studentsTotal, icon: Users, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40" },
                  { label: "Средний прогресс", value: `${Number(teacherData.summary.avgProgress).toFixed(1)}%`, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200/60 dark:border-amber-800/40" },
                ].map(s => (
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
            ) : null}

            {/* Ошибка */}
            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Уроки с проблемами */}
            {!loading && teacherData && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={16} className="text-rose-500" />
                  <p className="font-bold font-display">Уроки с проблемами</p>
                  <p className="text-xs text-[var(--muted)] ml-1">Наибольшее число ошибочных попыток</p>
                </div>
                {teacherData.weakLessons.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] py-4 text-center">Проблемных уроков нет — отличный результат!</p>
                ) : (
                  <div className="space-y-3">
                    {teacherData.weakLessons.map((lesson, i) => {
                      const maxProblems = Math.max(...teacherData.weakLessons.map(l => l.problemSubmissions), 1)
                      return (
                        <div key={lesson.id} className="flex items-center gap-3">
                          <span className="text-xs text-[var(--muted)] w-5 shrink-0 text-right font-bold">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{lesson.title}</p>
                            <div className="mt-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                                style={{ width: `${(lesson.problemSubmissions / maxProblems) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-rose-500 shrink-0 w-12 text-right">
                            {lesson.problemSubmissions} ош.
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Режим студента ── */}

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

              {error && <p className="text-sm text-red-500">{error}</p>}

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
          </>
        )}

      </div>
    </MainLayout>
  )
}
