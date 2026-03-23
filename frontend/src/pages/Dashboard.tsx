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
  const [payload, setPayload] = useState<{
    stats: {
      activeCourses: number
      streakDays: number
      averageScore: string
      tasksWeek: number
    }
    courses: Array<{ id: number; title: string; progress: number }>
    activities: Array<{ id: number; text: string }>
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
          courses: Array<{ id: number; title: string; progress: number }>
          activities: Array<{ id: number; text: string }>
          deadline: { title: string; text: string }
        }>("/dashboard")
        setPayload(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить данные панели")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const stats = [
    { label: "Активные курсы", value: String(payload?.stats.activeCourses ?? 0), icon: Target },
    { label: "Серия", value: `${payload?.stats.streakDays ?? 0} дней`, icon: Flame },
    { label: "Средний балл", value: payload?.stats.averageScore ?? "0%", icon: Award },
    { label: "Задач за неделю", value: String(payload?.stats.tasksWeek ?? 0), icon: CalendarDays },
  ]

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
        {!loading && error && <Card><p className="text-sm text-red-700 dark:text-rose-300">{error}</p></Card>}

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
                    className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600 dark:[&::-webkit-progress-value]:bg-rose-600"
                  />
                  <p className="text-xs mt-2 text-slate-500">{c.progress}% завершено</p>
                </div>

                <button
                  onClick={() => navigate("/course")}
                  className="text-sm font-semibold text-red-700 dark:text-rose-300 inline-flex items-center gap-1"
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
                <p className="text-sm">{item.text}</p>
              </Card>
            ))}

            {(payload?.activities ?? []).length === 0 && (
              <EmptyState
                title="Лента активности пуста"
                description="После первых действий по курсам здесь появятся события."
              />
            )}

            <Card className="bg-gradient-to-r from-red-200/80 to-rose-300/80 dark:from-red-900/25 dark:to-rose-900/25">
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