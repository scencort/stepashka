import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import { LogIn, Mail, Lock } from "lucide-react"
import { useAppStore } from "../store/AppStore"
import { useToast } from "../hooks/useToast"

import { fadeInUp } from "../lib/animations"

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

  const validate = () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "Введите корректный email"
    }

    if (password.trim().length < 8) {
      return "Пароль должен содержать минимум 8 символов"
    }

    return ""
  }

  const handleLogin = async () => {
    const formError = validate()
    if (formError) {
      setError(formError)
      return
    }

    setLoading(true)
    setError("")
    try {
      const result = await login(email, password)
      if (result.requiresTwoFactor) {
        setTwoFactorMode(true)
        setChallengeId(result.challengeId || "")
        toast.success("Введите код 2FA")
        if (result.devCode) {
          toast.success(`DEV code: ${result.devCode}`)
        }
      } else {
        toast.success("Вход выполнен")
        navigate("/dashboard")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка входа"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2fa = async () => {
    if (!challengeId) {
      setError("Challenge не найден, повторите вход")
      return
    }

    if (!/^\d{6}$/.test(twoFactorCode.trim())) {
      setError("Введите 6-значный код")
      return
    }

    setLoading(true)
    setError("")
    try {
      await verifyTwoFactorLogin(challengeId, twoFactorCode.trim())
      toast.success("2FA подтверждена")
      navigate("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка проверки 2FA"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="w-full max-w-md"
      >

        <Card className="p-7 md:p-8">

          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full glass-panel mb-4 text-slate-600 dark:text-slate-300">
            <LogIn size={13} /> Доступ к аккаунту
          </div>

          <h2 className="text-2xl font-bold mb-6 text-center">
            Вход
          </h2>

          <div className="relative mb-4">
            <Mail size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="email"
              placeholder="Email"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={twoFactorMode}
            />
          </div>

          <div className="relative mb-6">
            <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="password"
              placeholder="Пароль"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={twoFactorMode}
            />
          </div>

          {twoFactorMode && (
            <div className="relative mb-6">
              <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Код 2FA"
                className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
              />
            </div>
          )}

          <div className="mb-6 text-center">
            <Link to="/forgot-password" className="text-sm text-red-700 dark:text-rose-300 font-semibold">
              Забыли пароль?
            </Link>
          </div>

          {error && (
            <p className="text-sm text-red-700 dark:text-rose-300 mb-4">{error}</p>
          )}

          <Button className="w-full" onClick={twoFactorMode ? handleVerify2fa : handleLogin} disabled={loading}>
            {loading ? "Проверяем..." : twoFactorMode ? "Подтвердить 2FA" : "Войти"}
          </Button>

          {twoFactorMode && (
            <button
              onClick={() => {
                setTwoFactorMode(false)
                setTwoFactorCode("")
                setChallengeId("")
              }}
              className="mt-3 text-sm text-slate-500"
            >
              Сменить аккаунт
            </button>
          )}

          <p className="text-sm text-center mt-4 text-slate-500">
            Еще нет аккаунта?{" "}
            <Link to="/register" className="text-red-700 dark:text-rose-300 font-semibold">
              Регистрация
            </Link>
          </p>

        </Card>

      </motion.div>

    </div>
  )
}