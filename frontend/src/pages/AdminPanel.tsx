import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Skeleton from "../components/ui/Skeleton"
import EmptyState from "../components/ui/EmptyState"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"
import Button from "../components/ui/Button"
import { useToast } from "../hooks/useToast"
import { useAppStore } from "../store/AppStore"

type AdminOverview = {
  users: number
  students: number
  teachers: number
  admins: number
  courses: number
  publishedCourses: number
  estimatedRevenue: number
  moderationQueue: number
}

type AdminCourse = {
  id: number
  title: string
  author: string
  students: string
  level: string
  type: string
  price: string
  published: boolean
}

type AdminUser = {
  id: number
  name: string
  email: string
  role: "student" | "teacher" | "admin"
}

type FeedbackItem = {
  id: number
  message: string
  status: "new" | "in progress" | "closed"
}

type AdminAnalytics = {
  kpi: {
    users: number
    activeUsers: number
    conversionRate: number
    mrr: number
  }
  funnel: Array<{ stage: string; value: number }>
  retention: number[]
  topCourses: Array<{ id: number; title: string; progress: number; students: string }>
}

export default function AdminPanel() {
  const toast = useToast()
  const { user: currentUser } = useAppStore()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null)
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all")
  const [courseQuery, setCourseQuery] = useState("")
  const [userFilter, setUserFilter] = useState<"all" | AdminUser["role"]>("all")
  const [userQuery, setUserQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [overview, adminCourses, adminUsers, feedback, analyticsResponse] = await Promise.all([
        api.get<AdminOverview>("/admin/overview"),
        api.get<AdminCourse[]>("/admin/courses"),
        api.get<AdminUser[]>("/admin/users"),
        api.get<FeedbackItem[]>("/feedback"),
        api.get<AdminAnalytics>("/admin/analytics"),
      ])
      setData(overview)
      setCourses(adminCourses)
      setUsers(adminUsers)
      setFeedbackItems(feedback)
      setAnalytics(analyticsResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleCourses = useMemo(() => {
    const filtered =
      filter === "all"
        ? courses
        : filter === "published"
          ? courses.filter((item) => item.published)
          : courses.filter((item) => !item.published)

    const q = courseQuery.trim().toLowerCase()
    if (!q) {
      return filtered
    }

    return filtered.filter((item) => {
      const haystack = `${item.title} ${item.author} ${item.type} ${item.level}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [courses, filter, courseQuery])

  const visibleUsers = useMemo(() => {
    const filtered = userFilter === "all" ? users : users.filter((item) => item.role === userFilter)
    const q = userQuery.trim().toLowerCase()
    if (!q) {
      return filtered
    }

    return filtered.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(q))
  }, [users, userFilter, userQuery])

  const feedbackStats = useMemo(() => {
    const total = feedbackItems.length
    const opened = feedbackItems.filter((item) => item.status === "new").length
    const inProgress = feedbackItems.filter((item) => item.status === "in progress").length
    const closed = feedbackItems.filter((item) => item.status === "closed").length
    return { total, opened, inProgress, closed }
  }, [feedbackItems])

  const togglePublish = async (course: AdminCourse) => {
    setActionId(course.id)
    try {
      const result = await api.patch<{ id: number; published: boolean }>(`/admin/courses/${course.id}`, {
        published: !course.published,
      })
      setCourses((prev) => prev.map((item) => (item.id === course.id ? { ...item, published: result.published } : item)))
      await load()
      toast.success(result.published ? "Курс опубликован" : "Курс снят с публикации")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить курс"
      setError(message)
      toast.error(message)
    } finally {
      setActionId(null)
    }
  }

  const removeCourse = async (courseId: number) => {
    setActionId(courseId)
    try {
      await api.delete<{ success: boolean }>(`/admin/courses/${courseId}`)
      setCourses((prev) => prev.filter((item) => item.id !== courseId))
      await load()
      toast.success("Курс удален")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось удалить курс"
      setError(message)
      toast.error(message)
    } finally {
      setActionId(null)
    }
  }

  const changeUserRole = async (targetUser: AdminUser, nextRole: AdminUser["role"]) => {
    setActionId(targetUser.id)
    try {
      const updated = await api.patch<AdminUser>(`/admin/users/${targetUser.id}`, { role: nextRole })
      setUsers((prev) => prev.map((item) => (item.id === targetUser.id ? updated : item)))
      await load()
      toast.success("Роль пользователя обновлена")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить роль"
      setError(message)
      toast.error(message)
    } finally {
      setActionId(null)
    }
  }

  const removeUser = async (userId: number) => {
    setActionId(userId)
    try {
      await api.delete<{ success: boolean }>(`/admin/users/${userId}`)
      setUsers((prev) => prev.filter((item) => item.id !== userId))
      await load()
      toast.success("Пользователь удален")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось удалить пользователя"
      setError(message)
      toast.error(message)
    } finally {
      setActionId(null)
    }
  }

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <h2 className="text-2xl font-bold">Админ-панель</h2>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!loading && error && <EmptyState title="Не удалось загрузить данные" description={error} />}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-slate-500">Пользователи</p>
                <p className="text-2xl font-bold">{data.users}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Студенты</p>
                <p className="text-2xl font-bold">{data.students}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Преподаватели</p>
                <p className="text-2xl font-bold">{data.teachers}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Администраторы</p>
                <p className="text-2xl font-bold">{data.admins}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-slate-500">Обращений всего</p>
                <p className="text-2xl font-bold">{feedbackStats.total}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Новые</p>
                <p className="text-2xl font-bold">{feedbackStats.opened}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">В работе</p>
                <p className="text-2xl font-bold">{feedbackStats.inProgress}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Закрытые</p>
                <p className="text-2xl font-bold">{feedbackStats.closed}</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <p className="text-sm text-slate-500">Всего курсов</p>
                <p className="text-2xl font-bold">{data.courses}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Опубликовано</p>
                <p className="text-2xl font-bold">{data.publishedCourses}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Очередь модерации</p>
                <p className="text-2xl font-bold">{data.moderationQueue}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Ожидаемая выручка</p>
                <p className="text-2xl font-bold">{new Intl.NumberFormat("ru-RU").format(data.estimatedRevenue)} ₽</p>
              </Card>
            </div>

            {analytics && (
              <Card className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <p className="font-semibold">Управленческая аналитика</p>
                  <p className="text-xs text-slate-500">MRR, conversion, retention</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-xl glass-panel p-3">
                    <p className="text-xs text-slate-500">Active users</p>
                    <p className="text-xl font-bold">{analytics.kpi.activeUsers}</p>
                  </div>
                  <div className="rounded-xl glass-panel p-3">
                    <p className="text-xs text-slate-500">Conversion</p>
                    <p className="text-xl font-bold">{analytics.kpi.conversionRate}%</p>
                  </div>
                  <div className="rounded-xl glass-panel p-3">
                    <p className="text-xs text-slate-500">MRR</p>
                    <p className="text-xl font-bold">{new Intl.NumberFormat("ru-RU").format(analytics.kpi.mrr)} ₽</p>
                  </div>
                  <div className="rounded-xl glass-panel p-3">
                    <p className="text-xs text-slate-500">Total users</p>
                    <p className="text-xl font-bold">{analytics.kpi.users}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Retention trend</p>
                    {analytics.retention.map((value, index) => (
                      <div key={`retention-${index}`}>
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                          <span>Когорта {index + 1}</span>
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

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Funnel</p>
                    {analytics.funnel.map((item) => {
                      const max = analytics.funnel[0]?.value || 1
                      return (
                        <div key={item.stage} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{item.stage}</span>
                            <span>{item.value}</span>
                          </div>
                          <progress
                            value={item.value}
                            max={max}
                            className="w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600 dark:[&::-webkit-progress-value]:bg-rose-600"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Top courses by progress</p>
                  {analytics.topCourses.map((item) => (
                    <div key={item.id} className="rounded-xl glass-panel p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.students} студентов • прогресс {item.progress}%</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="font-semibold">Модерация курсов</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={courseQuery}
                    onChange={(event) => setCourseQuery(event.target.value)}
                    placeholder="Поиск курса"
                    className="rounded-xl glass-panel px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    {([
                      { value: "all", label: "все" },
                      { value: "published", label: "опубликованные" },
                      { value: "draft", label: "черновики" },
                    ] as const).map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setFilter(item.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs ${filter === item.value ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {visibleCourses.map((course) => (
                  <div key={course.id} className="glass-panel rounded-xl p-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                      <div>
                        <p className="font-semibold">{course.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {course.type} • {course.level} • {course.author} • {course.students} студентов • {course.price}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-xs px-2 py-1 rounded-lg ${course.published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {course.published ? "опубликован" : "черновик"}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() => togglePublish(course)}
                          disabled={actionId === course.id}
                        >
                          {course.published ? "Снять с публикации" : "Опубликовать"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => removeCourse(course.id)}
                          disabled={actionId === course.id}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {visibleCourses.length === 0 && (
                  <p className="text-sm text-slate-500">По выбранному фильтру курсов нет.</p>
                )}
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <p className="font-semibold">Управление пользователями</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    placeholder="Поиск пользователя"
                    className="rounded-xl glass-panel px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    {([
                      { value: "all", label: "все" },
                      { value: "student", label: "студенты" },
                      { value: "teacher", label: "преподаватели" },
                      { value: "admin", label: "админы" },
                    ] as const).map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setUserFilter(item.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs ${userFilter === item.value ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {visibleUsers.map((item) => {
                  const isCurrent = currentUser?.id === item.id
                  return (
                    <div key={item.id} className="glass-panel rounded-xl p-3">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-xs text-slate-500 mt-1">{item.email}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={item.role}
                            onChange={(event) => changeUserRole(item, event.target.value as AdminUser["role"])}
                            aria-label="Роль пользователя"
                            disabled={actionId === item.id || isCurrent}
                            className="rounded-xl glass-panel px-3 py-2 outline-none text-sm"
                          >
                            <option value="student">Студент</option>
                            <option value="teacher">Преподаватель</option>
                            <option value="admin">Администратор</option>
                          </select>

                          <Button
                            variant="outline"
                            onClick={() => removeUser(item.id)}
                            disabled={actionId === item.id || isCurrent}
                          >
                            Удалить
                          </Button>

                          {isCurrent && <span className="text-xs text-slate-500">текущий аккаунт</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {visibleUsers.length === 0 && (
                  <p className="text-sm text-slate-500">По выбранному фильтру пользователей нет.</p>
                )}
              </div>
            </Card>
          </>
        )}
      </motion.div>
    </MainLayout>
  )
}
