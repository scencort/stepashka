import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, KeyRound } from "lucide-react"
import Card from "../components/ui/Card"
import Button from "../components/ui/Button"
import AuthScreenShell from "../components/auth/AuthScreenShell"
import { api } from "../services/api"
import { useToast } from "../hooks/useToast"
import { fadeInUp } from "../lib/animations"

type ForgotPasswordResponse = {
  success: boolean
  message: string
  devCode?: string
  devMode?: boolean
}

export default function ForgotPassword() {
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return "Введите корректный email"
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
      const response = await api.post<ForgotPasswordResponse>("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      })
      setSubmitted(true)
      toast.success(response.message)
      setTimeout(() => {
        const query = new URLSearchParams({
          email: email.trim().toLowerCase(),
          ...(response.devCode ? { devCode: response.devCode } : {}),
        })
        navigate(`/reset-password?${query.toString()}`)
      }, 700)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось отправить email"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreenShell>
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="w-full max-w-md">
        <Card className="p-7 md:p-8">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full glass-panel mb-4 text-slate-600 dark:text-slate-300">
            <KeyRound size={13} /> Восстановление аккаунта
          </div>

          <h2 className="text-2xl font-bold mb-3 text-center">Восстановление пароля</h2>
          <p className="text-sm text-slate-500 dark:text-slate-300 mb-6 text-center">
            Введите email, и мы отправим код для сброса.
          </p>

          {!submitted && (
            <>
              <div className="relative mb-6">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>}

              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading ? "Отправка..." : "Отправить код"}
              </Button>
            </>
          )}

          {submitted && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4 text-center">
              Если аккаунт с таким email существует, код отправлен.
            </p>
          )}

          <p className="text-sm text-center mt-4 text-slate-500">
            Вспомнили пароль?{" "}
            <Link to="/login" className="text-red-700 dark:text-red-300 font-semibold">
              Войти
            </Link>
          </p>
        </Card>
      </motion.div>
    </AuthScreenShell>
  )
}
