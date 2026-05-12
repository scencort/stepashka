import { useEffect, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Skeleton from "../components/ui/Skeleton"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { Link } from "react-router-dom"
import { BookOpen, Users, BarChart2, FileText, Plus, Send } from "lucide-react"

type TeacherOverview = {
  courses: Array<{ id: number; title: string; progress: number; students: string; level: string; price: string }>
  stats: { assignments: number; reviews: number; avgProgress: number; publishedCount: number; draftCount: number }
}

type TeacherCourse = {
  id: number; title: string; type: string; level: string
  students: string; progress: number; published: boolean; status?: string
}

export default function TeacherStudio() {
  const toast = useToast()
  const [data, setData] = useState<TeacherOverview | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all")
  const [actionId, setActionId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [overview, list] = await Promise.all([
        api.get<TeacherOverview>("/teacher/overview"),
        api.get<TeacherCourse[]>("/teacher/courses"),
      ])
      setData(overview)
      setCourses(list)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const visible = filter === "all" ? courses
    : filter === "published" ? courses.filter(c => c.published)
    : courses.filter(c => !c.published)

  const sendToModeration = async (course: TeacherCourse) => {
    setActionId(course.id)
    try {
      await api.patch(`/teacher/courses/${course.id}/publish`, { status: "pending_review" })
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, published: false, status: "pending_review" } : c))
      toast.success("Отправлено на модерацию")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  return (
    <MainLayout>
      <div className="space-y-6 lg:space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-display">Кабинет преподавателя</h1>
            <p className="text-[var(--muted)] mt-1">Управление курсами и контентом</p>
          </div>
          <Link
            to="/teacher/courses/new"
            className="btn-primary px-5 py-2.5 text-sm self-start sm:self-auto"
          >
            <Plus size={16} />
            Создать курс
          </Link>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Опубликовано",
                  value: data.stats.publishedCount,
                  icon: BookOpen,
                  color: "text-emerald-500",
                  bg: "bg-emerald-50 dark:bg-emerald-900/20",
                  border: "border-emerald-200/60 dark:border-emerald-800/40",
                },
                {
                  label: "Черновики",
                  value: data.stats.draftCount,
                  icon: FileText,
                  color: "text-[var(--muted)]",
                  bg: "bg-[var(--surface)]",
                  border: "border-[var(--border)]",
                },
                {
                  label: "Ср. прогресс",
                  value: `${data.stats.avgProgress}%`,
                  icon: BarChart2,
                  color: "text-primary",
                  bg: "bg-[var(--bg-tint)]",
                  border: "border-primary/20",
                },
                {
                  label: "Заданий",
                  value: data.stats.assignments,
                  icon: Users,
                  color: "text-amber-500",
                  bg: "bg-amber-50 dark:bg-amber-900/20",
                  border: "border-amber-200/60 dark:border-amber-800/40",
                },
              ].map(s => (
                <div key={s.label} className="card p-5 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide truncate">{s.label}</p>
                    <p className="text-2xl font-bold tracking-tight font-display mt-0.5">{s.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Courses */}
            <div className="card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-base font-bold font-display">Мои курсы</h2>
                <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] self-start sm:self-auto">
                  {([
                    { v: "all", l: "Все" },
                    { v: "published", l: "Опубликованы" },
                    { v: "draft", l: "Черновики" },
                  ] as const).map(f => (
                    <button
                      key={f.v}
                      onClick={() => setFilter(f.v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        filter === f.v
                          ? "btn-gradient shadow-sm"
                          : "text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length === 0 && (
                <div className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tint)] border border-primary/20 flex items-center justify-center">
                    <BookOpen size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text)]">Курсов нет</p>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {courses.length === 0
                        ? "Создайте первый курс, нажав кнопку выше"
                        : "Нет курсов по выбранному фильтру"}
                    </p>
                  </div>
                </div>
              )}

              <div className="divide-y divide-[var(--border)]">
                {visible.map(course => {
                  const status = course.status || (course.published ? "published" : "draft")
                  return (
                    <div key={course.id} className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[var(--text)] truncate">{course.title}</p>
                          <span className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            status === "published"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : status === "pending_review"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                          }`}>
                            {status === "published" ? "Опубликован" : status === "pending_review" ? "На модерации" : "Черновик"}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1">{course.level} · {course.students} студентов</p>
                        {course.progress > 0 && (
                          <div className="mt-2 h-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden w-40">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${course.progress}%`,
                                background: "linear-gradient(135deg, var(--btn-grad-from) 0%, var(--btn-grad-to) 100%)",
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link
                          to={`/teacher/courses/${course.id}/edit`}
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          Редактировать
                        </Link>
                        {status === "draft" && (
                          <button
                            onClick={() => sendToModeration(course)}
                            disabled={actionId === course.id}
                            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                          >
                            <Send size={13} />
                            На модерацию
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  )
}
