// страница регистрации — три поля: имя, email, пароль
// после регистрации сразу логинит и отправляет на дашборд
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import AuthScreenShell from "../components/auth/AuthScreenShell"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, ArrowLeft } from "lucide-react"
import { useAppStore } from "../store/AppStore"
import { useToast } from "../hooks/useToast"
import BrandLogo from "../components/BrandLogo"


export default function Register() {
  const navigate = useNavigate()
  const { register } = useAppStore()
  const toast = useToast()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false) // показать/скрыть пароль

  // проверяем поля перед отправкой — минимальная валидация на клиенте
  const validate = () => {
    if (name.trim().length < 2) return "Имя — минимум 2 символа"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return "Введите корректный email"
    if (password.trim().length < 8) return "Пароль — минимум 8 символов"
    return ""
  }

  // отправляем данные на сервер — при успехе сразу на дашборд
  const handleRegister = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError("")
    try {
      await register(name, email, password)
      toast.success("Аккаунт создан!")
      navigate("/dashboard")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка регистрации"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  // enter в любом поле отправляет форму
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") void handleRegister()
  }

  return (
    <AuthScreenShell>
      <div
        className="w-full max-w-[420px] relative z-10"
      >
        <div className="bg-white/95 dark:bg-[#140808]/95 border border-[var(--border)] rounded-3xl shadow-card-lg backdrop-blur-xl overflow-hidden relative">
          {/* цветная полоска вверху карточки */}
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-700 to-burgundy" />

          {/* кнопка назад на лендинг */}
          <Link
            to="/"
            className="btn-ghost absolute top-4 left-4 px-3 py-1.5 text-xs inline-flex items-center gap-1 z-10"
          >
            <ArrowLeft size={13} />
            На главную
          </Link>

          <div className="p-8">
            {/* лого и заголовок */}
            <div className="flex flex-col items-center mb-8 mt-12">
              <BrandLogo
                showText
                text="Gradus"
                iconClassName="h-9 w-9"
                textClassName="text-2xl font-bold font-display text-[var(--text)]"
              />
              <h1 className="font-display font-bold text-2xl mt-4 mb-1 text-[var(--text)]">
                Создать аккаунт
              </h1>
              <p className="text-sm text-[var(--muted)]">Начните обучение бесплатно</p>
            </div>

            {/* форма регистрации — три поля */}
            <div className="space-y-3" onKeyDown={handleKeyDown}>
              {/* поле имени — автофокус чтобы сразу начать вводить */}
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Имя"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-10 pr-4 py-3 text-sm"
                  autoFocus
                />
              </div>

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
                  placeholder="Пароль (мин. 8 символов)"
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

              {/* подсказка о роли — новые пользователи всегда студенты */}
              <p className="text-xs text-[var(--muted)] px-1">
                Аккаунт создаётся с ролью студента. Роль преподавателя — через администратора.
              </p>

              {/* ошибка валидации или серверная ошибка */}
              {error && (
                <p
                  className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-lg"
                >
                  {error}
                </p>
              )}

              {/* кнопка регистрации со спиннером во время загрузки */}
              <button
                onClick={handleRegister}
                disabled={loading}
                className="btn-primary w-full py-3 text-sm mt-1 gap-2"
              >
                {loading
                  ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><span>Зарегистрироваться</span><ArrowRight size={16} /></>
                }
              </button>
            </div>

            {/* ссылка на страницу входа */}
            <p className="text-sm text-center mt-6 text-[var(--muted)]">
              Уже есть аккаунт?{" "}
              <Link to="/login" className="font-semibold text-primary hover:text-primary-700 transition-colors">
                Войти
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthScreenShell>
  )
}
