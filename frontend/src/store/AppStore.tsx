/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react"
import { api, type Course, type LoginResult, type PublicUser } from "../services/api"

type AppStoreContextValue = {
  user: PublicUser | null
  courses: Course[]
  loadingUser: boolean
  loadingCourses: boolean
  refreshUser: () => Promise<void>
  login: (email: string, password: string) => Promise<LoginResult>
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<PublicUser>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshCourses: () => Promise<void>
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null)

type Props = {
  children: React.ReactNode
}

export function AppStoreProvider({ children }: Props) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [loadingUser, setLoadingUser] = useState(true)
  const [loadingCourses, setLoadingCourses] = useState(true)

  const refreshCourses = async () => {
    setLoadingCourses(true)
    try {
      const data = await api.get<Course[]>("/courses")
      setCourses(data)
    } finally {
      setLoadingCourses(false)
    }
  }

  const refreshUser = async () => {
    setLoadingUser(true)
    try {
      const me = await api.get<PublicUser | null>("/auth/me")
      setUser(me)
    } finally {
      setLoadingUser(false)
    }
  }

  useEffect(() => {
    void refreshUser()
    void refreshCourses()
  }, [])

  const login = async (email: string, password: string) => {
    const result = await api.post<LoginResult>("/auth/login", { email, password })
    if (result.kind === "authenticated") {
      setUser(result.user)
      await refreshCourses()
    }
    return result
  }

  const verifyTwoFactor = async (pendingToken: string, code: string) => {
    const user = await api.post<PublicUser>("/auth/2fa/verify", { pendingToken, code })
    setUser(user)
    await refreshCourses()
    return user
  }

  const register = async (name: string, email: string, password: string) => {
    const auth = await api.post<PublicUser>("/auth/register", { name, email, password })
    setUser(auth)
    await refreshCourses()
  }

  const logout = async () => {
    await api.post<{ success: boolean }>("/auth/logout", {})
    setUser(null)
  }

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

export function useAppStore() {
  const context = useContext(AppStoreContext)
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider")
  }
  return context
}
