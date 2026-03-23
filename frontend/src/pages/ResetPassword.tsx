import { useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Lock, ShieldCheck, Mail, KeyRound } from "lucide-react"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import { api } from "../services/api"
import { useToast } from "../hooks/useToast"
import { fadeInUp } from "../lib/animations"

type ResetPasswordResponse = {
  success: boolean
  message: string
}

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
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "Введите корректный email"
    }

    if (!/^\d{6}$/.test(code.trim())) {
      return "Введите 6-значный код"
    }

    if (password.trim().length < 8) {
      return "Пароль должен содержать минимум 8 символов"
    }

    if (password !== confirmPassword) {
      return "Пароли не совпадают"
    }

    return ""
  }

  const handleSubmit = async () => {
    const formError = validate()
    if (formError) {
      setError(formError)
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await api.post<ResetPasswordResponse>("/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
      })
      toast.success(response.message)
      navigate("/login")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось обновить пароль"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="w-full max-w-md">
        <Card className="p-7 md:p-8">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full glass-panel mb-4 text-slate-600 dark:text-slate-300">
            <ShieldCheck size={13} /> Новый пароль
          </div>

          <h2 className="text-2xl font-bold mb-6 text-center">Сброс пароля</h2>

          {!!devCodeFromQuery && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-4 text-center">
              DEV режим: код автоматически подставлен в поле.
            </p>
          )}

          <div className="relative mb-4">
            <Mail size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="email"
              placeholder="Email"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative mb-4">
            <KeyRound size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Код из email"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
            />
          </div>

          <div className="relative mb-4">
            <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="password"
              placeholder="Новый пароль"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="relative mb-6">
            <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="password"
              placeholder="Подтвердите пароль"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-700 dark:text-rose-300 mb-4">{error}</p>}

          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Обновляем..." : "Обновить пароль"}
          </Button>

          <p className="text-sm text-center mt-4 text-slate-500">
            <Link to="/login" className="text-red-700 dark:text-rose-300 font-semibold">
              Назад ко входу
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  )
}
