import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useSearchParams } from "react-router-dom"
import MainLayout from "../layout/MainLayout"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { fadeInUp } from "../lib/animations"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { useAppStore } from "../store/AppStore"

type AccountProfile = {
  id: number
  name: string
  email: string
  role: "student" | "teacher" | "admin"
  avatarUrl?: string
  phone: string
  bio: string
  timezone: string
  language: string
  emailNotifications: boolean
  marketingNotifications: boolean
  twoFactorEnabled?: boolean
  pendingEmail?: string | null
}

type AccountSession = {
  id: number
  userAgent: string
  ipAddress: string
  lastUsedAt: string
  expiresAt: string
  createdAt: string
}

type ProfileErrors = {
  name?: string
  email?: string
  phone?: string
  timezone?: string
}

export default function AccountSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get("tab") || "profile") as "profile" | "settings" | "security" | "sessions"
  const toast = useToast()
  const { refreshUser, logout } = useAppStore()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState("")
  const [sessions, setSessions] = useState<AccountSession[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [error, setError] = useState("")
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [emailConfirmCode, setEmailConfirmCode] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [disable2faPassword, setDisable2faPassword] = useState("")

  const formatDateTime = (value: string, tz: string) => {
    try {
      return new Intl.DateTimeFormat(profile?.language === "en" ? "en-US" : "ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: tz || "Europe/Moscow",
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const validateProfile = (value: AccountProfile | null): ProfileErrors => {
    if (!value) {
      return {}
    }

    const next: ProfileErrors = {}

    if (value.name.trim().length < 2) {
      next.name = "Минимум 2 символа"
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) {
      next.email = "Введите корректный email"
    }

    if (value.phone.trim() && !/^[+()\d\s-]{7,20}$/.test(value.phone.trim())) {
      next.phone = "Телефон содержит недопустимые символы"
    }

    if (!value.timezone.trim()) {
      next.timezone = "Укажите timezone"
    }

    return next
  }

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const data = await api.get<AccountSession[]>("/account/sessions")
      setSessions(data)
    } catch {
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await api.get<AccountProfile>("/account/profile")
      setProfile(data)
      setInitialSnapshot(JSON.stringify(data))
      setProfileErrors(validateProfile(data))
      await refreshSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить профиль")
    } finally {
      setLoading(false)
    }
  }, [refreshSessions])

  useEffect(() => {
    void load()
  }, [load])

  const isDirty = useMemo(() => {
    if (!profile || !initialSnapshot) {
      return false
    }
    return JSON.stringify(profile) !== initialSnapshot
  }, [initialSnapshot, profile])

  const hasProfileErrors = Object.keys(profileErrors).length > 0

  const setTab = (tab: "profile" | "settings" | "security" | "sessions") => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", tab)
    setSearchParams(next)
  }

  const updateProfileField = <K extends keyof AccountProfile>(key: K, value: AccountProfile[K]) => {
    setProfile((prev) => {
      if (!prev) {
        return prev
      }
      const next = { ...prev, [key]: value }
      setProfileErrors(validateProfile(next))
      return next
    })
  }

  const saveProfile = async () => {
    if (!profile) {
      return
    }

    const nextErrors = validateProfile(profile)
    setProfileErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Исправьте ошибки в профиле")
      return
    }

    setSaving(true)
    setError("")
    try {
      const updated = await api.patch<AccountProfile & { emailChangeRequired?: boolean; devEmailCode?: string | null }>("/account/profile", {
        name: profile.name,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        bio: profile.bio,
        timezone: profile.timezone,
        language: profile.language,
        emailNotifications: profile.emailNotifications,
        marketingNotifications: profile.marketingNotifications,
      })
      setProfile(updated)
      setInitialSnapshot(JSON.stringify(updated))
      await refreshUser()
      if (updated.emailChangeRequired) {
        toast.success("Профиль обновлен. Подтвердите новый email кодом.")
        if (updated.devEmailCode) {
          toast.success(`DEV code: ${updated.devEmailCode}`)
        }
      } else {
        toast.success("Профиль обновлен")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить профиль"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const confirmEmailChange = async () => {
    if (!emailConfirmCode.trim()) {
      toast.error("Введите код подтверждения")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await api.post<{ success: boolean; message: string }>("/account/confirm-email-change", {
        code: emailConfirmCode.trim(),
      })
      setEmailConfirmCode("")
      toast.success(response.message)
      await load()
      await refreshUser()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось подтвердить email"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    setSaving(true)
    setError("")
    try {
      const response = await api.post<{ success: boolean; message: string }>("/account/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success(response.message)
      await logout()
      toast.success("Выполните вход заново")
      window.location.href = "/login"
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось изменить пароль"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const requestEnable2fa = async () => {
    setSaving(true)
    setError("")
    try {
      const response = await api.post<{ success: boolean; message: string; devCode?: string | null }>("/account/2fa/request-enable", {})
      toast.success(response.message)
      if (response.devCode) {
        toast.success(`DEV code: ${response.devCode}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось запросить код 2FA"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const confirmEnable2fa = async () => {
    if (!twoFactorCode.trim()) {
      toast.error("Введите код 2FA")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await api.post<{ success: boolean; message: string }>("/account/2fa/confirm-enable", {
        code: twoFactorCode.trim(),
      })
      setTwoFactorCode("")
      toast.success(response.message)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось включить 2FA"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const disable2fa = async () => {
    if (!disable2faPassword.trim()) {
      toast.error("Введите пароль")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await api.post<{ success: boolean; message: string }>("/account/2fa/disable", {
        password: disable2faPassword,
      })
      setDisable2faPassword("")
      toast.success(response.message)
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось отключить 2FA"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const revokeSession = async (sessionId: number) => {
    setSaving(true)
    try {
      await api.delete<{ success: boolean }>(`/account/sessions/${sessionId}`)
      toast.success("Сессия отозвана")
      await refreshSessions()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось завершить сессию"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const logoutAll = async () => {
    setSaving(true)
    try {
      await api.post<{ success: boolean }>("/account/logout-all", {})
      toast.success("Все остальные сессии завершены")
      await refreshSessions()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось завершить сессии"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <MainLayout>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
        <h2 className="text-2xl font-bold">Профиль и настройки аккаунта</h2>

        {loading && <Card><p className="text-sm text-slate-500">Загрузка профиля...</p></Card>}

        {!loading && error && <Card><p className="text-sm text-red-700 dark:text-rose-300">{error}</p></Card>}

        {!loading && profile && (
          <>
            <Card>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "profile", label: "Профиль" },
                  { key: "settings", label: "Настройки" },
                  { key: "security", label: "Безопасность" },
                  { key: "sessions", label: "Сессии" },
                ] as const).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={`px-3 py-2 rounded-xl text-sm ${activeTab === item.key ? "text-white bg-gradient-to-r from-rose-700 via-red-700 to-red-900" : "glass-panel"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <h3 className="font-semibold">Профиль</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-slate-500">Avatar URL</span>
                  <input
                    value={profile.avatarUrl || ""}
                    onChange={(event) => updateProfileField("avatarUrl", event.target.value)}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                    placeholder="https://..."
                  />
                </label>

                <div className="rounded-xl glass-panel px-3 py-2 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-200/70 overflow-hidden">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">no avatar</div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Аватар используется в хедере и профиле</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(activeTab === "profile" || activeTab === "settings") && (
                  <>
                <label className="block">
                  <span className="text-sm text-slate-500">Имя</span>
                  <input
                    value={profile.name}
                    onChange={(event) => updateProfileField("name", event.target.value)}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                  {profileErrors.name && <p className="text-xs text-rose-600 mt-1">{profileErrors.name}</p>}
                </label>

                <label className="block">
                  <span className="text-sm text-slate-500">Email</span>
                  <input
                    value={profile.email}
                    onChange={(event) => updateProfileField("email", event.target.value)}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                  {profileErrors.email && <p className="text-xs text-rose-600 mt-1">{profileErrors.email}</p>}
                </label>

                {activeTab === "profile" && (
                  <>
                <label className="block">
                  <span className="text-sm text-slate-500">Телефон</span>
                  <input
                    value={profile.phone}
                    onChange={(event) => updateProfileField("phone", event.target.value)}
                    placeholder="+7 ..."
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                  {profileErrors.phone && <p className="text-xs text-rose-600 mt-1">{profileErrors.phone}</p>}
                </label>

                <label className="block">
                  <span className="text-sm text-slate-500">Часовой пояс</span>
                  <input
                    value={profile.timezone}
                    onChange={(event) => updateProfileField("timezone", event.target.value)}
                    placeholder="Europe/Moscow"
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                  {profileErrors.timezone && <p className="text-xs text-rose-600 mt-1">{profileErrors.timezone}</p>}
                </label>
                  </>
                )}
                  </>
                )}
              </div>

              {activeTab === "profile" && (
                <label className="block">
                <span className="text-sm text-slate-500">О себе</span>
                <textarea
                  value={profile.bio}
                  onChange={(event) => updateProfileField("bio", event.target.value)}
                  placeholder="Краткая информация о вас"
                  className="mt-1 w-full h-28 rounded-xl glass-panel px-3 py-2 outline-none"
                />
                </label>
              )}

              {(activeTab === "settings" || activeTab === "profile") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm text-slate-500">Язык интерфейса</span>
                  <select
                    value={profile.language}
                    onChange={(event) => updateProfileField("language", event.target.value as "ru" | "en")}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </label>

                <div className="rounded-xl glass-panel px-3 py-2">
                  <p className="text-sm text-slate-500 mb-2">Роль</p>
                  <p className="font-semibold">
                    {profile.role === "admin" ? "Администратор" : profile.role === "teacher" ? "Преподаватель" : "Студент"}
                  </p>
                </div>
                </div>
              )}

              {(activeTab === "settings" || activeTab === "profile") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="inline-flex items-center gap-2 rounded-xl glass-panel px-3 py-2">
                  <input
                    type="checkbox"
                    checked={profile.emailNotifications}
                    onChange={(event) => updateProfileField("emailNotifications", event.target.checked)}
                  />
                  <span className="text-sm">Email-уведомления</span>
                </label>

                <label className="inline-flex items-center gap-2 rounded-xl glass-panel px-3 py-2">
                  <input
                    type="checkbox"
                    checked={profile.marketingNotifications}
                    onChange={(event) => updateProfileField("marketingNotifications", event.target.checked)}
                  />
                  <span className="text-sm">Маркетинговые рассылки</span>
                </label>
                </div>
              )}

              {isDirty && <p className="text-xs text-amber-600">Есть несохранённые изменения</p>}

              {profile.pendingEmail && (activeTab === "profile" || activeTab === "settings") && (
                <div className="rounded-xl glass-panel p-3 space-y-2">
                  <p className="text-sm font-medium">Подтверждение смены email</p>
                  <p className="text-xs text-slate-500">Новый email: {profile.pendingEmail}. Введите код из письма.</p>
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <input
                      value={emailConfirmCode}
                      onChange={(event) => setEmailConfirmCode(event.target.value)}
                      placeholder="6-значный код"
                      className="w-full md:max-w-[220px] rounded-xl glass-panel px-3 py-2 outline-none"
                    />
                    <Button variant="outline" onClick={confirmEmailChange} disabled={saving}>Подтвердить email</Button>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={saving || !isDirty || hasProfileErrors}>Сохранить профиль</Button>
              </div>
            </Card>

            {(activeTab === "security" || activeTab === "profile") && (
              <Card className="space-y-4">
              <h3 className="font-semibold">Безопасность</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-sm text-slate-500">Текущий пароль</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-500">Новый пароль</span>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-slate-500">Подтверждение</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={changePassword} disabled={saving}>Изменить пароль</Button>
              </div>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3">
                <p className="font-semibold">Двухфакторная защита (2FA)</p>
                <p className="text-sm text-slate-500">Текущий статус: {profile.twoFactorEnabled ? "включена" : "выключена"}</p>

                {!profile.twoFactorEnabled && (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" onClick={requestEnable2fa} disabled={saving}>Запросить код включения</Button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:items-center">
                      <input
                        value={twoFactorCode}
                        onChange={(event) => setTwoFactorCode(event.target.value)}
                        placeholder="Код 2FA"
                        className="w-full md:max-w-[220px] rounded-xl glass-panel px-3 py-2 outline-none"
                      />
                      <Button onClick={confirmEnable2fa} disabled={saving}>Подтвердить включение</Button>
                    </div>
                  </div>
                )}

                {profile.twoFactorEnabled && (
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <input
                      type="password"
                      value={disable2faPassword}
                      onChange={(event) => setDisable2faPassword(event.target.value)}
                      placeholder="Введите пароль для отключения"
                      className="w-full md:max-w-[280px] rounded-xl glass-panel px-3 py-2 outline-none"
                    />
                    <Button variant="outline" onClick={disable2fa} disabled={saving}>Отключить 2FA</Button>
                  </div>
                )}
              </div>
            </Card>
            )}

            {(activeTab === "sessions" || activeTab === "profile") && (
              <Card className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <h3 className="font-semibold">Активные сессии</h3>
                <Button variant="outline" onClick={logoutAll} disabled={saving}>Завершить все остальные</Button>
              </div>

              {sessionsLoading && <p className="text-sm text-slate-500">Загрузка сессий...</p>}

              {!sessionsLoading && sessions.length === 0 && (
                <p className="text-sm text-slate-500">Активные сессии не найдены.</p>
              )}

              {!sessionsLoading && sessions.map((session) => (
                <div key={session.id} className="rounded-xl glass-panel p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{session.userAgent || "Unknown device"}</p>
                    <p className="text-xs text-slate-500">IP: {session.ipAddress || "unknown"}</p>
                    <p className="text-xs text-slate-500">Last used: {formatDateTime(session.lastUsedAt, profile.timezone)}</p>
                    <p className="text-xs text-slate-500">Expires: {formatDateTime(session.expiresAt, profile.timezone)}</p>
                  </div>

                  <Button variant="outline" onClick={() => revokeSession(session.id)} disabled={saving}>Завершить</Button>
                </div>
              ))}
            </Card>
              )}
          </>
        )}
      </motion.div>
    </MainLayout>
  )
}
