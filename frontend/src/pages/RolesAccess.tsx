import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"

type Member = {
  id: number
  name: string
  role: "student" | "instructor" | "administrator" | "methodologist"
}

export default function RolesAccess() {
  const [members, setMembers] = useState<Member[]>([])
  const [invite, setInvite] = useState("")
  const [filter, setFilter] = useState<"all" | Member["role"]>("all")
  const [error, setError] = useState("")

  const loadMembers = async () => {
    try {
      const data = await api.get<Member[]>("/roles-members")
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить участников")
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMembers()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  const changeRole = async (id: number, role: Member["role"]) => {
    try {
      const updated = await api.patch<Member>(`/roles-members/${id}`, { role })
      setMembers((prev) => prev.map((item) => (item.id === id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить роль")
    }
  }

  const removeMember = async (id: number) => {
    try {
      await api.delete<{ success: boolean }>(`/roles-members/${id}`)
      setMembers((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить участника")
    }
  }

  const addInvite = async () => {
    if (!invite.trim()) {
      return
    }

    try {
      const created = await api.post<Member>("/roles-members", { name: invite.trim() })
      setMembers((prev) => [...prev, created])
      setInvite("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить участника")
    }
  }

  const filteredMembers = useMemo(() => {
    if (filter === "all") {
      return members
    }
    return members.filter((item) => item.role === filter)
  }, [members, filter])

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-6">
        <h2 className="text-2xl md:text-3xl font-bold">Роли и доступ</h2>

        <Card className="space-y-3">
          <p className="font-semibold">Пригласить участника</p>
          {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={invite}
              onChange={(event) => setInvite(event.target.value)}
              placeholder="Имя участника"
              className="w-full rounded-xl glass-input px-3 py-2"
            />
            <Button onClick={addInvite}>Добавить</Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p className="font-semibold">Команда проекта</p>
            <div className="flex gap-2">
              {(["all", "student", "instructor", "methodologist", "administrator"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`px-3 py-1.5 rounded-xl text-xs ${filter === item ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
                >
                  {item === "all" ? "все" : item === "student" ? "студенты" : item === "instructor" ? "преподаватели" : item === "methodologist" ? "методисты" : "администраторы"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {filteredMembers.map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-center glass-panel rounded-xl px-3 py-2">
                <p className="font-medium">{item.name}</p>
                <select
                  value={item.role}
                  onChange={(event) => changeRole(item.id, event.target.value as Member["role"])}
                  aria-label="Роль участника"
                  className="rounded-xl glass-input px-3 py-2"
                >
                  <option value="student">Студент</option>
                  <option value="instructor">Преподаватель</option>
                  <option value="methodologist">Методист</option>
                  <option value="administrator">Администратор</option>
                </select>
                <Button variant="outline" onClick={() => removeMember(item.id)}>Удалить</Button>
              </div>
            ))}
            {filteredMembers.length === 0 && <p className="text-sm text-slate-500">По выбранному фильтру участников нет.</p>}
          </div>
        </Card>
      </motion.div>
    </MainLayout>
  )
}
