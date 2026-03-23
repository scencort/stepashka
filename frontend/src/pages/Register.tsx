import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"

import { fadeInUp } from "../lib/animations"

export default function Register() {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleRegister = () => {
    if (name && email && password) {
      navigate("/dashboard")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">

      <motion.div
        variants={fadeInUp}
        initial="initial"
        animate="animate"
        className="w-full max-w-md"
      >

        <Card>

          <h2 className="text-2xl font-bold mb-6 text-center">
            Регистрация
          </h2>

          <input
            type="text"
            placeholder="Имя"
            className="w-full mb-4 px-4 py-3 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full mb-4 px-4 py-3 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Пароль"
            className="w-full mb-6 px-4 py-3 border rounded-lg bg-white dark:bg-gray-900 dark:border-gray-700"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button className="w-full" onClick={handleRegister}>
            Зарегистрироваться
          </Button>

          <p className="text-sm text-center mt-4 text-gray-500">
            Уже есть аккаунт?{" "}
            <Link to="/login" className="text-red-600">
              Войти
            </Link>
          </p>

        </Card>

      </motion.div>

    </div>
  )
}