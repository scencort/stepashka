import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Skeleton from "../components/ui/Skeleton"
import EmptyState from "../components/ui/EmptyState"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { Link } from "react-router-dom"

type TeacherOverview = {
  courses: Array<{
    id: number
    title: string
    progress: number
    students: string
    level: string
    price: string
  }>
  stats: {
    assignments: number
    reviews: number
    avgProgress: number
    publishedCount: number
    draftCount: number
  }
}

type TeacherCourse = {
  id: number
  title: string
  type: string
  level: string
  students: string
  progress: number
  published: boolean
}

export default function TeacherStudio() {
  const toast = useToast()
  const [data, setData] = useState<TeacherOverview | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [courseFilter, setCourseFilter] = useState<"all" | "published" | "draft">("all")
  const [actionId, setActionId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [response, teacherCourses] = await Promise.all([
        api.get<TeacherOverview>("/teacher/overview"),
        api.get<TeacherCourse[]>("/teacher/courses"),
      ])
      setData(response)
      setCourses(teacherCourses)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const visibleCourses =
    courseFilter === "all"
      ? courses
      : courseFilter === "published"
        ? courses.filter((item) => item.published)
        : courses.filter((item) => !item.published)

  const togglePublish = async (course: TeacherCourse) => {
    setActionId(course.id)
    setError("")
    try {
      const response = await api.patch<{ id: number; published: boolean }>(`/teacher/courses/${course.id}`, {
        published: !course.published,
      })
      setCourses((prev) => prev.map((item) => (item.id === response.id ? { ...item, published: response.published } : item)))
      await load()
      toast.success(response.published ? "Курс отправлен в публикацию" : "Курс переведен в черновик")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось изменить публикацию"
      setError(message)
      toast.error(message)
    } finally {
      setActionId(null)
    }
  }

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <h2 className="text-2xl font-bold">Кабинет преподавателя</h2>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {!loading && error && <EmptyState title="Не удалось загрузить данные" description={error} />}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <p className="text-sm text-slate-500">Заданий в системе</p>
                <p className="text-2xl font-bold">{data.stats.assignments}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">AI reviews</p>
                <p className="text-2xl font-bold">{data.stats.reviews}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Средний прогресс</p>
                <p className="text-2xl font-bold">{data.stats.avgProgress}%</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Опубликовано</p>
                <p className="text-2xl font-bold">{data.stats.publishedCount}</p>
              </Card>
              <Card>
                <p className="text-sm text-slate-500">Черновики</p>
                <p className="text-2xl font-bold">{data.stats.draftCount}</p>
              </Card>
            </div>

            <Card className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Pipeline преподавателя</h3>
                  <p className="text-sm text-slate-500">Быстрый контроль этапов: черновик, публикация, задания и прогресс студентов.</p>
                </div>
                <Link to="/teacher/assignments">
                  <Button>Открыть конструктор заданий</Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl glass-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">1. Подготовка контента</p>
                  <p className="font-medium mt-1">Соберите outline курса и тестовые сценарии</p>
                </div>
                <div className="rounded-xl glass-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">2. Публикация</p>
                  <p className="font-medium mt-1">Переводите курсы из draft в published одной кнопкой</p>
                </div>
                <div className="rounded-xl glass-panel p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">3. Оптимизация</p>
                  <p className="font-medium mt-1">Отслеживайте прогресс и улучшайте удержание студентов</p>
                </div>
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h3 className="font-semibold">Мои курсы</h3>
                <div className="flex gap-2">
                  {([
                    { value: "all", label: "Все" },
                    { value: "published", label: "Опубликованные" },
                    { value: "draft", label: "Черновики" },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setCourseFilter(item.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs ${courseFilter === item.value ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {visibleCourses.map((course) => (
                  <div key={course.id} className="glass-panel rounded-xl p-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <p className="font-medium">{course.title}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {course.level} • {course.type}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Студентов: {course.students}</p>
                    <progress
                      value={course.progress}
                      max={100}
                      className="mt-2 w-full h-2 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-slate-200/70 dark:[&::-webkit-progress-bar]:bg-slate-700/70 [&::-webkit-progress-value]:bg-red-600 dark:[&::-webkit-progress-value]:bg-rose-600"
                    />
                  </div>
                ))}

                {visibleCourses.length === 0 && (
                  <p className="text-sm text-slate-500">Курсы по выбранному фильтру не найдены.</p>
                )}
              </div>
            </Card>
          </>
        )}
      </motion.div>
    </MainLayout>
  )
}
