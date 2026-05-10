import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import AuthScreenShell from "../components/auth/AuthScreenShell"
import { Eye, EyeOff, Mail, Lock, KeyRound, ArrowRight, ArrowLeft } from "lucide-react"
import { useAppStore } from "../store/AppStore"
import { useToast } from "../hooks/useToast"
import BrandLogo from "../components/BrandLogo"


export default function Login() {
  const navigate = useNavigate()
  const { login, verifyTwoFactorLogin } = useAppStore()
  const toast = useToast()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [twoFactorMode, setTwoFactorMode] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [challengeId, setChallengeId] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return "Введите корректный email"
    if (password.trim().length < 8) return "Пароль — минимум 8 символов"
    return ""
  }

  const handleLogin = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError("")
    try {
      const result = await login(email, password)
      if (result.requiresTwoFactor) {
        setTwoFactorMode(true)
        setChallengeId(result.challengeId || "")
        toast.success("Введите код 2FA")
        if (result.devCode) toast.success(`DEV code: ${result.devCode}`)
      } else {
        toast.success("Вход выполнен")
        navigate("/dashboard")
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка входа"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  const handleVerify2fa = async () => {
    if (!challengeId) { setError("Challenge не найден, повторите вход"); return }
    if (!/^\d{6}$/.test(twoFactorCode.trim())) { setError("Введите 6-значный код"); return }
    setLoading(true); setError("")
    try {
      await verifyTwoFactorLogin(challengeId, twoFactorCode.trim())
      toast.success("2FA подтверждена")
      navigate("/dashboard")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка 2FA"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") twoFactorMode ? void handleVerify2fa() : void handleLogin()
  }

  return (
    <AuthScreenShell>
      <div
        className="w-full max-w-[420px] relative z-10"
      >
        {/* Card */}
        <div className="bg-white/95 dark:bg-[#140808]/95 border border-[var(--border)] rounded-3xl shadow-card-lg backdrop-blur-xl overflow-hidden relative">
          {/* Top accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-700 to-burgundy" />

          {/* Back button - absolute positioned in top-left corner */}
          <Link
            to="/"
            className="btn-ghost absolute top-4 left-4 px-3 py-1.5 text-xs inline-flex items-center gap-1 z-10"
          >
            <ArrowLeft size={13} />
            На главную
          </Link>

          <div className="p-8">
            {/* Logo + heading */}
            <div className="flex flex-col items-center mb-8 mt-12">
              <BrandLogo
                showText
                text="Gradus"
                iconClassName="h-9 w-9"
                textClassName="text-2xl font-bold font-display text-[var(--text)]"
              />
              <h1 className="font-display font-bold text-2xl mt-4 mb-1 text-[var(--text)]">
                {twoFactorMode ? "Подтверждение входа" : "Добро пожаловать"}
              </h1>
              <p className="text-sm text-[var(--muted)]">
                {twoFactorMode ? "Введите 6-значный код из письма" : "Войдите в свой аккаунт"}
              </p>
            </div>

            {/* Form */}
            <div className="space-y-3" onKeyDown={handleKeyDown}>
              {!twoFactorMode ? (
                <>
                  {/* Email */}
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

                  {/* Password */}
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                    <input
                      type={passwordVisible ? "text" : "password"}
                      placeholder="Пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pl-10 pr-11 py-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((p) => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Forgot */}
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors">
                      Забыли пароль?
                    </Link>
                  </div>
                </>
              ) : (
                /* 2FA code */
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Код из письма (6 цифр)"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    maxLength={6}
                    className="input-field pl-10 pr-4 py-3 text-sm tracking-[0.2em] text-center"
                    autoFocus
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <p
                  className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-lg"
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={twoFactorMode ? handleVerify2fa : handleLogin}
                disabled={loading}
                className="btn-primary w-full py-3 text-sm mt-2 gap-2"
              >
                {loading
                  ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : twoFactorMode ? "Подтвердить" : (
                    <><span>Войти</span><ArrowRight size={16} /></>
                  )
                }
              </button>

              {twoFactorMode && (
                <button
                  onClick={() => { setTwoFactorMode(false); setTwoFactorCode(""); setChallengeId("") }}
                  className="w-full text-center text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors py-1"
                >
                  Сменить аккаунт
                </button>
              )}
            </div>

            {/* Footer */}
            {!twoFactorMode && (
              <p className="text-sm text-center mt-6 text-[var(--muted)]">
                Нет аккаунта?{" "}
                <Link to="/register" className="font-semibold text-primary hover:text-primary-700 transition-colors">
                  Зарегистрироваться
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </AuthScreenShell>
  )
}
