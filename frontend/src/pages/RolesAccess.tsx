import { useEffect, useMemo, useState } from "react"
import MainLayout from "../layout/MainLayout"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import Skeleton from "../components/ui/Skeleton"
import { Users, GraduationCap, ShieldCheck, Search } from "lucide-react"

type Member = { id: number; name: string; role: "student" | "teacher" | "admin" }

const ROLE_LABELS: Record<Member["role"], string> = {
  student: "Студент",
  teacher: "Преподаватель",
  admin: "Администратор",
}

export default function RolesAccess() {
  const toast = useToast()
  const [members, setMembers] = useState<Member[]>([])
  const [filter, setFilter] = useState<"all" | Member["role"]>("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)

  useEffect(() => {
    api.get<Member[]>("/roles-members")
      .then(setMembers)
      .catch(() => toast.error("Не удалось загрузить участников"))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const base = filter === "all" ? members : members.filter(m => m.role === filter)
    const q = query.trim().toLowerCase()
    return q ? base.filter(m => m.name.toLowerCase().includes(q)) : base
  }, [members, filter, query])

  const changeRole = async (member: Member, role: Member["role"]) => {
    setActionId(member.id)
    try {
      const updated = await api.patch<Member>(`/roles-members/${member.id}`, { role })
      setMembers(prev => prev.map(m => m.id === member.id ? updated : m))
      toast.success("Роль обновлена")
    } catch { toast.error("Не удалось обновить роль") } finally { setActionId(null) }
  }

  const removeMember = async (id: number) => {
    if (!confirm("Удалить участника?")) return
    setActionId(id)
    try {
      await api.delete(`/roles-members/${id}`)
      setMembers(prev => prev.filter(m => m.id !== id))
      toast.success("Участник удалён")
    } catch { toast.error("Не удалось удалить") } finally { setActionId(null) }
  }

  const counts = useMemo(() => ({
    student: members.filter(m => m.role === "student").length,
    teacher: members.filter(m => m.role === "teacher").length,
    admin: members.filter(m => m.role === "admin").length,
  }), [members])

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()

  const roleColors: Record<Member["role"], string> = {
    student: "bg-blue-500",
    teacher: "bg-emerald-500",
    admin: "bg-primary",
  }

  const summaryCards = [
    { role: "student" as const, label: "Студенты", icon: Users, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200/60 dark:border-blue-800/40" },
    { role: "teacher" as const, label: "Преподаватели", icon: GraduationCap, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200/60 dark:border-emerald-800/40" },
    { role: "admin" as const, label: "Администраторы", icon: ShieldCheck, color: "text-primary", bg: "bg-[var(--bg-tint)]", border: "border-primary/20" },
  ]

  return (
    <MainLayout>
      <div className="space-y-6 lg:space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display">Роли и доступ</h1>
          <p className="text-[var(--muted)] mt-1">Управление участниками платформы</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summaryCards.map(s => (
            <div key={s.role} className="card p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                <s.icon size={22} className={s.color} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">{s.label}</p>
                <p className="text-3xl font-bold tracking-tight font-display mt-0.5">{counts[s.role]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters + search */}
        <div className="card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Поиск по имени…"
                className="input-field pl-9 pr-4 py-2.5 text-sm"
              />
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] self-start sm:self-auto">
              {([
                { v: "all", l: "Все" },
                { v: "student", l: "Студенты" },
                { v: "teacher", l: "Препод." },
                { v: "admin", l: "Админы" },
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

          {/* List */}
          {loading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && (
            <>
              {visible.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium text-[var(--muted)]">Никого не найдено</p>
                </div>
              )}
              <div className="divide-y divide-[var(--border)]">
                {visible.map(member => (
                  <div key={member.id} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                    <div className={`w-9 h-9 rounded-full ${roleColors[member.role]} flex items-center justify-center text-sm font-bold text-white shrink-0`}>
                      {getInitials(member.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)] truncate">{member.name}</p>
                      <p className="text-xs text-[var(--muted)]">{ROLE_LABELS[member.role]}</p>
                    </div>
                    <select
                      value={member.role}
                      onChange={e => changeRole(member, e.target.value as Member["role"])}
                      disabled={actionId === member.id}
                      aria-label="Роль"
                      className="input-field text-xs px-3 py-2 w-auto disabled:opacity-50"
                    >
                      <option value="student">Студент</option>
                      <option value="teacher">Преподаватель</option>
                      <option value="admin">Администратор</option>
                    </select>
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={actionId === member.id}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
