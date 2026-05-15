// страница сброса пароля — шаг 2 из 2 (после ForgotPassword.tsx)
// получает email и devCode из query string: /reset-password?email=...&devCode=...
// в dev режиме код подставляется автоматически — не нужно лезть в почту при разработке
//
// КАК РАБОТАЕТ:
//   emailFromQuery = searchParams.get("email") — уже заполнен, не надо вводить
//   devCodeFromQuery = searchParams.get("devCode") — в dev-режиме подставляется бэком
//   handleSubmit() → validate() → POST /auth/reset-password { email, code, password }
//     → бэк находит запись по email+code, проверяет что не истёк (10 минут),
//       хэширует новый пароль через bcrypt, сохраняет, удаляет код из БД
//     → возвращает { success, message }
//   после успеха: toast.success(message) → navigate("/login")
//
// ВАЛИДАЦИЯ (в порядке приоритета):
//   1. Корректный email (regex)
//   2. Код строго 6 цифр (/^\d{6}$/)
//   3. Пароль минимум 8 символов
//   4. Подтверждение совпадает с паролем
//
// DEV-режим:
//   если devCodeFromQuery задан — показываем зелёный баннер "DEV режим: код подставлен автоматически"
//   это визуальная подсказка разработчику что ручное копирование кода не нужно
//
// useMemo для emailFromQuery и devCodeFromQuery:
//   searchParams — стабильный объект если URL не меняется
//   useMemo предотвращает лишние вычисления при ре-рендерах не связанных с URL
import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Lock, Mail, KeyRound, ArrowLeft, ArrowRight } from "lucide-react"
import AuthScreenShell from "../components/auth/AuthScreenShell"
import { api } from "../lib/api"
import { useToast } from "../hooks/useToast"
import BrandLogo from "../components/BrandLogo"

type ResetPasswordResponse = { success: boolean; message: string }


export default function ResetPassword() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailFromQuery = useMemo(() => (searchParams.get("email") || "").trim().toLowerCase(), [searchParams])
  const devCodeFromQuery = useMemo(() => (searchParams.get("devCode") || "").trim(), [searchParams])

  const [email, setEmail] = useState(emailFromQuery)
  const [code, setCode] = useState(devCodeFromQuery)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return "Введите корректный email"
    if (!/^\d{6}$/.test(code.trim())) return "Введите 6-значный код"
    if (password.trim().length < 8) return "Пароль — минимум 8 символов"
    if (password !== confirmPassword) return "Пароли не совпадают"
    return ""
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError("")
    try {
      const response = await api.post<ResetPasswordResponse>("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
      })
      toast.success(response.message)
      navigate("/login")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось обновить пароль"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <AuthScreenShell>
      <div className="w-full max-w-[420px] relative z-10">
        <div className="bg-white/95 dark:bg-[#140808]/95 border border-[var(--border)] rounded-3xl shadow-card-lg backdrop-blur-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-700 to-burgundy" />

          <div className="p-8">
            <div className="flex flex-col items-center mb-8">
              <BrandLogo showText text="Gradus" iconClassName="h-9 w-9" textClassName="text-2xl font-bold font-display text-[var(--text)]" />
              <h1 className="font-display font-bold text-2xl mt-4 mb-1 text-[var(--text)]">Новый пароль</h1>
              <p className="text-sm text-[var(--muted)]">Введите код из письма и придумайте новый пароль</p>
            </div>

            {devCodeFromQuery && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-xs text-green-600 dark:text-green-400">
                DEV режим: код подставлен автоматически
              </div>
            )}

            <div className="space-y-3" onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10 pr-4 py-3 text-sm"
                />
              </div>

              <div className="relative">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Код из письма (6 цифр)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  className="input-field pl-10 pr-4 py-3 text-sm tracking-[0.15em]"
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                <input
                  type="password"
                  placeholder="Новый пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 pr-4 py-3 text-sm"
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                <input
                  type="password"
                  placeholder="Подтвердите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pl-10 pr-4 py-3 text-sm"
                />
              </div>

              {error && (
                <p
                  className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-lg"
                >
                  {error}
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary w-full py-3 text-sm gap-2"
              >
                {loading
                  ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><span>Обновить пароль</span><ArrowRight size={16} /></>
                }
              </button>
            </div>

            <p className="text-sm text-center mt-6 text-[var(--muted)]">
              <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-700 transition-colors">
                <ArrowLeft size={14} /> Назад ко входу
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthScreenShell>
  )
}
