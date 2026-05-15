// кабинет преподавателя — управление своими курсами и заявками на запись
//
// КАК РАБОТАЕТ ЗАГРУЗКА:
//   этап 1 — Promise.all([overview, list]) — 2 запроса параллельно
//   этап 2 — Promise.all(list.map(async (c) => GET /teacher/courses/:id/enrollment-requests))
//     для каждого курса свой параллельный запрос, все идут одновременно
//     если один падает — catch возвращает пустой массив для этого курса, остальные не блокируются
//   filter(cr => cr.requests.length > 0) — скрываем курсы у которых вообще нет заявок
//
// КАК РАБОТАЕТ РЕШЕНИЕ ПО ЗАЯВКЕ:
//   decide(requestId, "approved"/"rejected")
//     → PATCH /teacher/enrollment-requests/:id { status, teacherComment }
//       → обновляем статус в локальном стейте через двойной map (по курсам, внутри по заявкам)
//         → очищаем черновик комментария для этой заявки через delete n[requestId]
//
// АККОРДЕОН ЗАЯВОК:
//   expandedCourse: number | null — id раскрытого курса или null если все закрыты
//   клик по заголовку: setExpandedCourse(isOpen ? null : cr.courseId)
//   null закрывает текущий, id открывает нужный — только один открыт одновременно
import { useEffect, useMemo, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Skeleton from "../components/ui/Skeleton"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { Link } from "react-router-dom"
import { BookOpen, Users, BarChart2, FileText, Plus, Send, UserCheck, ChevronDown, ChevronUp, Check, X } from "lucide-react"

// общая статистика по курсам преподавателя
type TeacherOverview = {
  courses: Array<{ id: number; title: string; progress: number; students: string; level: string; price: string }>
  stats: { assignments: number; reviews: number; avgProgress: number; publishedCount: number; draftCount: number }
}

// один курс в списке
type TeacherCourse = {
  id: number; title: string; type: string; level: string
  students: string; progress: number; published: boolean; status?: string
}

// заявка студента на запись в курс
type EnrollmentRequest = {
  id: number
  userId: number
  userName: string
  userEmail: string
  status: "pending" | "approved" | "rejected"
  message: string // сообщение от студента при подаче заявки
  teacherComment: string | null // комментарий преподавателя при решении
  createdAt: string
}

// заявки сгруппированные по курсу — удобнее показывать аккордеоном
type CourseRequests = {
  courseId: number
  courseTitle: string
  requests: EnrollmentRequest[]
}

export default function TeacherStudio() {
  const toast = useToast()
  const [data, setData] = useState<TeacherOverview | null>(null)
  const [courses, setCourses] = useState<TeacherCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all")
  const [actionId, setActionId] = useState<number | null>(null) // id запроса над которым идёт действие
  const [courseRequests, setCourseRequests] = useState<CourseRequests[]>([]) // заявки на запись
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null) // какой курс раскрыт в аккордеоне
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({}); // комментарии по каждой заявке

  // загружает все данные для кабинета преподавателя
  // этап 1: параллельно грузим overview (статистику) и список курсов
  // этап 2: для каждого курса параллельно запрашиваем заявки на запись
  //   GET /teacher/courses/:id/enrollment-requests → массив EnrollmentRequest
  //   если запрос упал — возвращаем пустой массив для этого курса (не блокируем всё)
  // в итоге показываем только курсы где есть хотя бы одна заявка
  const load = async () => {
    setLoading(true)
    try {
      const [overview, list] = await Promise.all([
        api.get<TeacherOverview>("/teacher/overview"),  // статистика по всем курсам преподавателя
        api.get<TeacherCourse[]>("/teacher/courses"),   // список его курсов
      ])
      setData(overview)
      setCourses(list)
      // грузим заявки на запись параллельно для всех курсов сразу
      const allRequests = await Promise.all(
        list.map(async (c) => {
          try {
            const reqs = await api.get<EnrollmentRequest[]>(`/teacher/courses/${c.id}/enrollment-requests`)
            return { courseId: c.id, courseTitle: c.title, requests: reqs }
          } catch { return { courseId: c.id, courseTitle: c.title, requests: [] } }
        })
      )
      // отфильтровываем курсы без заявок — нет смысла показывать пустые
      setCourseRequests(allRequests.filter(cr => cr.requests.length > 0))
    } catch { /* тихо */ } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  // суммарное количество ожидающих заявок — для счётчика в заголовке блока
  const pendingTotal = useMemo(() =>
    courseRequests.reduce((sum, cr) => sum + cr.requests.filter(r => r.status === "pending").length, 0),
    [courseRequests]
  )

  // одобрить или отклонить заявку — отправляем статус и комментарий
  const decide = async (requestId: number, status: "approved" | "rejected") => {
    setActionId(requestId)
    try {
      await api.patch(`/teacher/enrollment-requests/${requestId}`, {
        status,
        teacherComment: commentDrafts[requestId] || "",
      })
      // обновляем статус заявки в локальном стейте
      setCourseRequests(prev => prev.map(cr => ({
        ...cr,
        requests: cr.requests.map(r => r.id === requestId ? { ...r, status } : r),
      })))
      // очищаем черновик комментария для этой заявки
      setCommentDrafts(prev => { const n = { ...prev }; delete n[requestId]; return n })
      toast.success(status === "approved" ? "Заявка одобрена" : "Заявка отклонена")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  // фильтруем список курсов по вкладке
  const visible = filter === "all" ? courses
    : filter === "published" ? courses.filter(c => c.published)
    : courses.filter(c => !c.published)

  // отправить курс на модерацию — переводит в статус pending_review
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

        {/* заголовок с кнопкой создания нового курса */}
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

        {/* скелетон при загрузке */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {/* блок заявок на запись — виден только если есть pending заявки */}
        {!loading && pendingTotal > 0 && (
          <div className="card p-5 border-l-4 border-l-primary space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck size={17} className="text-primary" />
              <p className="text-sm font-bold font-display text-[var(--text)]">
                Заявки на запись · {pendingTotal}
              </p>
              <span className="w-2 h-2 rounded-full bg-primary ml-1" />
            </div>

            {/* аккордеон — один элемент на каждый курс у которого есть заявки */}
            <div className="space-y-2">
              {courseRequests.map(cr => {
                const pending = cr.requests.filter(r => r.status === "pending")
                if (pending.length === 0) return null // пропускаем курсы без pending заявок
                const isOpen = expandedCourse === cr.courseId
                return (
                  <div key={cr.courseId} className="rounded-xl border border-[var(--border)] overflow-hidden">
                    {/* шапка аккордеона — название курса + количество заявок */}
                    <button
                      onClick={() => setExpandedCourse(isOpen ? null : cr.courseId)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[var(--surface)] hover:bg-[var(--border)]/30 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-[var(--text)] truncate">{cr.courseTitle}</span>
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {pending.length} заявок
                        </span>
                      </div>
                      {isOpen ? <ChevronUp size={15} className="text-[var(--muted)] shrink-0" /> : <ChevronDown size={15} className="text-[var(--muted)] shrink-0" />}
                    </button>

                    {/* список заявок внутри раскрытого аккордеона */}
                    {isOpen && (
                      <div className="divide-y divide-[var(--border)]">
                        {pending.map(req => (
                          <div key={req.id} className="px-4 py-4 space-y-3 bg-[var(--bg)]">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[var(--text)]">{req.userName}</p>
                                <p className="text-xs text-[var(--muted)]">{req.userEmail}</p>
                                {/* сообщение от студента — показываем в кавычках */}
                                {req.message && (
                                  <p className="text-xs text-[var(--text)] mt-1.5 bg-[var(--surface)] px-3 py-2 rounded-lg border border-[var(--border)] italic">
                                    «{req.message}»
                                  </p>
                                )}
                              </div>
                              <p className="text-xs text-[var(--muted)] shrink-0">
                                {new Date(req.createdAt).toLocaleDateString("ru-RU")}
                              </p>
                            </div>
                            {/* комментарий + кнопки принять/отклонить */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                value={commentDrafts[req.id] ?? ""}
                                onChange={e => setCommentDrafts(prev => ({ ...prev, [req.id]: e.target.value }))}
                                placeholder="Комментарий (необязательно)"
                                className="input-field px-3 py-2 text-xs flex-1"
                              />
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => decide(req.id, "approved")}
                                  disabled={actionId === req.id}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                                >
                                  <Check size={13} />
                                  Принять
                                </button>
                                <button
                                  onClick={() => decide(req.id, "rejected")}
                                  disabled={actionId === req.id}
                                  className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50"
                                >
                                  <X size={13} />
                                  Отклонить
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && data && (
          <>
            {/* карточки статистики */}
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

            {/* список курсов с фильтром */}
            <div className="card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-base font-bold font-display">Мои курсы</h2>
                {/* переключатель фильтра — все/опубликованные/черновики */}
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

              {/* заглушка когда курсов нет */}
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
                  // нормализуем статус — может прийти и как поле status и как published boolean
                  const status = course.status || (course.published ? "published" : "draft")
                  return (
                    <div key={course.id} className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[var(--text)] truncate">{course.title}</p>
                          {/* бейдж статуса курса */}
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
                        {/* полоска прогресса — средний прогресс студентов */}
                        {course.progress > 0 && (
                          <div className="mt-2 h-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden w-40">
                            <div
                              className="h-full rounded-full transition-all duration-300"
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
                        {/* отправить на модерацию — только для черновиков */}
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
