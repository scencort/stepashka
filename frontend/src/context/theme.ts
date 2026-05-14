// контекст темы — определяет типы и создаёт контекст для тёмной/светлой темы
// сам провайдер в ThemeContext.tsx, хук здесь для удобного импорта
import { createContext, useContext } from "react"

// два возможных значения — светлая или тёмная
export type Theme = "light" | "dark"

export type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
}

// null как дефолт — если кто-то использует хук вне провайдера, сразу кинем ошибку
export const ThemeContext = createContext<ThemeContextType | null>(null)

// удобный хук — бросает понятную ошибку если забыли обернуть в ThemeProvider
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
