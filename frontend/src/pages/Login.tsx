// страница входа — email + пароль, с поддержкой двухфакторной аутентификации
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import AuthScreenShell from "../components/auth/AuthScreenShell"
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react"
import { useAppStore } from "../store/AppStore"
import { useToast } from "../hooks/useToast"
import BrandLogo from "../components/BrandLogo"


export default function Login() {
  const navigate = useNavigate()
  const { login, verifyTwoFactor } = useAppStore()
  const toast = useToast()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)

  // если сервер вернул twoFactorRequired — переходим в режим ввода кода
  const [twoFactorPending, setTwoFactorPending] = useState<string | null>(null) // pending токен для 2fa
  const [twoFactorCode, setTwoFactorCode] = useState("")

  // базовая валидация перед отправкой
  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return "Введите корректный email"
    if (password.trim().length < 8) return "Пароль — минимум 8 символов"
    return ""
  }

  // основной логин — после успеха либо редиректим либо переключаемся на 2fa экран
  const handleLogin = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError("")
    try {
      const result = await login(email, password)
      if (result.kind === "twoFactorRequired") {
        // сервер хочет второй фактор — показываем поле ввода кода
        setTwoFactorPending(result.pendingToken)
        setTwoFactorCode("")
        toast.success("Введите код из приложения-аутентификатора")
        return
      }
      toast.success("Вход выполнен")
      navigate("/dashboard")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка входа"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  // подтверждение 2fa — отправляем pendingToken + 6-значный код
  const handleTwoFactorVerify = async () => {
    const code = twoFactorCode.trim()
    if (!/^\d{6}$/.test(code)) {
      setError("Код должен содержать 6 цифр")
      return
    }
    if (!twoFactorPending) return
    setLoading(true); setError("")
    try {
      await verifyTwoFactor(twoFactorPending, code)
      toast.success("Вход выполнен")
      navigate("/dashboard")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неверный код"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  // отменить 2fa — вернуться к форме email/пароля
  const cancelTwoFactor = () => {
    setTwoFactorPending(null)
    setTwoFactorCode("")
    setError("")
  }

  // enter отправляет форму — или логин или 2fa в зависимости от текущего экрана
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (twoFactorPending) void handleTwoFactorVerify()
      else void handleLogin()
    }
  }

  return (
    <AuthScreenShell>
      <div
        className="w-full max-w-[420px] relative z-10"
      >
        {/* карточка с формой */}
        <div className="bg-white/95 dark:bg-[#140808]/95 border border-[var(--border)] rounded-3xl shadow-card-lg backdrop-blur-xl overflow-hidden relative">
          {/* цветная полоска сверху */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-700 to-burgundy" />

          {/* кнопка назад на лендинг — абсолютно позиционирована */}
          <Link
            to="/"
            className="btn-ghost absolute top-4 left-4 px-3 py-1.5 text-xs inline-flex items-center gap-1 z-10"
          >
            <ArrowLeft size={13} />
            На главную
          </Link>

          <div className="p-8">
            {/* лого + заголовок — меняется в зависимости от режима (логин / 2fa) */}
            <div className="flex flex-col items-center mb-8 mt-12">
              <BrandLogo
                showText
                text="Gradus"
                iconClassName="h-9 w-9"
                textClassName="text-2xl font-bold font-display text-[var(--text)]"
              />
              <h1 className="font-display font-bold text-2xl mt-4 mb-1 text-[var(--text)]">
                {twoFactorPending ? "Подтверждение входа" : "Добро пожаловать"}
              </h1>
              <p className="text-sm text-[var(--muted)]">
                {twoFactorPending
                  ? "Введите 6-значный код из Google Authenticator"
                  : "Войдите в свой аккаунт"}
              </p>
            </div>

            {/* форма — содержимое меняется в зависимости от режима */}
            <div className="space-y-3" onKeyDown={handleKeyDown}>
              {!twoFactorPending && (
                <>
                  {/* поле email */}
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

                  {/* поле пароля с кнопкой показать/скрыть */}
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

                  {/* ссылка на сброс пароля */}
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs font-semibold text-primary hover:text-primary-700 transition-colors">
                      Забыли пароль?
                    </Link>
                  </div>
                </>
              )}

              {/* экран ввода кода двухфакторной аутентификации */}
              {twoFactorPending && (
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFactorCode}
                    // разрешаем только цифры, максимум 6 штук
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="input-field pl-10 pr-4 py-3 text-base tracking-[0.4em] text-center font-mono"
                    autoFocus
                  />
                </div>
              )}

              {/* ошибка — показываем прямо в форме */}
              {error && (
                <p
                  className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-lg"
                >
                  {error}
                </p>
              )}

              {/* основная кнопка — "Войти" или "Подтвердить" */}
              {!twoFactorPending ? (
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm mt-2 gap-2"
                >
                  {loading
                    ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><span>Войти</span><ArrowRight size={16} /></>
                  }
                </button>
              ) : (
                <div className="space-y-2 mt-2">
                  <button
                    onClick={handleTwoFactorVerify}
                    disabled={loading || twoFactorCode.length !== 6}
                    className="btn-primary w-full py-3 text-sm gap-2"
                  >
                    {loading
                      ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><ShieldCheck size={16} /><span>Подтвердить</span></>
                    }
                  </button>
                  {/* кнопка отмены 2fa — возвращает к форме email/пароля */}
                  <button
                    type="button"
                    onClick={cancelTwoFactor}
                    className="btn-ghost w-full py-2.5 text-xs"
                  >
                    Назад
                  </button>
                </div>
              )}
            </div>

            {/* ссылка на регистрацию — только на основном экране */}
            {!twoFactorPending && (
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
