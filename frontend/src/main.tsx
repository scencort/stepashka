// точка входа приложения — здесь React монтируется в div#root из index.html
// порядок провайдеров важен: каждый следующий может использовать предыдущий
//   ThemeProvider — самый внешний, чтобы тема была доступна всем включая тосты
//   AppStoreProvider — загружает юзера и курсы при старте (useEffect в провайдере)
//   ToastProvider — рендерит тосты поверх App, но внутри стора (может показывать ошибки API)
//   App → Router → конкретная страница
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
