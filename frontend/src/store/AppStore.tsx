/* eslint-disable react-refresh/only-export-components */
// глобальное хранилище состояния приложения — тут живут пользователь и курсы
// используем контекст вместо redux, потому что данных немного
import { createContext, useContext, useEffect, useState } from "react"
import { api, type Course, type LoginResult, type PublicUser } from "../services/api"

// описание всего что можно делать через стор
type AppStoreContextValue = {
  user: PublicUser | null         // текущий юзер, null если не залогинен
  courses: Course[]               // список всех курсов
  loadingUser: boolean            // крутится ли загрузка юзера
  loadingCourses: boolean         // крутится ли загрузка курсов
  refreshUser: () => Promise<void>
  login: (email: string, password: string) => Promise<LoginResult>
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<PublicUser>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshCourses: () => Promise<void>
}

// создаём контекст, по умолчанию null — будет ошибка если юзать вне провайдера
const AppStoreContext = createContext<AppStoreContextValue | null>(null)

type Props = {
  children: React.ReactNode
}

// провайдер оборачивает всё приложение и раздаёт стор всем дочерним компонентам
export function AppStoreProvider({ children }: Props) {
  // тут хранится текущий залогиненный пользователь
  const [user, setUser] = useState<PublicUser | null>(null)
  // список курсов — нужен в нескольких местах, поэтому держим глобально
  const [courses, setCourses] = useState<Course[]>([])
  // флаги загрузки чтобы показывать скелетоны пока данные летят с сервера
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingCourses, setLoadingCourses] = useState(true)

  // перезагружаем список курсов с бэка
  const refreshCourses = async () => {
    setLoadingCourses(true)
    try {
      const data = await api.get<Course[]>("/courses")
      setCourses(data)
    } finally {
      setLoadingCourses(false)
    }
  }

  // проверяем кто сейчас залогинен — спрашиваем бэк /auth/me
  const refreshUser = async () => {
    setLoadingUser(true)
    try {
      const me = await api.get<PublicUser | null>("/auth/me")
      setUser(me)
    } finally {
      setLoadingUser(false)
    }
  }

  // при первом рендере сразу грузим юзера и курсы
  useEffect(() => {
    void refreshUser()
    void refreshCourses()
  }, [])

  // логин — если всё ок, сохраняем юзера и обновляем курсы
  // возвращает LoginResult потому что может быть двухфакторка
  const login = async (email: string, password: string) => {
    const result = await api.post<LoginResult>("/auth/login", { email, password })
    if (result.kind === "authenticated") {
      setUser(result.user)
      await refreshCourses()
    }
    return result
  }

  // второй шаг двухфакторной авторизации — проверяем код из приложения
  const verifyTwoFactor = async (pendingToken: string, code: string) => {
    const user = await api.post<PublicUser>("/auth/2fa/verify", { pendingToken, code })
    setUser(user)
    await refreshCourses()
    return user
  }

  // регистрация — сразу логиним после создания аккаунта
  const register = async (name: string, email: string, password: string) => {
    const auth = await api.post<PublicUser>("/auth/register", { name, email, password })
    setUser(auth)
    await refreshCourses()
  }

  // выход — просим бэк удалить сессию и чистим юзера в сторе
  const logout = async () => {
    await api.post<{ success: boolean }>("/auth/logout", {})
    setUser(null)
  }

  // собираем всё в объект который передаём через контекст
  const value: AppStoreContextValue = {
    user,
    courses,
    loadingUser,
    loadingCourses,
    refreshUser,
    login,
    verifyTwoFactor,
    register,
    logout,
    refreshCourses,
  }

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

// хук для доступа к стору — бросает ошибку если юзать без провайдера
export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider")
  }
  return context
}
