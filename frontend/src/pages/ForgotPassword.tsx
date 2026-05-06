import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react"
import AuthScreenShell from "../components/auth/AuthScreenShell"
import { api } from "../services/api"
import { useToast } from "../hooks/useToast"
import BrandLogo from "../components/BrandLogo"

type ForgotPasswordResponse = { success: boolean; message: string; devCode?: string; devMode?: boolean }


export default function ForgotPassword() {
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) return "Введите корректный email"
    return ""
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError("")
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
      }, 1500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось отправить email"
      setError(msg); toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <AuthScreenShell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="w-full max-w-[420px] relative z-10">
        <div className="bg-white/95 dark:bg-[#140808]/95 border border-[var(--border)] rounded-3xl shadow-card-lg backdrop-blur-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-primary-700 to-burgundy" />

          <div className="p-8">
            <div className="flex flex-col items-center mb-8">
              <BrandLogo showText text="Gradus" iconClassName="h-9 w-9" textClassName="text-2xl font-bold font-display text-[var(--text)]" />
              <h1 className="font-display font-bold text-2xl mt-4 mb-1 text-[var(--text)]">Восстановление пароля</h1>
              <p className="text-sm text-[var(--muted)] text-center">Введите email — мы пришлём код для сброса</p>
            </div>

            {!submitted ? (
              <div className="space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
                    className="input-field pl-10 pr-4 py-3 text-sm"
                    autoFocus
                  />
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-3 py-2 rounded-lg"
                  >
                    {error}
                  </motion.p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn-primary w-full py-3 text-sm gap-2"
                >
                  {loading
                    ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><span>Отправить код</span><ArrowRight size={16} /></>
                  }
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-green-500" />
                </div>
                <p className="font-semibold mb-1">Письмо отправлено</p>
                <p className="text-sm text-[var(--muted)]">Если аккаунт существует, проверьте почту</p>
              </div>
            )}

            <p className="text-sm text-center mt-6 text-[var(--muted)]">
              <Link to="/login" className="inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-700 transition-colors">
                <ArrowLeft size={14} /> Назад ко входу
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </AuthScreenShell>
  )
}
