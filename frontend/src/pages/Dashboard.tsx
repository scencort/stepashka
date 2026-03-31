import { useEffect, useState } from "react"
import MainLayout from "../layout/MainLayout"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Card from "../components/ui/Card"
import { Target, Flame, Award, CalendarDays, ArrowUpRight } from "lucide-react"
import { api } from "../lib/api"
import Skeleton from "../components/ui/Skeleton"
import EmptyState from "../components/ui/EmptyState"

import {
  fadeInUp,
  staggerContainer,
} from "../lib/animations"

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [weeklyGoal, setWeeklyGoal] = useState(10)
  const [payload, setPayload] = useState<{
    stats: {
      activeCourses: number
      streakDays: number
      averageScore: string
      tasksWeek: number
    }
    continue: {
      courseId: number
      courseTitle: string
      stepId: number
      stepTitle: string
      stepOrder: number
    } | null
    weeklyPlan: {
      goalSteps: number
      completedSteps: number
      remainingSteps: number
      forecastDays: number
    }
    courses: Array<{ id: number; title: string; progress: number }>
    activities: Array<{ id: number; text: string; time: string }>
    deadline: { title: string; text: string }
  } | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const data = await api.get<{
          stats: {
            activeCourses: number
            streakDays: number
            averageScore: string
            tasksWeek: number
          }
          continue: {
            courseId: number
            courseTitle: string
            stepId: number
            stepTitle: string
            stepOrder: number
          } | null
          weeklyPlan: {
            goalSteps: number
            completedSteps: number
            remainingSteps: number
            forecastDays: number
          }
          courses: Array<{ id: number; title: string; progress: number }>
          activities: Array<{ id: number; text: string; time: string }>
          deadline: { title: string; text: string }
        }>("/dashboard")
        setPayload(data)
        setWeeklyGoal(data.weeklyPlan.goalSteps)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные панели")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const updateWeeklyGoal = (nextGoal: number) => {
    const safeGoal = Math.max(3, Math.min(50, Math.round(nextGoal)))
    setWeeklyGoal(safeGoal)
    api.patch<{ goal: number }>("/student/weekly-goal", { goal: safeGoal }).catch(() => {})
  }

  const stats = [
    { label: "Активные курсы", value: String(payload?.stats.activeCourses ?? 0), icon: Target },
    { label: "Серия", value: `${payload?.stats.streakDays ?? 0} дней`, icon: Flame },
    { label: "Средний балл", value: payload?.stats.averageScore ?? "0%", icon: Award },
    { label: "Задач за неделю", value: String(payload?.stats.tasksWeek ?? 0), icon: CalendarDays },
  ]

  const completedWeeklySteps = payload?.weeklyPlan.completedSteps ?? 0
  const weeklyPercent = weeklyGoal
    ? Math.min(100, Math.round((completedWeeklySteps / weeklyGoal) * 100))
    : 0
  const continueStep = payload?.continue
  const weeklyRemaining = Math.max(weeklyGoal - completedWeeklySteps, 0)

  // «Фокус на сегодня» — реальные данные из статистики, без AI
  const todayFocus: string[] = []
  if (payload) {
    if (payload.continue) {
      todayFocus.push(`Продолжить: ${payload.continue.courseTitle} — шаг ${payload.continue.stepOrder}`)
    }
    if (weeklyRemaining > 0) {
      todayFocus.push(`До недельной цели осталось ${weeklyRemaining} ${weeklyRemaining === 1 ? "шаг" : weeklyRemaining < 5 ? "шага" : "шагов"}`)
    }
    if (payload.stats.streakDays > 0) {
      todayFocus.push(`Серия: ${payload.stats.streakDays} дн. — не потеряйте!`)
    } else {
      todayFocus.push("Начните серию — выполните хотя бы 1 шаг сегодня")
    }
    if (payload.stats.activeCourses === 0) {
      todayFocus.push("Запишитесь на курс из каталога")
    }
    if (payload.deadline.title.startsWith("Следующий")) {
      todayFocus.push(payload.deadline.title)
    }
  }

  return (
    <MainLayout>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-6 px-4 md:px-0"
      >

        {/* Title */}
        <motion.h2
          variants={fadeInUp}
          className="text-2xl md:text-3xl font-bold"
        >
          Учебная панель
        </motion.h2>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {!loading && error && <Card><p className="text-sm text-red-700 dark:text-red-300">{error}</p></Card>}

        {!loading && !error && (
          <>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {stats.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.label}>
                <div className="flex items-center justify-between">
                  <p className="text-slate-500 text-sm">{item.label}</p>
                  <Icon size={16} className="text-red-600" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold mt-2">{item.value}</h3>
              </Card>
            )
          })}

        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          <Card className="space-y-3">
            <p className="text-sm text-slate-500">Продолжить обучение</p>
            {continueStep ? (
              <>
                <h3 className="text-lg font-bold">{continueStep.courseTitle}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Шаг {continueStep.stepOrder}: {continueStep.stepTitle}</p>
                <button
                  onClick={() => navigate(`/course/${continueStep.courseId}?step=${continueStep.stepId}`)}
                  className="text-sm font-semibold text-red-700 dark:text-red-300 inline-flex items-center gap-1"
                >
                  Продолжить <ArrowUpRight size={14} />
                </button>
              </>
            ) : (
              <EmptyState
                title="Все шаги в активных курсах пройдены"
                description="Откройте каталог и добавьте новый курс, чтобы сохранить темп обучения."
              />
            )}
          </Card>

          <Card className="space-y-3">
            <p className="text-sm text-slate-500">План на неделю</p>
            <div className="flex items-end justify-between gap-3">
              <h3 className="text-2xl font-bold">{completedWeeklySteps}/{weeklyGoal}</h3>
              <p className="text-xs text-slate-500">{weeklyPercent}% цели</p>
            </div>

            <label className="block">
              <span className="text-xs text-slate-500">Цель шагов на неделю (3-50)</span>
              <input
                type="number"
                min={3}
                max={50}
                value={weeklyGoal}
                onChange={(event) => updateWeeklyGoal(Number(event.target.value || 10))}
                className="mt-1 w-full md:max-w-[180px] rounded-xl glass-panel px-3 py-2 outline-none"
              />
            </label>

            <progress
              value={weeklyPercent}
              max={100}
              className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600 dark:[&::-webkit-progress-value]:bg-red-500"
            />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Осталось шагов до недельной цели: <span className="font-semibold">{weeklyRemaining}</span>
            </p>
            <p className="text-xs text-slate-500">Прогноз до завершения активных курсов: примерно {payload?.weeklyPlan.forecastDays ?? 0} дн.</p>
          </Card>
        </div>

        <Card className="space-y-2">
          <p className="text-sm font-semibold">Фокус на сегодня</p>
          {todayFocus.length > 0 ? todayFocus.map((item) => (
            <p key={item} className="text-sm text-slate-600 dark:text-slate-300">• {item}</p>
          )) : (
            <p className="text-sm text-slate-500">Загрузите данные панели</p>
          )}
        </Card>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Courses */}
          <div className="lg:col-span-2 space-y-4">

            <motion.h3 variants={fadeInUp} className="font-semibold">
              Мои курсы на этой неделе
            </motion.h3>

            {(payload?.courses ?? []).map((c) => (
              <Card
                key={c.id}
                className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between"
              >

                <div>
                  <h4 className="font-semibold">{c.title}</h4>
                  <p className="text-sm text-slate-500">
                    Текущий прогресс по курсу
                  </p>
                </div>

                <div className="w-full md:w-1/3">
                  <progress
                    value={c.progress}
                    max={100}
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600 dark:[&::-webkit-progress-value]:bg-red-500"
                  />
                  <p className="text-xs mt-2 text-slate-500">{c.progress}% завершено</p>
                </div>

                <button
                  onClick={() => navigate(`/course/${c.id}`)}
                  className="text-sm font-semibold text-red-700 dark:text-red-300 inline-flex items-center gap-1"
                >
                  Открыть <ArrowUpRight size={14} />
                </button>

              </Card>
            ))}

            {(payload?.courses ?? []).length === 0 && (
              <EmptyState
                title="Курсы пока не добавлены"
                description="Откройте каталог курсов и добавьте первый курс в обучение."
              />
            )}

          </div>

          {/* Activity */}
          <div className="space-y-4">

            <motion.h3 variants={fadeInUp} className="font-semibold">
              Лента активности
            </motion.h3>

            {(payload?.activities ?? []).map((item) => (
              <Card key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">{item.text}</p>
                  {item.time && <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{item.time}</span>}
                </div>
              </Card>
            ))}

            {(payload?.activities ?? []).length === 0 && (
              <EmptyState
                title="Лента активности пуста"
                description="После первых действий по курсам здесь появятся события."
              />
            )}

            <Card className="bg-gradient-to-r from-red-200/80 to-rose-300/80 dark:from-slate-800/70 dark:to-slate-700/70">
              <p className="text-sm font-semibold">{payload?.deadline.title}</p>
              <p className="text-xs mt-1 text-slate-600 dark:text-slate-300">{payload?.deadline.text}</p>
            </Card>

          </div>

        </div>

          </>
        )}

      </motion.div>

    </MainLayout>
  )
}