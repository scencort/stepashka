import { useEffect, useMemo, useState } from "react"
import MainLayout from "../layout/MainLayout"
import Skeleton from "../components/ui/Skeleton"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { useAppStore } from "../store/AppStore"
import { Users, BookOpen, CheckCircle, MessageSquare, AlertTriangle, Search, Send, ChevronDown, ChevronUp } from "lucide-react"

type AdminOverview = {
  users: number; students: number; teachers: number; admins: number
  courses: number; publishedCourses: number; estimatedRevenue: number; moderationQueue: number
}
type AdminCourse = {
  id: number; title: string; author: string; students: string
  level: string; type: string; price: string; published: boolean; status: string
}
type AdminUser = { id: number; name: string; email: string; role: "student" | "teacher" | "admin" }
type FeedbackItem = {
  id: number; subject?: string; message: string
  status: "new" | "in_progress" | "closed"
  adminReply?: string; repliedBy?: number
  createdAt?: string
}

export default function AdminPanel() {
  const toast = useToast()
  const { user: currentUser } = useAppStore()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "pending_review">("all")
  const [courseQuery, setCourseQuery] = useState("")
  const [userFilter, setUserFilter] = useState<"all" | AdminUser["role"]>("all")
  const [userQuery, setUserQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [tab, setTab] = useState<"courses" | "users" | "feedback">("courses")
  const [expandedTicket, setExpandedTicket] = useState<number | null>(null)
  const [replyText, setReplyText] = useState<Record<number, string>>({})
  const [replyLoading, setReplyLoading] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [overview, adminCourses, adminUsers, feedback] = await Promise.all([
        api.get<AdminOverview>("/admin/overview"),
        api.get<AdminCourse[]>("/admin/courses"),
        api.get<AdminUser[]>("/admin/users"),
        api.get<FeedbackItem[]>("/feedback"),
      ])
      setData(overview); setCourses(adminCourses); setUsers(adminUsers); setFeedbackItems(feedback)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const pendingCourses = useMemo(() => courses.filter(c => c.status === "pending_review"), [courses])

  const visibleCourses = useMemo(() => {
    const base = filter === "all" ? courses
      : filter === "published" ? courses.filter(c => c.status === "published")
      : filter === "pending_review" ? courses.filter(c => c.status === "pending_review")
      : courses.filter(c => c.status === "draft")
    const q = courseQuery.trim().toLowerCase()
    return q ? base.filter(c => `${c.title} ${c.author}`.toLowerCase().includes(q)) : base
  }, [courses, filter, courseQuery])

  const visibleUsers = useMemo(() => {
    const base = userFilter === "all" ? users : users.filter(u => u.role === userFilter)
    const q = userQuery.trim().toLowerCase()
    return q ? base.filter(u => `${u.name} ${u.email}`.toLowerCase().includes(q)) : base
  }, [users, userFilter, userQuery])

  const feedbackNew = feedbackItems.filter(f => f.status === "new").length

  const moderateCourse = async (course: AdminCourse, action: "approve" | "reject") => {
    setActionId(course.id)
    try {
      const result = await api.patch<{ id: number; status: string }>(`/admin/courses/${course.id}/moderate`, { action })
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: result.status, published: result.status === "published" } : c))
      toast.success(action === "approve" ? "Курс опубликован" : "Курс отклонён")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const togglePublish = async (course: AdminCourse) => {
    setActionId(course.id)
    try {
      const result = await api.patch<{ id: number; published: boolean }>(`/admin/courses/${course.id}`, { published: !course.published })
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, published: result.published, status: result.published ? "published" : "draft" } : c))
      toast.success(result.published ? "Курс опубликован" : "Снят с публикации")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const removeCourse = async (id: number) => {
    if (!confirm("Удалить курс?")) return
    setActionId(id)
    try {
      await api.delete(`/admin/courses/${id}`)
      setCourses(prev => prev.filter(c => c.id !== id))
      toast.success("Курс удалён")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const changeUserRole = async (u: AdminUser, role: AdminUser["role"]) => {
    setActionId(u.id)
    try {
      const updated = await api.patch<AdminUser>(`/admin/users/${u.id}/role`, { role })
      setUsers(prev => prev.map(item => item.id === u.id ? updated : item))
      toast.success("Роль обновлена")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const sendReply = async (ticketId: number, closeAfter: boolean) => {
    const reply = (replyText[ticketId] || "").trim()
    if (!reply) return
    setReplyLoading(ticketId)
    try {
      const body: Record<string, string> = { reply }
      if (closeAfter) body.status = "closed"
      const updated = await api.post<FeedbackItem & { adminReply?: string; status: string }>(
        `/feedback/${ticketId}/reply`,
        body
      )
      setFeedbackItems(prev => prev.map(f => f.id === ticketId ? { ...f, ...updated } : f))
      setReplyText(prev => ({ ...prev, [ticketId]: "" }))
      toast.success(closeAfter ? "Ответ отправлен, обращение закрыто" : "Ответ отправлен")
    } catch { toast.error("Ошибка отправки ответа") } finally { setReplyLoading(null) }
  }

  const setStatus = async (ticketId: number, status: "new" | "in_progress" | "closed") => {
    setActionId(ticketId)
    try {
      const updated = await api.patch<FeedbackItem>(`/feedback/${ticketId}/status`, { status })
      setFeedbackItems(prev => prev.map(f => f.id === ticketId ? { ...f, ...updated } : f))
      toast.success("Статус обновлён")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const deleteFeedback = async (id: number) => {
    if (!confirm("Удалить обращение?")) return
    setActionId(id)
    try {
      await api.delete(`/feedback/${id}`)
      setFeedbackItems(prev => prev.filter(f => f.id !== id))
      toast.success("Обращение удалено")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const removeUser = async (id: number) => {
    if (!confirm("Удалить пользователя?")) return
    setActionId(id)
    try {
      await api.delete(`/admin/users/${id}`)
      setUsers(prev => prev.filter(u => u.id !== id))
      toast.success("Пользователь удалён")
    } catch { toast.error("Ошибка") } finally { setActionId(null) }
  }

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <MainLayout>
      <div className="space-y-6 lg:space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Панель администратора</h1>
          <p className="text-[var(--muted)] mt-1">Управление платформой</p>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        )}

        {!loading && data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Пользователей", value: data.users, icon: Users, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40" },
                { label: "Всего курсов", value: data.courses, icon: BookOpen, color: "text-[var(--muted)]", bg: "bg-[var(--surface)]", border: "border-[var(--border)]" },
                { label: "Опубликовано", value: data.publishedCourses, icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40" },
                {
                  label: "Обращений",
                  value: feedbackItems.length,
                  icon: MessageSquare,
                  color: "text-primary",
                  bg: "bg-[var(--bg-tint)]",
                  border: "border-primary/20",
                  badge: feedbackNew > 0 ? feedbackNew : null,
                },
              ].map(s => (
                <div key={s.label} className="card p-5 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide truncate">{s.label}</p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-bold tracking-tight font-display">{s.value}</span>
                      {(s as { badge?: number | null }).badge && (
                        <span className="badge-red text-[10px]">{(s as { badge?: number | null }).badge} новых</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Moderation queue */}
            {pendingCourses.length > 0 && (
              <div className="card p-5 border-l-4 border-l-amber-400 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={17} className="text-amber-500" />
                  <p className="text-sm font-bold font-display text-[var(--text)]">
                    На модерации · {pendingCourses.length}
                  </p>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-1" />
                </div>
                <div className="space-y-3">
                  {pendingCourses.map(course => (
                    <div key={course.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)]">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text)]">{course.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{course.author} · {course.level}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => moderateCourse(course, "approve")}
                          disabled={actionId === course.id}
                          className="btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
                        >
                          Опубликовать
                        </button>
                        <button
                          onClick={() => moderateCourse(course, "reject")}
                          disabled={actionId === course.id}
                          className="btn-ghost text-xs px-4 py-1.5 disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="card p-6 space-y-5">
              <div className="flex gap-1 border-b border-[var(--border)] -mx-6 px-6">
                {([
                  { v: "courses", l: `Курсы (${courses.length})` },
                  { v: "users", l: `Пользователи (${users.length})` },
                  { v: "feedback", l: `Обращения${feedbackNew > 0 ? ` (${feedbackNew})` : feedbackItems.length > 0 ? ` (${feedbackItems.length})` : ""}` },
                ] as const).map(t => (
                  <button
                    key={t.v}
                    onClick={() => setTab(t.v)}
                    className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-200 ${
                      tab === t.v
                        ? "border-primary text-primary"
                        : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t.l}
                  </button>
                ))}
              </div>

              {/* Courses tab */}
              {tab === "courses" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                      <input
                        value={courseQuery}
                        onChange={e => setCourseQuery(e.target.value)}
                        placeholder="Поиск по названию или автору…"
                        className="input-field pl-9 pr-4 py-2.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] self-start">
                      {([
                        { v: "all", l: "Все" },
                        { v: "pending_review", l: "Модерация" },
                        { v: "published", l: "Опубликованы" },
                        { v: "draft", l: "Черновики" },
                      ] as const).map(f => (
                        <button
                          key={f.v}
                          onClick={() => setFilter(f.v)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            filter === f.v ? "btn-gradient shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"
                          }`}
                        >
                          {f.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {visibleCourses.length === 0 && (
                    <p className="text-sm text-[var(--muted)] py-6 text-center">Ничего не найдено</p>
                  )}

                  <div className="divide-y divide-[var(--border)]">
                    {visibleCourses.map(course => (
                      <div key={course.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text)] truncate">{course.title}</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">{course.author} · {course.level} · {course.students} студентов</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            course.status === "published"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : course.status === "pending_review"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                          }`}>
                            {course.status === "published" ? "Опубликован" : course.status === "pending_review" ? "Модерация" : "Черновик"}
                          </span>
                          {course.status === "pending_review" ? (
                            <div className="flex gap-2">
                              <button onClick={() => moderateCourse(course, "approve")} disabled={actionId === course.id} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">Принять</button>
                              <button onClick={() => moderateCourse(course, "reject")} disabled={actionId === course.id} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] px-2 py-1 rounded-lg transition-colors disabled:opacity-50">Отклонить</button>
                            </div>
                          ) : (
                            <button onClick={() => togglePublish(course)} disabled={actionId === course.id} className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                              {course.published ? "Снять" : "Опубликовать"}
                            </button>
                          )}
                          <button onClick={() => removeCourse(course.id)} disabled={actionId === course.id} className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-colors disabled:opacity-50">Удалить</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users tab */}
              {tab === "users" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                      <input
                        value={userQuery}
                        onChange={e => setUserQuery(e.target.value)}
                        placeholder="Поиск по имени или email…"
                        className="input-field pl-9 pr-4 py-2.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] self-start">
                      {([
                        { v: "all", l: "Все" },
                        { v: "student", l: "Студенты" },
                        { v: "teacher", l: "Препод." },
                        { v: "admin", l: "Админы" },
                      ] as const).map(f => (
                        <button
                          key={f.v}
                          onClick={() => setUserFilter(f.v)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            userFilter === f.v ? "btn-gradient shadow-sm" : "text-[var(--muted)] hover:text-[var(--text)]"
                          }`}
                        >
                          {f.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {visibleUsers.length === 0 && (
                    <p className="text-sm text-[var(--muted)] py-6 text-center">Ничего не найдено</p>
                  )}

                  <div className="divide-y divide-[var(--border)]">
                    {visibleUsers.map(u => {
                      const isCurrent = currentUser?.id === u.id
                      return (
                        <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-200 to-burgundy-200 dark:from-primary-800 dark:to-burgundy-700 flex items-center justify-center text-xs font-bold text-primary-800 dark:text-primary-200 shrink-0">
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-[var(--text)] truncate">{u.name}</p>
                                {isCurrent && <span className="badge-neutral text-[10px]">вы</span>}
                              </div>
                              <p className="text-xs text-[var(--muted)]">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <select
                              value={u.role}
                              onChange={e => changeUserRole(u, e.target.value as AdminUser["role"])}
                              disabled={actionId === u.id || isCurrent}
                              className="input-field text-xs px-3 py-2 w-auto disabled:opacity-50"
                            >
                              <option value="student">Студент</option>
                              <option value="teacher">Преподаватель</option>
                              <option value="admin">Администратор</option>
                            </select>
                            {!isCurrent && (
                              <button
                                onClick={() => removeUser(u.id)}
                                disabled={actionId === u.id}
                                className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Feedback tab */}
              {tab === "feedback" && (
                <div className="space-y-3">
                  {feedbackItems.length === 0 && (
                    <div className="py-10 text-center">
                      <MessageSquare size={32} className="mx-auto text-[var(--border)] mb-3" />
                      <p className="text-sm text-[var(--muted)]">Обращений нет</p>
                    </div>
                  )}
                  {feedbackItems.map(ticket => {
                    const isExpanded = expandedTicket === ticket.id
                    const statusMeta = {
                      new: { label: "Новое", cls: "bg-primary/10 text-primary border-primary/20" },
                      in_progress: { label: "В работе", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40" },
                      closed: { label: "Закрыто", cls: "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]" },
                    }[ticket.status] ?? { label: ticket.status, cls: "bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]" }

                    return (
                      <div key={ticket.id} className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        ticket.status === "new" ? "border-primary/30 bg-[var(--bg-tint)]" : "border-[var(--border)] bg-[var(--bg)]"
                      }`}>
                        {/* Ticket header */}
                        <button
                          className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-[var(--surface)] transition-colors"
                          onClick={() => setExpandedTicket(isExpanded ? null : ticket.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-[var(--text)]">
                                {ticket.subject || "Обращение #" + ticket.id}
                              </p>
                              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${statusMeta.cls}`}>
                                {statusMeta.label}
                              </span>
                              {ticket.adminReply && (
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold border bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40">
                                  Отвечено
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--muted)] mt-1 truncate">{ticket.message}</p>
                          </div>
                          <div className="shrink-0 text-[var(--muted)] mt-0.5">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="px-5 pb-5 space-y-4 border-t border-[var(--border)]">
                            {/* Full message */}
                            <div className="pt-4">
                              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Сообщение</p>
                              <p className="text-sm text-[var(--text)] bg-[var(--surface)] rounded-xl px-4 py-3 border border-[var(--border)] leading-relaxed whitespace-pre-wrap break-words">
                                {ticket.message}
                              </p>
                            </div>

                            {/* Status switcher */}
                            <div>
                              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Статус</p>
                              <div className="flex gap-2 flex-wrap">
                                {([
                                  { v: "new", l: "Новое", cls: "border-primary/30 text-primary bg-primary/10 hover:bg-primary/20" },
                                  { v: "in_progress", l: "В работе", cls: "border-amber-300/60 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30" },
                                  { v: "closed", l: "Закрыто", cls: "border-emerald-300/60 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" },
                                ] as const).map(s => (
                                  <button
                                    key={s.v}
                                    onClick={() => setStatus(ticket.id, s.v)}
                                    disabled={ticket.status === s.v || actionId === ticket.id}
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-default ${
                                      ticket.status === s.v
                                        ? s.cls + " ring-2 ring-offset-1 ring-current/30"
                                        : "border-[var(--border)] text-[var(--muted)] bg-[var(--surface)] hover:text-[var(--text)] hover:bg-[var(--border)]/40"
                                    }`}
                                  >
                                    {ticket.status === s.v ? "✓ " : ""}{s.l}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Existing reply */}
                            {ticket.adminReply && (
                              <div>
                                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Текущий ответ</p>
                                <p className="text-sm text-[var(--text)] bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap break-words">
                                  {ticket.adminReply}
                                </p>
                              </div>
                            )}

                            {/* Reply form */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                                {ticket.adminReply ? "Обновить ответ" : "Ответить"}
                              </p>
                              <textarea
                                rows={3}
                                placeholder="Введите ответ пользователю…"
                                value={replyText[ticket.id] || ""}
                                onChange={e => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                                className="input-field px-4 py-3 text-sm resize-none"
                              />
                              <div className="flex gap-2 flex-wrap items-center">
                                <button
                                  onClick={() => sendReply(ticket.id, false)}
                                  disabled={!replyText[ticket.id]?.trim() || replyLoading === ticket.id}
                                  className="btn-primary text-xs px-4 py-2 gap-1.5 disabled:opacity-50"
                                >
                                  <Send size={12} />
                                  {replyLoading === ticket.id ? "Отправка…" : "Ответить"}
                                </button>
                                <button
                                  onClick={() => sendReply(ticket.id, true)}
                                  disabled={!replyText[ticket.id]?.trim() || replyLoading === ticket.id}
                                  className="btn-ghost text-xs px-4 py-2 gap-1.5 disabled:opacity-50"
                                >
                                  <Send size={12} />
                                  Ответить и закрыть
                                </button>
                                <button
                                  onClick={() => deleteFeedback(ticket.id)}
                                  disabled={actionId === ticket.id}
                                  className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ml-auto"
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  )
}
