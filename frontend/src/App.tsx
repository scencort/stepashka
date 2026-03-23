import { BrowserRouter, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Router } from "./router"

const BASE_TITLE = "Stepashka"

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/course/")) {
    return "Прохождение курса"
  }

  const titles: Record<string, string> = {
    "/": "Главная",
    "/login": "Вход",
    "/register": "Регистрация",
    "/forgot-password": "Восстановление пароля",
    "/reset-password": "Сброс пароля",
    "/dashboard": "Панель",
    "/course": "Курсы",
    "/task": "Задания",
    "/learning-paths": "Траектории обучения",
    "/ai-review": "AI-проверка",
    "/assignment-builder": "Конструктор заданий",
    "/teacher/assignments": "Конструктор заданий",
    "/analytics": "Аналитика",
    "/roles-access": "Роли и доступ",
    "/feedback": "Обратная связь",
    "/help-center": "Центр помощи",
    "/account": "Профиль и настройки",
    "/teacher": "Кабинет преподавателя",
    "/admin": "Админ-панель",
  }

  return titles[pathname] || "Платформа обучения"
}

function AnimatedRoutes() {
  const location = useLocation()

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname)
    document.title = `${pageTitle} | ${BASE_TITLE}`
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.25 }}
      >
        <Router />
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}