// настройки аккаунта — четыре вкладки: профиль, безопасность, уведомления, сессии
// вкладка хранится в url-параметре ?tab= чтобы можно было шарить ссылку
//
// КАК РАБОТАЕТ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ЧЕРЕЗ URL:
//   useSearchParams() — хук React Router для чтения и записи параметров URL
//   activeTab = searchParams.get("tab") || "profile" — текущая вкладка из ?tab=...
//   setTab(tab): new URLSearchParams(searchParams) → next.set("tab", tab) → setSearchParams(next)
//   URL меняется без перезагрузки → кнопка "назад" в браузере работает корректно
//
// КАК РАБОТАЕТ ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ (isDirty):
//   при загрузке: setInitialSnapshot(JSON.stringify(data)) — фиксируем начальное состояние
//   isDirty = useMemo: JSON.stringify(profile) !== initialSnapshot
//   каждое изменение поля → updateProfileField → profile обновляется → useMemo пересчитывается
//   если profile отличается от снимка — появляется "Есть несохранённые изменения" и кнопка активна
//   после saveProfile: setInitialSnapshot(JSON.stringify(updated)) — снимок обновляется
//
// КАК РАБОТАЕТ КРОП АВАТАРА:
//   пользователь выбирает файл → FileReader читает как dataURL (base64 строка)
//     → setPendingAvatarSrc(dataUrl) → открывается модалка с Cropper компонентом
//       → пользователь двигает/зумирует → onCropComplete → setCroppedAreaPixels(pixels)
//         → applyAvatarCrop(): создаём canvas 256×256 → ctx.drawImage() вырезает нужный кусок
//           → canvas.toDataURL() → updateProfileField("avatarUrl", dataUrl) — в стейт профиля
//             → при saveProfile этот base64 уходит на сервер как строка
//
// 2FA (двухфакторная аутентификация):
//   POST /account/2fa/setup → QR-код (dataUrl) + секретный ключ → показываем пользователю
//   пользователь сканирует QR в Google Authenticator → вводит 6-значный код
//   POST /account/2fa/verify { code } → бэк проверяет TOTP → 2fa включена
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import Cropper, { type Area, type Point } from "react-easy-crop" // для обрезки аватара
import MainLayout from "../layout/MainLayout"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import { useAppStore } from "../store/AppStore"
import {
  User, Mail, Phone, Globe, Languages, Camera, Trash2, Lock,
  Shield, ShieldCheck, ShieldOff, Monitor, LogOut, Clock,
  ChevronRight, Bell, X, Check, AlertCircle, Copy,
  KeyRound, Eye, EyeOff, Smartphone,
} from "lucide-react"
import type { TwoFactorSetup } from "../services/api"

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

const TABS = [
  { key: "profile" as const, label: "Профиль", icon: User },
  { key: "security" as const, label: "Безопасность", icon: Shield },
  { key: "notifications" as const, label: "Уведомления", icon: Bell },
  { key: "sessions" as const, label: "Сессии", icon: Monitor },
]

type Tab = typeof TABS[number]["key"]

export default function AccountSettings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get("tab") || "profile") as Tab // читаем вкладку из url
  const toast = useToast()
  const { refreshUser, logout } = useAppStore()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [initialSnapshot, setInitialSnapshot] = useState("") // json-снимок для отслеживания изменений
  const [sessions, setSessions] = useState<AccountSession[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [pendingAvatarSrc, setPendingAvatarSrc] = useState<string | null>(null)
  const [pendingAvatarMime, setPendingAvatarMime] = useState("image/jpeg")
  const [cropPosition, setCropPosition] = useState<Point>({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [error, setError] = useState("")
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [emailConfirmCode, setEmailConfirmCode] = useState("")
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  // данные для настройки двухфакторной аутентификации (qr-код, секрет)
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  // форма отключения 2fa — требует текущий пароль и код
  const [disableForm, setDisableForm] = useState<{ open: boolean; password: string; code: string }>({ open: false, password: "", code: "" })

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const closeCropModal = useCallback(() => {
    setPendingAvatarSrc(null)
    setCroppedAreaPixels(null)
    setCropPosition({ x: 0, y: 0 })
    setCropZoom(1)
  }, [])

  const resetCrop = useCallback(() => {
    setCropPosition({ x: 0, y: 0 })
    setCropZoom(1)
  }, [])

  const formatDateTime = (value: string, tz: string) => {
    try {
      return new Intl.DateTimeFormat(profile?.language === "en" ? "en-US" : "ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: tz || "Europe/Moscow",
      }).format(new Date(value))
    } catch { return value }
  }

  const validateProfile = (value: AccountProfile | null): ProfileErrors => {
    if (!value) return {}
    const next: ProfileErrors = {}
    if (value.name.trim().length < 2) next.name = "Минимум 2 символа"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) next.email = "Введите корректный email"
    if (value.phone.trim() && !/^[+()\d\s-]{7,20}$/.test(value.phone.trim())) next.phone = "Введите корректный номер"
    if (!value.timezone.trim()) next.timezone = "Выберите часовой пояс"
    return next
  }

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const data = await api.get<AccountSession[]>("/account/sessions")
      setSessions(data)
    } catch { setSessions([]) }
    finally { setSessionsLoading(false) }
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
    } finally { setLoading(false) }
  }, [refreshSessions])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!pendingAvatarSrc) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCropModal()
      if (e.key === "+" || e.key === "=") { e.preventDefault(); setCropZoom((z) => Math.min(3.5, +(z + 0.1).toFixed(2))) }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); setCropZoom((z) => Math.max(1, +(z - 0.1).toFixed(2))) }
      if (e.key.toLowerCase() === "r") { e.preventDefault(); resetCrop() }
    }
    window.addEventListener("keydown", onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey) }
  }, [pendingAvatarSrc, closeCropModal, resetCrop])

  // есть ли несохранённые изменения — сравниваем с начальным снимком
  const isDirty = useMemo(() => {
    if (!profile || !initialSnapshot) return false
    return JSON.stringify(profile) !== initialSnapshot
  }, [initialSnapshot, profile])

  const hasProfileErrors = Object.keys(profileErrors).length > 0

  const setTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams)
    next.set("tab", tab)
    setSearchParams(next)
  }

  const updateProfileField = <K extends keyof AccountProfile>(key: K, value: AccountProfile[K]) => {
    setProfile((prev) => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      setProfileErrors(validateProfile(next))
      return next
    })
  }

  // обработчик выбора файла аватара — читает как dataUrl и открывает кроппер
  const onAvatarFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return
    if (!file.type.startsWith("image/")) { toast.error("Выберите файл изображения"); event.target.value = ""; return }
    if (file.size > 2 * 1024 * 1024) { toast.error("Размер до 2 МБ"); event.target.value = ""; return }
    setAvatarUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"))
        reader.readAsDataURL(file)
      })
      setPendingAvatarSrc(dataUrl)
      setPendingAvatarMime(file.type || "image/jpeg")
      setCropPosition({ x: 0, y: 0 })
      setCropZoom(1)
      setCroppedAreaPixels(null)
    } catch { toast.error("Не удалось загрузить фото") }
    finally { setAvatarUploading(false); event.target.value = "" }
  }

  // обрезаем изображение через canvas и кладём результат в поле avatarUrl профиля
  const applyAvatarCrop = async () => {
    if (!pendingAvatarSrc || !croppedAreaPixels) return
    setAvatarUploading(true)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error("load error"))
        image.src = pendingAvatarSrc
      })
      const canvas = document.createElement("canvas")
      canvas.width = 256; canvas.height = 256
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas недоступен")
      ctx.drawImage(img, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, 256, 256)
      const mimeType = pendingAvatarMime === "image/png" ? "image/png" : "image/jpeg"
      updateProfileField("avatarUrl", canvas.toDataURL(mimeType, 0.92))
      setPendingAvatarSrc(null)
      setCroppedAreaPixels(null)
      toast.success("Фото обрезано — сохраните профиль")
    } catch { toast.error("Не удалось обрезать фото") }
    finally { setAvatarUploading(false) }
  }

  // сохранить профиль — патчим только нужные поля, не весь объект
  const saveProfile = async () => {
    if (!profile) return
    const nextErrors = validateProfile(profile)
    setProfileErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) { toast.error("Исправьте ошибки"); return }
    setSaving(true); setError("")
    try {
      const updated = await api.patch<AccountProfile & { emailChangeRequired?: boolean; devEmailCode?: string | null }>("/account/profile", {
        fullName: profile.name, email: profile.email, avatarUrl: profile.avatarUrl,
        phone: profile.phone, bio: profile.bio, timezone: profile.timezone,
        language: profile.language, emailNotifications: profile.emailNotifications,
        marketingNotifications: profile.marketingNotifications,
      })
      setProfile(updated); setInitialSnapshot(JSON.stringify(updated))
      await refreshUser()
      if (updated.emailChangeRequired) {
        toast.success("Подтвердите новый email кодом")
        if (updated.devEmailCode) toast.success(`DEV: ${updated.devEmailCode}`)
      } else { toast.success("Профиль обновлен") }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка сохранения"
      setError(msg); toast.error(msg)
    } finally { setSaving(false) }
  }

  const confirmEmailChange = async () => {
    if (!emailConfirmCode.trim()) { toast.error("Введите код"); return }
    setSaving(true); setError("")
    try {
      const res = await api.post<{ success: boolean; message: string }>("/account/confirm-email-change", { code: emailConfirmCode.trim() })
      setEmailConfirmCode(""); toast.success(res.message)
      await load(); await refreshUser()
    } catch (err) { const msg = err instanceof Error ? err.message : "Ошибка"; setError(msg); toast.error(msg) }
    finally { setSaving(false) }
  }

  // сменить пароль — после успеха разлогиниваемся и перекидываем на логин
  const changePassword = async () => {
    setSaving(true); setError("")
    try {
      const res = await api.post<{ success: boolean; message: string }>("/account/change-password", { currentPassword, newPassword, confirmPassword })
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
      toast.success(res.message)
      await logout()
      window.location.href = "/login"
    } catch (err) { const msg = err instanceof Error ? err.message : "Ошибка"; setError(msg); toast.error(msg) }
    finally { setSaving(false) }
  }

  const revokeSession = async (sessionId: number) => {
    setSaving(true)
    try {
      await api.delete<{ success: boolean }>(`/account/sessions/${sessionId}`)
      toast.success("Сессия завершена"); await refreshSessions()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Ошибка") }
    finally { setSaving(false) }
  }

  const logoutAll = async () => {
    setSaving(true)
    try {
      await api.post<{ success: boolean }>("/account/logout-all", {})
      toast.success("Другие сессии завершены"); await refreshSessions()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Ошибка") }
    finally { setSaving(false) }
  }

  const startTwoFactorSetup = async () => {
    setTwoFactorBusy(true)
    try {
      const data = await api.post<TwoFactorSetup>("/account/2fa/setup", {})
      setTwoFactorSetup(data)
      setTwoFactorCode("")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Не удалось начать настройку") }
    finally { setTwoFactorBusy(false) }
  }

  const cancelTwoFactorSetup = async () => {
    setTwoFactorSetup(null)
    setTwoFactorCode("")
    try { await api.post<{ success: boolean }>("/account/2fa/cancel", {}) } catch { /* ignore */ }
  }

  const confirmTwoFactor = async () => {
    if (!/^\d{6}$/.test(twoFactorCode)) { toast.error("Введите 6-значный код"); return }
    setTwoFactorBusy(true)
    try {
      await api.post<{ success: boolean; enabled: boolean }>("/account/2fa/verify", { code: twoFactorCode })
      toast.success("Двухфакторная аутентификация включена")
      setTwoFactorSetup(null)
      setTwoFactorCode("")
      setProfile((prev) => prev ? { ...prev, twoFactorEnabled: true } : prev)
      setInitialSnapshot((prev) => prev ? JSON.stringify({ ...JSON.parse(prev), twoFactorEnabled: true }) : prev)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Неверный код") }
    finally { setTwoFactorBusy(false) }
  }

  const openDisableTwoFactor = () => setDisableForm({ open: true, password: "", code: "" })
  const closeDisableTwoFactor = () => setDisableForm({ open: false, password: "", code: "" })

  const submitDisableTwoFactor = async () => {
    if (!disableForm.password) { toast.error("Введите текущий пароль"); return }
    if (!/^\d{6}$/.test(disableForm.code)) { toast.error("Введите 6-значный код"); return }
    setTwoFactorBusy(true)
    try {
      await api.post<{ success: boolean; enabled: boolean }>("/account/2fa/disable", { password: disableForm.password, code: disableForm.code })
      toast.success("Двухфакторная аутентификация отключена")
      setProfile((prev) => prev ? { ...prev, twoFactorEnabled: false } : prev)
      setInitialSnapshot((prev) => prev ? JSON.stringify({ ...JSON.parse(prev), twoFactorEnabled: false }) : prev)
      closeDisableTwoFactor()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Не удалось отключить") }
    finally { setTwoFactorBusy(false) }
  }

  const copyTwoFactorSecret = async () => {
    if (!twoFactorSetup) return
    try {
      await navigator.clipboard.writeText(twoFactorSetup.secret)
      toast.success("Ключ скопирован")
    } catch { toast.error("Не удалось скопировать") }
  }

  const roleLabel = profile?.role === "admin" ? "Администратор" : profile?.role === "teacher" ? "Преподаватель" : "Студент"
  const initials = profile?.name
    ? profile.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?"

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <div className="max-w-5xl space-y-6">
        {/* Page heading */}
        <div>
          <h1 className="font-display font-bold text-3xl text-[var(--text)]">Настройки</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Управляйте профилем, безопасностью и сессиями</p>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-[var(--surface)] animate-pulse" />)}
          </div>
        )}

        {!loading && error && !profile && (
          <div className="card p-5 border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        )}

        {!loading && profile && (
          <div className="grid lg:grid-cols-[240px_1fr] gap-6">
            {/* ─── Sidebar ──────────────────────────────────────────────── */}
            <div className="space-y-5">
              {/* User card */}
              <div className="card p-5 flex flex-col items-center text-center">
                <div className="relative group mb-3">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[var(--surface)] border-2 border-[var(--border)]">
                    {profile.avatarUrl
                      ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center font-display font-bold text-xl text-[var(--muted)]">{initials}</div>
                    }
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                  >
                    <Camera size={18} />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={onAvatarFileSelected} className="hidden" />
                </div>
                <p className="font-display font-bold text-[var(--text)]">{profile.name}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{roleLabel}</p>
                <p className="text-xs text-[var(--muted)]">{profile.email}</p>
              </div>

              {/* Nav */}
              <nav className="space-y-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setTab(tab.key)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "btn-gradient text-white shadow-none"
                          : "text-[var(--text)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <Icon size={16} className={isActive ? "text-white" : "text-[var(--muted)]"} />
                      {tab.label}
                      <ChevronRight size={14} className={`ml-auto ${isActive ? "text-white/60" : "text-[var(--border)]"}`} />
                    </button>
                  )
                })}
              </nav>

              {/* Quick status */}
              <div className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--muted)]">Сессии</span>
                  <span className="text-xs font-semibold text-[var(--text)]">{sessions.length}</span>
                </div>
              </div>
            </div>

            {/* ─── Content ──────────────────────────────────────────────── */}
            <div className="space-y-5 min-w-0">

              {/* ═════ PROFILE TAB ═════ */}
              {activeTab === "profile" && (
                <div className="space-y-5">
                  {/* Avatar section */}
                  <div className="card p-5">
                    <p className="font-semibold text-sm text-[var(--text)] mb-4">Фото профиля</p>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[var(--surface)] border border-[var(--border)] shrink-0">
                        {profile.avatarUrl
                          ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center font-display font-bold text-lg text-[var(--muted)]">{initials}</div>
                        }
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--muted)]">JPG, PNG до 2 МБ. Будет обрезано до квадрата.</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={saving || avatarUploading}
                            className="btn-secondary px-3 py-1.5 text-xs gap-1.5"
                          >
                            <Camera size={12} />{avatarUploading ? "..." : "Выбрать"}
                          </button>
                          {profile.avatarUrl && (
                            <button
                              onClick={() => updateProfileField("avatarUrl", "")}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 border border-red-200 dark:border-red-800/30 transition-colors"
                            >
                              <Trash2 size={12} />Убрать
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Personal info */}
                  <div className="card p-5 space-y-4">
                    <p className="font-semibold text-sm text-[var(--text)]">Личная информация</p>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FieldInput icon={User} label="Имя" value={profile.name} onChange={(v) => updateProfileField("name", v)} error={profileErrors.name} />
                      <FieldInput icon={Mail} label="Email" type="email" value={profile.email} onChange={(v) => updateProfileField("email", v)} error={profileErrors.email} />
                      <PhoneInput value={profile.phone} onChange={(v) => updateProfileField("phone", v)} error={profileErrors.phone} />
                      <TimezoneSelect value={profile.timezone} onChange={(v) => updateProfileField("timezone", v)} />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">О себе</label>
                      <textarea
                        value={profile.bio}
                        onChange={(e) => updateProfileField("bio", e.target.value)}
                        placeholder="Расскажите немного о себе"
                        className="input-field w-full px-4 py-3 text-sm h-24 resize-none"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">
                          <Languages size={12} className="inline mr-1" />Язык
                        </label>
                        <select
                          value={profile.language}
                          onChange={(e) => updateProfileField("language", e.target.value as "ru" | "en")}
                          className="input-field w-full px-4 py-2.5 text-sm"
                        >
                          <option value="ru">Русский</option>
                          <option value="en">English</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-[var(--muted)] mb-1.5 block">Роль</label>
                        <div className="input-field px-4 py-2.5 text-sm bg-[var(--surface)] font-semibold text-[var(--text)]">
                          {roleLabel}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pending email confirm */}
                  {profile.pendingEmail && (
                    <div className="card p-5 border-primary/20 bg-primary-50 dark:bg-primary-900/10 space-y-3">
                      <div className="flex items-start gap-3">
                        <AlertCircle size={16} className="text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-sm text-[var(--text)]">Подтвердите новый email</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">Код отправлен на {profile.pendingEmail}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={emailConfirmCode}
                          onChange={(e) => setEmailConfirmCode(e.target.value)}
                          placeholder="6-значный код"
                          maxLength={6}
                          className="input-field px-3 py-2 text-sm w-40 tracking-widest"
                        />
                        <button onClick={confirmEmailChange} disabled={saving} className="btn-primary px-4 py-2 text-sm">
                          Подтвердить
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  <div className="flex items-center justify-between gap-3">
                    {isDirty && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle size={12} /> Есть несохранённые изменения
                      </p>
                    )}
                    <div className="ml-auto">
                      <button
                        onClick={saveProfile}
                        disabled={saving || !isDirty || hasProfileErrors}
                        className="btn-primary px-6 py-2.5 text-sm gap-2"
                      >
                        {saving
                          ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <><Check size={14} /><span>Сохранить</span></>
                        }
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ═════ SECURITY TAB ═════ */}
              {activeTab === "security" && (
                <div className="space-y-5">
                  {/* Two-factor authentication */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {profile.twoFactorEnabled
                          ? <ShieldCheck size={16} className="text-emerald-500" />
                          : <Shield size={16} className="text-[var(--muted)]" />}
                        <div>
                          <p className="font-semibold text-sm text-[var(--text)]">Двухфакторная аутентификация</p>
                          <p className="text-xs text-[var(--muted)] mt-0.5">Google Authenticator, Authy и другие TOTP-приложения</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                        profile.twoFactorEnabled
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"
                      }`}>
                        {profile.twoFactorEnabled ? "включена" : "выключена"}
                      </span>
                    </div>

                    {!profile.twoFactorEnabled && !twoFactorSetup && (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-[var(--muted)] leading-relaxed">
                          Дополнительная защита аккаунта: при входе потребуется 6-значный код из приложения-аутентификатора.
                        </p>
                        <div className="flex justify-end">
                          <button
                            onClick={startTwoFactorSetup}
                            disabled={twoFactorBusy}
                            className="btn-primary px-5 py-2.5 text-sm gap-2"
                          >
                            <Smartphone size={14} />Включить 2FA
                          </button>
                        </div>
                      </div>
                    )}

                    {twoFactorSetup && (
                      <div className="space-y-4">
                        <div className="text-xs text-[var(--muted)] space-y-1">
                          <p>1. Откройте Google Authenticator или другое TOTP-приложение.</p>
                          <p>2. Отсканируйте QR-код или введите ключ вручную.</p>
                          <p>3. Введите 6-значный код из приложения ниже.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          <div className="bg-white rounded-xl p-3 border border-[var(--border)] shrink-0">
                            <img
                              src={twoFactorSetup.qrCodeDataUrl}
                              alt="QR-код для Google Authenticator"
                              width={176}
                              height={176}
                              className="block"
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3 w-full">
                            <div>
                              <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
                                <KeyRound size={12} />Секретный ключ
                              </label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 min-w-0 truncate text-xs font-mono px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">
                                  {twoFactorSetup.secret}
                                </code>
                                <button
                                  type="button"
                                  onClick={copyTwoFactorSecret}
                                  className="btn-ghost shrink-0 px-3 py-2 text-xs gap-1"
                                  title="Скопировать"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                              <p className="text-[11px] text-[var(--muted)] mt-1">Аккаунт: {twoFactorSetup.accountEmail} · {twoFactorSetup.issuer}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
                                <Smartphone size={12} />Код из приложения
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="123456"
                                className="input-field w-full px-4 py-2.5 text-base text-center font-mono tracking-[0.4em]"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={cancelTwoFactorSetup}
                            disabled={twoFactorBusy}
                            className="btn-ghost px-4 py-2 text-sm"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={confirmTwoFactor}
                            disabled={twoFactorBusy || twoFactorCode.length !== 6}
                            className="btn-primary px-5 py-2 text-sm gap-2"
                          >
                            <ShieldCheck size={14} />Подтвердить
                          </button>
                        </div>
                      </div>
                    )}

                    {profile.twoFactorEnabled && !disableForm.open && (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs text-[var(--muted)] leading-relaxed">
                          При входе потребуется код из вашего приложения-аутентификатора. Чтобы отключить, подтвердите действие паролем и текущим кодом.
                        </p>
                        <div className="flex justify-end">
                          <button
                            onClick={openDisableTwoFactor}
                            disabled={twoFactorBusy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 border border-red-200 dark:border-red-800/30 transition-colors font-medium"
                          >
                            <ShieldOff size={14} />Отключить 2FA
                          </button>
                        </div>
                      </div>
                    )}

                    {profile.twoFactorEnabled && disableForm.open && (
                      <div className="space-y-3 rounded-xl border border-red-200 dark:border-red-800/30 bg-red-50/40 dark:bg-red-900/10 p-4">
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle size={14} />
                          <p className="text-xs font-semibold">Подтвердите отключение 2FA</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
                              <Lock size={12} />Текущий пароль
                            </label>
                            <input
                              type="password"
                              value={disableForm.password}
                              onChange={(e) => setDisableForm((f) => ({ ...f, password: e.target.value }))}
                              className="input-field w-full px-4 py-2.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
                              <Smartphone size={12} />Код из приложения
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={disableForm.code}
                              onChange={(e) => setDisableForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                              placeholder="123456"
                              className="input-field w-full px-4 py-2.5 text-sm text-center font-mono tracking-[0.3em]"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button onClick={closeDisableTwoFactor} disabled={twoFactorBusy} className="btn-ghost px-4 py-2 text-sm">
                            Отмена
                          </button>
                          <button
                            onClick={submitDisableTwoFactor}
                            disabled={twoFactorBusy || !disableForm.password || disableForm.code.length !== 6}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            <ShieldOff size={14} />Отключить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Change password */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Lock size={16} className="text-[var(--muted)]" />
                      <p className="font-semibold text-sm text-[var(--text)]">Смена пароля</p>
                    </div>
                    <p className="text-xs text-[var(--muted)]">После смены пароля все сессии будут завершены</p>

                    <div className="space-y-3">
                      <PasswordField
                        label="Текущий пароль"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        visible={showCurrentPw}
                        onToggle={() => setShowCurrentPw(!showCurrentPw)}
                      />
                      <div className="grid md:grid-cols-2 gap-3">
                        <PasswordField
                          label="Новый пароль"
                          value={newPassword}
                          onChange={setNewPassword}
                          visible={showNewPw}
                          onToggle={() => setShowNewPw(!showNewPw)}
                        />
                        <PasswordField
                          label="Подтвердите пароль"
                          value={confirmPassword}
                          onChange={setConfirmPassword}
                          visible={showNewPw}
                          onToggle={() => setShowNewPw(!showNewPw)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button onClick={changePassword} disabled={saving || !currentPassword || !newPassword || !confirmPassword} className="btn-primary px-5 py-2.5 text-sm gap-2">
                        <KeyRound size={14} />Изменить пароль
                      </button>
                    </div>
                  </div>

                </div>
              )}

              {/* ═════ NOTIFICATIONS TAB ═════ */}
              {activeTab === "notifications" && (
                <div className="space-y-5">
                  <div className="card p-5 space-y-4">
                    <p className="font-semibold text-sm text-[var(--text)]">Уведомления</p>

                    <ToggleRow
                      icon={Bell}
                      title="Email-уведомления"
                      description="Получать уведомления о прогрессе, курсах и дедлайнах"
                      checked={profile.emailNotifications}
                      onChange={(v) => updateProfileField("emailNotifications", v)}
                    />
                    <ToggleRow
                      icon={Mail}
                      title="Маркетинговые рассылки"
                      description="Новости, акции и рекомендации курсов"
                      checked={profile.marketingNotifications}
                      onChange={(v) => updateProfileField("marketingNotifications", v)}
                    />
                  </div>

                  {isDirty && (
                    <div className="flex justify-end">
                      <button onClick={saveProfile} disabled={saving} className="btn-primary px-6 py-2.5 text-sm gap-2">
                        {saving ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={14} />Сохранить</>}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ═════ SESSIONS TAB ═════ */}
              {activeTab === "sessions" && (
                <div className="space-y-5">
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-sm text-[var(--text)]">Активные сессии</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{sessions.length} активных</p>
                      </div>
                      <button
                        onClick={logoutAll}
                        disabled={saving || sessions.length <= 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 border border-red-200 dark:border-red-800/30 transition-colors font-medium"
                      >
                        <LogOut size={12} />Завершить все остальные
                      </button>
                    </div>

                    {sessionsLoading && (
                      <div className="space-y-3">
                        {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-[var(--surface)] animate-pulse" />)}
                      </div>
                    )}

                    {!sessionsLoading && sessions.length === 0 && (
                      <p className="text-sm text-[var(--muted)] py-4 text-center">Нет активных сессий</p>
                    )}

                    {!sessionsLoading && (
                      <div className="space-y-2">
                        {sessions.map((s) => (
                          <div key={s.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] group">
                            <Monitor size={18} className="text-[var(--muted)] shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--text)] truncate">{s.userAgent || "Неизвестное устройство"}</p>
                              <div className="flex gap-3 mt-0.5 text-xs text-[var(--muted)]">
                                <span>IP: {s.ipAddress || "?"}</span>
                                <span className="flex items-center gap-1"><Clock size={10} />{formatDateTime(s.lastUsedAt, profile.timezone)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => revokeSession(s.id)}
                              disabled={saving}
                              className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Avatar crop modal ───────────────────────────────────────────────── */}
      {pendingAvatarSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeCropModal() }}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden bg-[var(--bg)] border border-[var(--border)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <p className="font-display font-bold text-lg text-[var(--text)]">Обрезка аватара</p>
                <p className="text-xs text-[var(--muted)]">Перетащите и масштабируйте</p>
              </div>
              <button onClick={closeCropModal} className="p-2 rounded-xl hover:bg-[var(--surface)] text-[var(--muted)] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Cropper */}
            <div className="relative h-72 sm:h-80 bg-[var(--surface)]">
              <Cropper
                image={pendingAvatarSrc}
                crop={cropPosition}
                zoom={cropZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={3.5}
                onCropChange={setCropPosition}
                onZoomChange={setCropZoom}
                onCropComplete={onCropComplete}
              />
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="inline-block w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="px-5 py-4 border-t border-[var(--border)] space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--muted)] shrink-0">Масштаб</span>
                <input
                  type="range"
                  min={1} max={3.5} step={0.05}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs font-mono text-[var(--text)] w-8 text-right">{cropZoom.toFixed(1)}x</span>
              </div>

              <div className="flex gap-2 justify-end">
                <button onClick={closeCropModal} className="btn-ghost px-4 py-2 text-sm">Отмена</button>
                <button onClick={resetCrop} className="btn-secondary px-4 py-2 text-sm">Сбросить</button>
                <button onClick={applyAvatarCrop} disabled={saving || avatarUploading || !croppedAreaPixels} className="btn-primary px-5 py-2 text-sm">
                  Применить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}

// ─── переиспользуемые компоненты ────────────────────────────────────────────

// список часовых поясов для дропдауна — в основном СНГ + несколько мировых
const TIMEZONES = [
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { value: "Europe/Samara", label: "Самара (UTC+4)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Omsk", label: "Омск (UTC+6)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Asia/Magadan", label: "Магадан (UTC+11)" },
  { value: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
  { value: "Europe/London", label: "Лондон (UTC+0)" },
  { value: "Europe/Berlin", label: "Берлин (UTC+1)" },
  { value: "Asia/Almaty", label: "Алматы (UTC+6)" },
  { value: "Asia/Tashkent", label: "Ташкент (UTC+5)" },
  { value: "Asia/Tbilisi", label: "Тбилиси (UTC+4)" },
  { value: "America/New_York", label: "Нью-Йорк (UTC-5)" },
  { value: "America/Los_Angeles", label: "Лос-Анджелес (UTC-8)" },
  { value: "Asia/Tokyo", label: "Токио (UTC+9)" },
  { value: "Asia/Shanghai", label: "Шанхай (UTC+8)" },
]

function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
        <Globe size={12} />Часовой пояс
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field w-full px-4 py-2.5 text-sm appearance-none bg-[var(--surface)] cursor-pointer"
      >
        {TIMEZONES.map((tz) => (
          <option key={tz.value} value={tz.value}>{tz.label}</option>
        ))}
      </select>
    </div>
  )
}

// форматируем номер телефона по мере ввода — результат вида +7 (999) 123-45-67
function formatPhoneValue(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11)
  if (!digits) return ""
  let out = "+"
  if (digits.length >= 1) out += digits[0]
  if (digits.length >= 2) out += " (" + digits.slice(1, Math.min(4, digits.length))
  if (digits.length >= 4) out += ") "
  if (digits.length >= 5) out += digits.slice(4, Math.min(7, digits.length))
  if (digits.length >= 7) out += "-"
  if (digits.length >= 8) out += digits.slice(7, Math.min(9, digits.length))
  if (digits.length >= 9) out += "-"
  if (digits.length >= 10) out += digits.slice(9, 11)
  return out
}

function PhoneInput({ value, onChange, error }: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    onChange(formatPhoneValue(raw))
  }

  return (
    <div>
      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
        <Phone size={12} />Телефон
      </label>
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        placeholder="+7 (999) 123-45-67"
        className={`input-field w-full px-4 py-2.5 text-sm ${error ? "border-red-300 dark:border-red-700" : ""}`}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function FieldInput({ icon: Icon, label, value, onChange, error, placeholder, type = "text" }: {
  icon: React.FC<{ size?: number; className?: string }>
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
        <Icon size={12} />{label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input-field w-full px-4 py-2.5 text-sm ${error ? "border-red-300 dark:border-red-700" : ""}`}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function PasswordField({ label, value, onChange, visible, onToggle }: {
  label: string
  value: string
  onChange: (v: string) => void
  visible: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1">
        <Lock size={12} />{label}
      </label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field w-full pl-4 pr-10 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

function ToggleRow({ icon: Icon, title, description, checked, onChange }: {
  icon: React.FC<{ size?: number; className?: string }>
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
      <Icon size={18} className="text-[var(--muted)] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        <p className="text-xs text-[var(--muted)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${
          checked ? "bg-primary" : "bg-[var(--border)]"
        }`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "left-6" : "left-1"
        }`} />
      </button>
    </div>
  )
}
