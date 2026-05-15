// ─── ТОЧКА ВХОДА ПРИЛОЖЕНИЯ ───────────────────────────────────────────────────
// здесь React монтируется в div#root из index.html
//
// ПОРЯДОК ЗАПУСКА ПРИЛОЖЕНИЯ:
//   1. ReactDOM.createRoot → монтирует React в div#root
//   2. ThemeProvider → читает тему из localStorage, вешает класс "dark" на <html>
//   3. AppStoreProvider → запускает useEffect:
//        - GET /auth/me  → определяет кто залогинен → setUser()
//        - GET /courses  → загружает каталог курсов  → setCourses()
//   4. ToastProvider → создаёт контейнер для всплывающих уведомлений
//   5. App → BrowserRouter → Router → рендерит нужную страницу по URL
//
// ПОРЯДОК ПРОВАЙДЕРОВ ВАЖЕН:
//   ThemeProvider — самый внешний, тема нужна всем включая тосты
//   AppStoreProvider — внутри темы, снаружи тостов (тосты могут звать store)
//   ToastProvider — снаружи App, тосты всплывают поверх любой страницы
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./context/ThemeContext"
import { AppStoreProvider } from "./store/AppStore"
import { ToastProvider } from "./hooks/useToast"

ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode помогает ловить проблемы в разработке — двойной рендер и т.д.
  <React.StrictMode>
    {/* тема самая внешняя — чтобы всё приложение знало текущую тему */}
    <ThemeProvider>
      {/* стор с пользователем и логикой запросов */}
      <AppStoreProvider>
        {/* тосты рендерятся поверх всего — поэтому внутри стора, но снаружи App */}
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppStoreProvider>
    </ThemeProvider>
  </React.StrictMode>
)
