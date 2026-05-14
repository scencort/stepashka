// провайдер темы — управляет переключением light/dark режима
// как это работает: tailwind смотрит на класс "dark" у <html> элемента
//   если класс есть — все dark:* классы становятся активными
//   useEffect следит за темой и синхронизирует document.documentElement.classList
// приоритет при загрузке: localStorage → prefers-color-scheme → light (дефолт)
import { useEffect, useState } from "react"
import { ThemeContext, type Theme } from "./theme"

// ключ в localStorage — чтобы тема сохранялась между сессиями
const STORAGE_KEY = "gradus_theme"

// определяем начальную тему — сначала смотрим localStorage, потом system preference
function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark") return stored
  // если пользователь явно настроил тёмную тему в системе — уважаем это
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
  return "light"
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // getInitialTheme передаём как функцию-инициализатор — вызовется один раз
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // переключение темы — просто тогл между двумя значениями
  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"))
  }

  // при смене темы применяем класс к html и сохраняем в localStorage
  useEffect(() => {
    const root = document.documentElement

    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }

    // сохраняем чтобы при следующем открытии страницы тема не сбрасывалась
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
