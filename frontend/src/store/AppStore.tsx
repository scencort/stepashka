/* eslint-disable react-refresh/only-export-components */
// ─── ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ СОСТОЯНИЯ (AppStore) ───────────────────────────────
// AppStore — это глобальный "склад данных" который доступен любому компоненту
// хранит: текущего пользователя, список курсов, флаги загрузки
// реализован через React Context — это встроенный механизм React для передачи данных
// без него пришлось бы передавать user через props через 5-10 уровней компонентов (prop drilling)
//
// КАК ИСПОЛЬЗОВАТЬ В ЛЮБОМ КОМПОНЕНТЕ:
//   const { user, login, logout } = useAppStore()
//   — вот и всё, никаких лишних imports кроме этой строки
//
// КАК РАБОТАЕТ Context изнутри:
//   AppStoreProvider создаёт "контейнер" с данными
//   он оборачивает всё приложение в main.tsx
//   любой компонент внутри этой обёртки может вызвать useContext и получить данные
//   при изменении данных (setUser, setCourses) — все компоненты которые их читают перерисуются
//
// ПОЧЕМУ НЕ REDUX:
//   Redux — тяжёлая библиотека с actions, reducers, dispatch
//   здесь хранится только user и courses — Context + useState проще и достаточно
import { createContext, useContext, useEffect, useState } from "react"
import { api, type Course, type LoginResult, type PublicUser } from "../services/api"

// описание всего что можно получить или сделать через стор
// это TypeScript-контракт: если добавить новый метод — нужно добавить его сюда
type AppStoreContextValue = {
  user: PublicUser | null          // текущий юзер или null если не залогинен
  courses: Course[]                // список всех курсов каталога
  loadingUser: boolean             // true пока летит GET /auth/me (первые ~300мс)
  loadingCourses: boolean          // true пока летит GET /courses
  refreshUser: () => Promise<void>
  login: (email: string, password: string) => Promise<LoginResult>
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<PublicUser>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshCourses: () => Promise<void>
}

// createContext(null) создаёт "пустой контейнер"
// null — начальное значение до того как провайдер его заполнит
// в реальности провайдер всегда заполняет его раньше чем компоненты успеют прочитать
const AppStoreContext = createContext<AppStoreContextValue | null>(null)

type Props = {
  children: React.ReactNode
}

// AppStoreProvider — оборачивает всё приложение и раздаёт стор вниз по дереву
// в main.tsx он стоит вокруг <App> — значит абсолютно все компоненты имеют доступ к стору
export function AppStoreProvider({ children }: Props) {
  // null = ещё не знаем кто залогинен (ответ от /auth/me ещё не пришёл)
  // после GET /auth/me: либо PublicUser если токен валидный, либо снова null
  const [user, setUser] = useState<PublicUser | null>(null)
  // пустой массив = курсы ещё не загружены, компоненты покажут скелетоны
  const [courses, setCourses] = useState<Course[]>([])
  // оба флага true с самого начала — данные грузятся сразу при старте
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingCourses, setLoadingCourses] = useState(true)

  // загружает каталог курсов с бэкенда
  // вызывается при старте приложения и после логина (чтобы курсы были свежими)
  // api.get("/courses") → routeMappings → GET /catalog → toCourse() на каждый элемент
  const refreshCourses = async () => {
    setLoadingCourses(true)
    try {
      const data = await api.get<Course[]>("/courses")
      setCourses(data)
    } finally {
      // finally выполняется ВСЕГДА — и при успехе и при ошибке
      // это гарантирует что loadingCourses никогда не зависнет на true
      setLoadingCourses(false)
    }
  }

  // проверяет кто сейчас залогинен — спрашивает бэкенд по токену
  // если access token в localStorage есть и валиден → бэк вернёт PublicUser
  // если токен протух → api.ts автоматически попробует обновить через refresh token
  // если refresh тоже протух → вернёт null, пользователь считается незалогиненным
  const refreshUser = async () => {
    setLoadingUser(true)
    try {
      const me = await api.get<PublicUser | null>("/auth/me")
      setUser(me) // null если не залогинен, PublicUser если залогинен
    } finally {
      setLoadingUser(false)
    }
  }

  // useEffect с [] запускается ОДИН РАЗ при первом рендере провайдера
  // то есть сразу при старте приложения — ещё до того как пользователь что-то увидел
  // void перед вызовом — это способ сказать TypeScript что мы игнорируем Promise
  useEffect(() => {
    void refreshUser()    // узнаём кто залогинен
    void refreshCourses() // параллельно грузим курсы
  }, [])

  // вход в аккаунт — POST /auth/login с email и паролем
  // бэк возвращает либо токены (kind="authenticated") либо запрос на 2FA (kind="twoFactorRequired")
  // если аутентифицированы сразу — сохраняем юзера и обновляем курсы
  // если нужна 2FA — возвращаем pendingToken наверх, Login.tsx покажет поле для кода
  const login = async (email: string, password: string) => {
    const result = await api.post<LoginResult>("/auth/login", { email, password })
    if (result.kind === "authenticated") {
      setUser(result.user)
      // грузим курсы сразу после логина — они нужны на дашборде
      // делаем это здесь чтобы к моменту рендера Dashboard курсы уже были
      await refreshCourses()
    }
    return result // Login.tsx получит результат и решит что показать дальше
  }

  // второй шаг двухфакторной аутентификации
  // pendingToken — временный JWT выданный бэком на первом шаге (живёт ~5 минут)
  // code — 6-значный TOTP из Google Authenticator, меняется каждые 30 секунд
  // бэк проверяет код через TOTP-алгоритм и если всё ок — выдаёт полноценные токены
  const verifyTwoFactor = async (pendingToken: string, code: string) => {
    const user = await api.post<PublicUser>("/auth/2fa/verify", { pendingToken, code })
    setUser(user)
    await refreshCourses()
    return user
  }

  // регистрация — POST /auth/register, бэк создаёт пользователя и сразу выдаёт токены
  // api.ts сохранит токены в localStorage через setTokens()
  // после этого вызываем setUser и refreshCourses — пользователь сразу попадает в систему
  const register = async (name: string, email: string, password: string) => {
    const auth = await api.post<PublicUser>("/auth/register", { name, email, password })
    setUser(auth)
    await refreshCourses()
  }

  // выход из аккаунта
  // сначала POST /auth/logout — бэк инвалидирует refresh token в базе данных
  // api.ts при этом вызывает clearTokens() — удаляет оба токена из localStorage
  // потом setUser(null) — React перерисует все компоненты, ProtectedRoute увидит null
  //   и перенаправит на /login
  // порядок важен: сначала запрос, потом очистка — если сделать наоборот,
  //   запрос отправится без токена и бэк не поймёт какую сессию завершить
  const logout = async () => {
    await api.post<{ success: boolean }>("/auth/logout", {})
    setUser(null)
  }

  // собираем все данные и методы в один объект для передачи через контекст
  const value: AppStoreContextValue = {
    user, courses, loadingUser, loadingCourses,
    refreshUser, login, verifyTwoFactor, register, logout, refreshCourses,
  }

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

// хук для получения стора в любом компоненте
// бросает ошибку если вызвать вне AppStoreProvider — это намеренная защита
// ошибка сразу укажет разработчику что провайдер не подключён
// без этой проверки context был бы null и ошибка случилась бы позже и непонятнее
export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider")
  }
  return context
}
