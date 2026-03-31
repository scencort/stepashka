import { Link, useLocation, useNavigate } from "react-router-dom"
import { useTheme } from "../context/theme"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { api } from "../lib/api"
import Modal from "../components/ui/Modal"
import BrandLogo from "../components/BrandLogo"
import { useAppStore } from "../store/AppStore"
import { useToast } from "../hooks/useToast"

import {
  fadeInUp,
  smooth,
} from "../lib/animations"

import {
  LayoutDashboard,
  BookOpen,
  Code,
  GraduationCap,
  Brain,
  Wrench,
  ChartColumn,
  ShieldCheck,
  MessageSquare,
  LifeBuoy,
  Sun,
  Moon,
  Bell,
  Search,
  Sparkles,
  Plus,
  UserRound,
  X,
} from "lucide-react"

type MainLayoutProps = {
  children: ReactNode
}

type NotificationItem = {
  id: number
  title: string
  time: string
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAppStore()
  const toast = useToast()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [courseName, setCourseName] = useState("")
  const [courseLevel, setCourseLevel] = useState("РќР°С‡Р°Р»СЊРЅС‹Р№")
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState("")
  const [courseFormError, setCourseFormError] = useState("")
  const [streakDays, setStreakDays] = useState<number>(0)
  const [weeklyCompleted, setWeeklyCompleted] = useState(0)
  const [weeklyGoal, setWeeklyGoal] = useState(10)

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev)
    setShowProfile(false)
    setMobileMenuOpen(false)
  }

  const loadNotifications = async () => {
    setNotificationsLoading(true)
    setNotificationsError("")

    try {
      const data = await api.get<NotificationItem[]>("/notifications")
      setNotifications(data)
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ")
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  useEffect(() => {
    const loadDashboardStats = async () => {
      if (!user) {
        setStreakDays(0)
        return
      }
      try {
        const data = await api.get<{ stats?: { streakDays?: number }; weeklyPlan?: { completedSteps?: number; goalSteps?: number } }>("/dashboard")
        setStreakDays(Number(data?.stats?.streakDays || 0))
        setWeeklyCompleted(Number(data?.weeklyPlan?.completedSteps || 0))
        setWeeklyGoal(Math.max(Number(data?.weeklyPlan?.goalSteps || 10), 1))
      } catch {
        setStreakDays(0)
      }
    }

    void loadDashboardStats()
  }, [user])

  const toggleProfile = () => {
    setShowProfile((prev) => !prev)
    setShowNotifications(false)
    setMobileMenuOpen(false)
  }

  const openAddCourse = () => {
    setShowAddCourse(true)
    setShowNotifications(false)
    setShowProfile(false)
    setMobileMenuOpen(false)
  }

  const closeAddCourse = () => {
    setShowAddCourse(false)
    setCourseName("")
    setCourseLevel("РќР°С‡Р°Р»СЊРЅС‹Р№")
    setCourseFormError("")
  }

  const createCourse = async () => {
    if (!courseName.trim()) {
      setCourseFormError("Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ РєСѓСЂСЃР°")
      return
    }

    setCourseFormError("")
    try {
      await api.post("/courses", {
        title: courseName.trim(),
        level: courseLevel,
      })
      closeAddCourse()
      await loadNotifications()
      setShowNotifications(true)
    } catch (error) {
      setCourseFormError(error instanceof Error ? error.message : "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РєСѓСЂСЃ")
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success("Р’С‹ РІС‹С€Р»Рё РёР· Р°РєРєР°СѓРЅС‚Р°")
      navigate("/login")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "РћС€РёР±РєР° РІС‹С…РѕРґР°")
    }
  }

  const initials = user
    ? user.name
        .split(" ")
        .map((item) => item[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "--"

  const isAdmin = user?.role === "admin"
  const isTeacherOrAdmin = user?.role === "teacher" || user?.role === "admin"
  const roleLabel = user?.role === "admin" ? "РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ" : user?.role === "teacher" ? "РџСЂРµРїРѕРґР°РІР°С‚РµР»СЊ" : "РЎС‚СѓРґРµРЅС‚"

  const isPathActive = (path: string) => {
    if (path === "/course") {
      return pathname === "/course" || pathname.startsWith("/course/")
    }
    return pathname === path
  }

  const navItem = (path: string, label: string, icon: LucideIcon) => {
    const Icon = icon
    const active = isPathActive(path)

    return (
      <Link
        to={path}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          active
            ? "text-white bg-primary dark:bg-slate-800 shadow-md"
            : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/60"
        }`}
      >
        <Icon size={18} />
        {!collapsed && <span>{label}</span>}
      </Link>
    )
  }

  const navItemMobile = (path: string, label: string, icon: LucideIcon) => {
    const Icon = icon
    const active = isPathActive(path)

    return (
      <Link
        to={path}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          active
            ? "text-white bg-primary dark:bg-slate-800 shadow-md"
            : "text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-900/60"
        }`}
      >
        <Icon size={18} />
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 md:flex">

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`${
          collapsed ? "w-20" : "w-64"
        } hidden md:flex glass-panel m-3 mr-0 rounded-2xl p-4 flex-col transition-all`}
      >

        {/* Top */}
        <div className="flex items-center justify-between mb-6">

          <BrandLogo
            showText={!collapsed}
            text="РЎС‚РµРїР°С€РєР°"
            iconClassName="h-9 w-9"
            textClassName="text-xl font-extrabold text-primary dark:text-red-500"
          />

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-9 h-9 rounded-lg glass-panel hover:bg-white/80 dark:hover:bg-slate-900/70"
          >
            в°
          </button>

        </div>

        {!collapsed && (
          <div className="glass-panel rounded-xl p-4 mb-6">
            <p className="text-xs text-slate-500 dark:text-slate-300">
              РџСЂРѕРіСЂРµСЃСЃ РЅРµРґРµР»Рё
            </p>
            <p className="text-2xl font-bold mt-1">{Math.min(100, Math.round((weeklyCompleted / weeklyGoal) * 100))}%</p>
            <p className="text-xs text-slate-400 mt-0.5">{weeklyCompleted}/{weeklyGoal} С€Р°РіРѕРІ</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-700/70">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((weeklyCompleted / weeklyGoal) * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-2">
          {navItem("/dashboard", "РџР°РЅРµР»СЊ", LayoutDashboard)}
          {navItem("/course", "РљСѓСЂСЃС‹", BookOpen)}
          {navItem("/task", "AI Code Review", Code)}
          {isTeacherOrAdmin && navItem("/teacher", "РљР°Р±РёРЅРµС‚ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЏ", GraduationCap)}
          {isAdmin && navItem("/admin", "РџР°РЅРµР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°", ShieldCheck)}
          {navItem("/learning-paths", "РЈС‡РµР±РЅС‹Рµ С‚СЂР°РµРєС‚РѕСЂРёРё", GraduationCap)}
          {navItem("/ai-review", "AI-С‡Р°С‚", Brain)}
          {isTeacherOrAdmin && navItem("/assignment-builder", "РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ Р·Р°РґР°РЅРёР№", Wrench)}
          {isTeacherOrAdmin && navItem("/analytics", "РђРЅР°Р»РёС‚РёРєР°", ChartColumn)}
          {isAdmin && navItem("/roles-access", "Р РѕР»Рё Рё РґРѕСЃС‚СѓРїС‹", ShieldCheck)}
          {navItem("/feedback", "РћР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ", MessageSquare)}
          {navItem("/help-center", "РЎРїСЂР°РІРєР°", LifeBuoy)}
        </nav>

        {/* Bottom */}
        <div className="mt-auto space-y-3">

          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl glass-panel hover:scale-[1.02] active:scale-[0.98] transition"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            {!collapsed && (theme === "light" ? "РўС‘РјРЅР°СЏ" : "РЎРІРµС‚Р»Р°СЏ")}
          </button>

          <button className="w-full px-4 py-2 rounded-xl text-white bg-primary hover:bg-red-700 hover:scale-[1.02] active:scale-[0.98] transition">
            РџСЂРµРјРёСѓРј РґРѕСЃС‚СѓРї
          </button>

        </div>

      </motion.aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[95] bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[86vw] max-w-[360px] h-full glass-panel rounded-r-2xl p-4 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">РњРµРЅСЋ</h2>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                title="Close menu"
                className="w-8 h-8 rounded-lg glass-panel flex items-center justify-center"
              >
                <X size={14} />
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {navItemMobile("/dashboard", "РџР°РЅРµР»СЊ", LayoutDashboard)}
              {navItemMobile("/course", "РљСѓСЂСЃС‹", BookOpen)}
              {navItemMobile("/task", "AI Code Review", Code)}
              {isTeacherOrAdmin && navItemMobile("/teacher", "РљР°Р±РёРЅРµС‚ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЏ", GraduationCap)}
              {isAdmin && navItemMobile("/admin", "РџР°РЅРµР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°", ShieldCheck)}
              {navItemMobile("/learning-paths", "РЈС‡РµР±РЅС‹Рµ С‚СЂР°РµРєС‚РѕСЂРёРё", GraduationCap)}
              {navItemMobile("/ai-review", "AI-С‡Р°С‚", Brain)}
              {isTeacherOrAdmin && navItemMobile("/assignment-builder", "РљРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ Р·Р°РґР°РЅРёР№", Wrench)}
              {isTeacherOrAdmin && navItemMobile("/analytics", "РђРЅР°Р»РёС‚РёРєР°", ChartColumn)}
              {isAdmin && navItemMobile("/roles-access", "Р РѕР»Рё Рё РґРѕСЃС‚СѓРїС‹", ShieldCheck)}
              {navItemMobile("/feedback", "РћР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ", MessageSquare)}
              {navItemMobile("/help-center", "РЎРїСЂР°РІРєР°", LifeBuoy)}
            </nav>

            <div className="mt-5 space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl glass-panel"
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
                {theme === "light" ? "РўС‘РјРЅР°СЏ" : "РЎРІРµС‚Р»Р°СЏ"}
              </button>
              <button
                onClick={openAddCourse}
                className="w-full px-4 py-2 rounded-xl text-white bg-primary hover:bg-red-700"
              >
                РќРѕРІС‹Р№ РєСѓСЂСЃ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">

        {/* Header */}
        <motion.header
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          {...smooth}
          className="relative z-40 overflow-visible glass-panel m-3 md:ml-4 rounded-2xl h-16 flex items-center justify-between px-3 md:px-6"
        >

          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              title="Open menu"
              className="w-9 h-9 rounded-xl glass-panel"
            >
              в°
            </button>
            <BrandLogo
              text="РЎС‚РµРїР°С€РєР°"
              iconClassName="h-7 w-7"
              textClassName="text-base font-bold text-primary dark:text-red-500"
            />
          </div>

          <div className="hidden md:flex items-center gap-3 w-full max-w-md rounded-xl px-3 py-2 glass-panel">
            <Search size={16} className="text-slate-500" />
            <input
              placeholder="РџРѕРёСЃРє РєСѓСЂСЃРѕРІ, С‚РµРј, Р·Р°РґР°РЅРёР№..."
              className="bg-transparent outline-none w-full text-sm"
            />
          </div>

          <div className="relative z-50 flex items-center gap-2 md:gap-4">

            <button
              onClick={toggleNotifications}
              aria-label="Open notifications"
              title="Open notifications"
              className="p-2 rounded-xl glass-panel hover:scale-105 transition"
            >
              <Bell size={18} />
            </button>

            <button
              onClick={openAddCourse}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-white rounded-xl bg-primary hover:bg-red-700 hover:scale-105 active:scale-95 transition"
            >
              <Plus size={16} />
              РќРѕРІС‹Р№ РєСѓСЂСЃ
            </button>

            <button
              onClick={toggleProfile}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-200 to-red-300 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center text-xs font-bold text-red-900 dark:text-slate-100 overflow-hidden"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </button>

            <button className="hidden md:flex items-center gap-2 text-sm px-3 py-2 rounded-xl glass-panel">
              <Sparkles size={15} />
              РЎРµСЂРёСЏ: {streakDays} РґРЅРµР№
            </button>

            <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute right-0 top-14 w-[calc(100vw-2.5rem)] max-w-[360px] rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-slate-900/15 dark:shadow-black/45 p-4 z-[90]"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">РЈРІРµРґРѕРјР»РµРЅРёСЏ</h3>
                  <button
                    onClick={() => setShowNotifications(false)}
                    aria-label="Close notifications"
                    title="Close notifications"
                    className="w-8 h-8 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-3 max-h-72 overflow-auto pr-1">
                  {notificationsLoading && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Р—Р°РіСЂСѓР·РєР°...</p>
                  )}

                  {!notificationsLoading && notificationsError && (
                    <p className="text-sm text-red-700 dark:text-red-300">{notificationsError}</p>
                  )}

                  {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">РџРѕРєР° РЅРµС‚ СѓРІРµРґРѕРјР»РµРЅРёР№</p>
                  )}

                  {!notificationsLoading && !notificationsError && notifications.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 p-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.time}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute right-0 top-14 w-[calc(100vw-2.5rem)] max-w-[290px] rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 shadow-2xl shadow-slate-900/15 dark:shadow-black/45 p-4 z-[90]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-200 to-red-300 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center text-sm font-bold text-red-900 dark:text-slate-100 overflow-hidden">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{user?.name || "Р“РѕСЃС‚СЊ"}</p>
                    <p className="text-xs text-slate-500">{roleLabel}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowProfile(false)
                    navigate("/account?tab=profile")
                  }}
                  className="w-full text-left rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 mb-2 inline-flex items-center gap-2 transition"
                >
                  <UserRound size={15} />
                  РџСЂРѕС„РёР»СЊ
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false)
                    navigate("/account?tab=settings")
                  }}
                  className="w-full text-left rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 mb-2 transition"
                >
                  РќР°СЃС‚СЂРѕР№РєРё Р°РєРєР°СѓРЅС‚Р°
                </button>
                <button onClick={handleLogout} className="w-full text-left rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 transition">
                  Р’С‹Р№С‚Рё
                </button>
              </motion.div>
            )}
            </AnimatePresence>

          </div>

        </motion.header>

        {/* Content */}
        <main className="p-4 md:p-8">
          {children}
        </main>

        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-3 pb-3">
          <div className="glass-panel rounded-2xl px-2 py-2 grid grid-cols-4 gap-2">
            <Link
              to="/dashboard"
              className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs ${
                pathname === "/dashboard" ? "text-white bg-primary hover:bg-red-700" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <LayoutDashboard size={16} />
              РџР°РЅРµР»СЊ
            </Link>

            <Link
              to="/course"
              className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs ${
                pathname === "/course" ? "text-white bg-primary hover:bg-red-700" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <BookOpen size={16} />
              РљСѓСЂСЃС‹
            </Link>

            <Link
              to="/task"
              className={`flex flex-col items-center justify-center py-2 rounded-xl text-xs ${
                pathname === "/task" ? "text-white bg-primary hover:bg-red-700" : "text-slate-600 dark:text-slate-300"
              }`}
            >
              <Code size={16} />
              Review
            </Link>

            <button
              onClick={openAddCourse}
              className="flex flex-col items-center justify-center py-2 rounded-xl text-xs text-white bg-primary hover:bg-red-700"
            >
              <Plus size={16} />
              Р”РѕР±Р°РІРёС‚СЊ
            </button>
          </div>
        </div>

        <Modal open={showAddCourse} onClose={closeAddCourse} title="Р”РѕР±Р°РІР»РµРЅРёРµ РєСѓСЂСЃР°">
          <label className="block mb-3">
            <span className="text-sm text-slate-600 dark:text-slate-300">РќР°Р·РІР°РЅРёРµ РєСѓСЂСЃР°</span>
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Р’РІРµРґРёС‚Рµ РЅР°Р·РІР°РЅРёРµ"
              className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
            />
          </label>

          <label className="block mb-5">
            <span className="text-sm text-slate-600 dark:text-slate-300">РЈСЂРѕРІРµРЅСЊ</span>
            <select
              value={courseLevel}
              onChange={(e) => setCourseLevel(e.target.value)}
              className="mt-1 w-full rounded-xl glass-panel px-3 py-2 outline-none"
            >
              <option>РќР°С‡Р°Р»СЊРЅС‹Р№</option>
              <option>РЎСЂРµРґРЅРёР№</option>
              <option>РџСЂРѕРґРІРёРЅСѓС‚С‹Р№</option>
            </select>
          </label>

          {courseFormError && (
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">{courseFormError}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button
              onClick={closeAddCourse}
              className="px-4 py-2 rounded-xl glass-panel"
            >
              РћС‚РјРµРЅР°
            </button>
            <button
              onClick={createCourse}
              className="px-4 py-2 rounded-xl text-white bg-primary hover:bg-red-700"
            >
              Р”РѕР±Р°РІРёС‚СЊ
            </button>
          </div>
        </Modal>

      </div>
    </div>
  )
}

