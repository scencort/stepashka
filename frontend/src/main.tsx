// ─── ТОЧКА ВХОДА ПРИЛОЖЕНИЯ ───────────────────────────────────────────────────
// ReactDOM.createRoot берёт div#root из index.html и отдаёт его React
// "!" (non-null assertion) говорит TypeScript: "доверяй мне, этот элемент точно есть"
// если div#root вдруг не найдётся — упадёт в рантайме, но это баг в HTML а не в коде
//
// ПОРЯДОК ЗАПУСКА после createRoot().render():
//   1. ThemeProvider → читает localStorage → вешает класс "dark" на <html> если нужно
//   2. AppStoreProvider → запускает useEffect → параллельно:
//        GET /auth/me  → кто залогинен → setUser()      (loadingUser: true→false)
//        GET /courses  → каталог курсов → setCourses()  (loadingCourses: true→false)
//   3. ToastProvider → создаёт портал для тостов поверх всего DOM-дерева
//   4. App → BrowserRouter → смотрит на текущий URL → рендерит нужный Route
//
// ПОЧЕМУ ПРОВАЙДЕРЫ В ТАКОМ ПОРЯДКЕ:
//   ThemeProvider снаружи всех — тема нужна буквально каждому компоненту включая тосты
//   AppStoreProvider внутри темы — стор может рендерить тематизированные скелетоны
//   ToastProvider внутри стора — тосты могут вызывать store.logout() при ошибке 401
//   App внутри всех — страницы используют и тему и стор и тосты
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ThemeProvider } from "./context/ThemeContext"
import { AppStoreProvider } from "./store/AppStore"
import { ToastProvider } from "./hooks/useToast"

ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode — только в режиме разработки, на проде ведёт себя как обычный Fragment
  // в dev-режиме специально рендерит каждый компонент ДВАЖДЫ чтобы поймать побочные эффекты
  // помогает заметить баги в useEffect до того как они попадут к пользователям
  <React.StrictMode>
    {/* тема самая внешняя — вешает класс "dark" на <html>, все Tailwind dark: классы зависят от этого */}
    <ThemeProvider>
      {/* стор загружает юзера и курсы при старте — все страницы ждут этих данных */}
      <AppStoreProvider>
        {/* тосты рендерятся через React Portal — появляются поверх любого контента на странице */}
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppStoreProvider>
    </ThemeProvider>
  </React.StrictMode>
)
