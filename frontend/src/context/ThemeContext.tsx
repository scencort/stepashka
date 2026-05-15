// ThemeProvider — управляет тёмной/светлой темой во всём приложении
// механика: Tailwind смотрит на класс "dark" у тега <html>
//   если класс есть → все dark:bg-... dark:text-... классы становятся активными
//   если нет → работают обычные классы
// этот провайдер добавляет/убирает этот класс при переключении темы
//
// приоритет при первой загрузке:
//   1. localStorage ("gradus_theme") — пользователь уже выбирал раньше
//   2. prefers-color-scheme — системная настройка ОС
//   3. "light" — дефолт если ничего не нашли
import { useEffect, useState } from "react"
import { ThemeContext, type Theme } from "./theme"

// ключ в localStorage — строка константа чтобы не опечататься в разных местах
const STORAGE_KEY = "gradus_theme"

// функция определяет начальную тему один раз при запуске
// передаётся в useState как инициализатор (не результат вызова, а сама функция)
// это важно: useState(getInitialTheme) вызовет функцию один раз
// а useState(getInitialTheme()) вызовет её сразу при каждом рендере — лишняя работа
function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  // проверяем что в localStorage именно "light" или "dark" а не мусор
  if (stored === "light" || stored === "dark") return stored
  // window.matchMedia — браузерное API для проверки медиа-запросов
  // "(prefers-color-scheme: dark)" — истина если ОС в тёмном режиме
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark"
  return "light"
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // getInitialTheme передаём как функцию — React вызовет её один раз при инициализации
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  // просто переключает между двумя значениями — никакой сложной логики
  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"))
  }

  // useEffect запускается каждый раз когда меняется theme
  // внутри: применяем класс к <html> и сохраняем в localStorage
  // делаем это в useEffect а не в toggleTheme потому что:
  //   1. DOM-манипуляции должны быть в эффектах (React-соглашение)
  //   2. при первом рендере тоже нужно применить класс — useEffect сработает сразу
  useEffect(() => {
    const root = document.documentElement // это и есть тег <html>

    if (theme === "dark") {
      root.classList.add("dark")    // Tailwind увидит класс → активирует dark: стили
    } else {
      root.classList.remove("dark") // убираем → обычные стили
    }

    // сохраняем выбор пользователя — при следующем открытии getInitialTheme прочитает его
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme]) // [theme] — запускать только когда theme изменился

  return (
    // ThemeContext.Provider раздаёт { theme, toggleTheme } всем дочерним компонентам
    // любой компонент может вызвать useTheme() и получить текущую тему или переключить её
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
