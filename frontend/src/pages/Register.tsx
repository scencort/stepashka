import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import { UserRoundPlus, User, Mail, Lock } from "lucide-react"
import { useAppStore } from "../store/AppStore"
import { useToast } from "../hooks/useToast"

import { fadeInUp } from "../lib/animations"

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAppStore()
  const toast = useToast()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = () => {
    if (name.trim().length < 2) {
      return "Введите имя минимум из 2 символов"
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) {
      return "Введите корректный email"
    }

    if (password.trim().length < 8) {
      return "Пароль должен содержать минимум 8 символов"
    }

    return ""
  }

  const handleRegister = async () => {
    const formError = validate()
    if (formError) {
      setError(formError)
      return
    }

    setLoading(true)
    setError("")
    try {
      await register(name, email, password)
      toast.success("Аккаунт создан")
      navigate("/dashboard")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ошибка регистрации"
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
            <UserRoundPlus size={13} /> Новый аккаунт
          </div>

          <h2 className="text-2xl font-bold mb-6 text-center">
            Регистрация
          </h2>

          <div className="relative mb-4">
            <User size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Имя"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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

          <div className="relative mb-6">
            <Lock size={15} className="absolute left-3 top-3.5 text-slate-500" />
            <input
              type="password"
              placeholder="Пароль"
              className="w-full pl-10 pr-4 py-3 rounded-xl glass-panel outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <p className="text-sm mb-6 text-slate-500 dark:text-slate-300">
            Аккаунты создаются с ролью студента. Повышение до преподавателя или администратора доступно только через админ-панель.
          </p>

          {error && (
            <p className="text-sm text-red-700 dark:text-rose-300 mb-4">{error}</p>
          )}

          <Button className="w-full" onClick={handleRegister} disabled={loading}>
            {loading ? "Создаем аккаунт..." : "Зарегистрироваться"}
          </Button>

          <p className="text-sm text-center mt-4 text-slate-500">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="text-red-700 dark:text-rose-300 font-semibold">
              Войти
            </Link>
          </p>

        </Card>

      </motion.div>

    </div>
  )
}