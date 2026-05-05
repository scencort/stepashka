import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/theme";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import Modal from "../components/ui/Modal";
import BrandLogo from "../components/BrandLogo";
import { useAppStore } from "../store/AppStore";
import { useToast } from "../hooks/useToast";

import { fadeInUp, smooth } from "../lib/animations";

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
} from "lucide-react";

type MainLayoutProps = {
  children: ReactNode;
};

type NotificationItem = {
  id: number;
  title: string;
  time: string;
};

export default function MainLayout({ children }: MainLayoutProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAppStore();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseLevel, setCourseLevel] = useState("Начальный");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [courseFormError, setCourseFormError] = useState("");
  const [streakDays, setStreakDays] = useState<number>(0);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(10);

  const toggleNotifications = () => {
    setShowNotifications((prev) => !prev);
    setShowProfile(false);
    setMobileMenuOpen(false);
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError("");

    try {
      const data = await api.get<NotificationItem[]>("/notifications");
      setNotifications(data);
    } catch (error) {
      setNotificationsError(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить уведомления",
      );
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const loadDashboardStats = async () => {
      if (!user) {
        setStreakDays(0);
        return;
      }
      try {
        const data = await api.get<{
          stats?: { streakDays?: number };
          weeklyPlan?: { completedSteps?: number; goalSteps?: number };
        }>("/dashboard");
        setStreakDays(Number(data?.stats?.streakDays || 0));
        setWeeklyCompleted(Number(data?.weeklyPlan?.completedSteps || 0));
        setWeeklyGoal(Math.max(Number(data?.weeklyPlan?.goalSteps || 10), 1));
      } catch {
        setStreakDays(0);
      }
    };

    void loadDashboardStats();
  }, [user]);

  const toggleProfile = () => {
    setShowProfile((prev) => !prev);
    setShowNotifications(false);
    setMobileMenuOpen(false);
  };

  const openAddCourse = () => {
    setShowAddCourse(true);
    setShowNotifications(false);
    setShowProfile(false);
    setMobileMenuOpen(false);
  };

  const closeAddCourse = () => {
    setShowAddCourse(false);
    setCourseName("");
    setCourseLevel("Начальный");
    setCourseFormError("");
  };

  const createCourse = async () => {
    if (!courseName.trim()) {
      setCourseFormError("Введите название курса");
      return;
    }

    setCourseFormError("");
    try {
      await api.post("/courses", {
        title: courseName.trim(),
        level: courseLevel,
      });
      closeAddCourse();
      await loadNotifications();
      setShowNotifications(true);
    } catch (error) {
      setCourseFormError(
        error instanceof Error ? error.message : "Не удалось создать курс",
      );
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Вы вышли из аккаунта");
      navigate("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка выхода");
    }
  };

  const initials = user
    ? user.name
        .split(" ")
        .map((item) => item[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "--";

  const isAdmin = user?.role === "admin";
  const isTeacherOrAdmin = user?.role === "teacher" || user?.role === "admin";
  const roleLabel =
    user?.role === "admin"
      ? "Администратор"
      : user?.role === "teacher"
        ? "Преподаватель"
        : "Студент";

  const isPathActive = (path: string) => {
    if (path === "/course") {
      return pathname === "/course" || pathname.startsWith("/course/");
    }
    return pathname === path;
  };

  const navItem = (path: string, label: string, icon: LucideIcon) => {
    const Icon = icon;
    const active = isPathActive(path);

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
    );
  };

  const navItemMobile = (path: string, label: string, icon: LucideIcon) => {
    const Icon = icon;
    const active = isPathActive(path);

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
    );
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 md:flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className={`${
          collapsed ? "w-20" : "w-[280px]"
        } hidden md:flex glass-panel m-4 mr-0 rounded-[2rem] p-5 flex-col transition-all duration-500`}
      >
        {/* Top */}
        <div className="flex items-center justify-between mb-6">
          <BrandLogo
            showText={!collapsed}
            text="Gradus"
            iconClassName="h-9 w-9"
            textClassName="text-xl font-extrabold text-primary dark:text-red-500"
          />

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-9 h-9 rounded-lg glass-panel hover:bg-white/80 dark:hover:bg-slate-900/70"
          >
            ≡
          </button>
        </div>

        {!collapsed && (
          <div className="bg-white/40 dark:bg-zinc-900/40 rounded-3xl p-5 mb-6 border border-white/50 dark:border-white/5 backdrop-blur-md shadow-inner dark:shadow-none">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Прогресс недели
            </p>
            <div className="flex items-end gap-2 mt-2 mb-1">
              <p className="text-3xl font-black bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent leading-none">
                {Math.min(
                  100,
                  Math.round((weeklyCompleted / weeklyGoal) * 100),
                )}
                %
              </p>
            </div>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
              {weeklyCompleted} / {weeklyGoal} шагов
            </p>
            <div className="mt-4 h-2.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 p-0.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-500 shadow-sm transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, Math.round((weeklyCompleted / weeklyGoal) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-2">
          {navItem("/dashboard", "Панель", LayoutDashboard)}
          {navItem("/course", "Курсы", BookOpen)}
          {navItem("/task", "AI Code Review", Code)}
          {isTeacherOrAdmin &&
            navItem("/teacher", "Кабинет преподавателя", GraduationCap)}
          {isAdmin && navItem("/admin", "Панель администратора", ShieldCheck)}
          {navItem("/learning-paths", "Учебные траектории", GraduationCap)}
          {navItem("/ai-review", "AI-чат", Brain)}
          {isTeacherOrAdmin &&
            navItem("/assignment-builder", "Конструктор заданий", Wrench)}
          {isTeacherOrAdmin && navItem("/analytics", "Аналитика", ChartColumn)}
          {isAdmin && navItem("/roles-access", "Роли и доступы", ShieldCheck)}
          {navItem("/feedback", "Обратная связь", MessageSquare)}
          {navItem("/help-center", "Справка", LifeBuoy)}
        </nav>

        {/* Bottom */}
        <div className="mt-auto space-y-3 pt-4">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/40 dark:bg-zinc-900/40 border border-white/50 dark:border-white/5 shadow-sm hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-all text-slate-700 dark:text-slate-300 font-medium"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            {!collapsed && (theme === "light" ? "Тёмная" : "Светлая")}
          </button>

          <button className="w-full px-4 py-3 rounded-2xl text-white bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 dark:text-slate-900 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
            {!collapsed ? "Премиум доступ" : "Pro"}
          </button>
        </div>
      </motion.aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[95] bg-black/20 dark:bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-[86vw] max-w-[360px] h-full glass-panel !border-l-0 rounded-l-none rounded-r-[2rem] p-6 overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <BrandLogo
                text="Gradus"
                iconClassName="h-8 w-8"
                textClassName="text-xl font-extrabold bg-gradient-to-r from-rose-600 to-red-800 dark:from-rose-400 dark:to-red-600 bg-clip-text text-transparent"
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                title="Close menu"
                className="w-10 h-10 rounded-full bg-white/50 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {navItemMobile("/dashboard", "Панель", LayoutDashboard)}
              {navItemMobile("/course", "Курсы", BookOpen)}
              {navItemMobile("/task", "AI Code Review", Code)}
              {isTeacherOrAdmin &&
                navItemMobile(
                  "/teacher",
                  "Кабинет преподавателя",
                  GraduationCap,
                )}
              {isAdmin &&
                navItemMobile("/admin", "Панель администратора", ShieldCheck)}
              {navItemMobile(
                "/learning-paths",
                "Учебные траектории",
                GraduationCap,
              )}
              {navItemMobile("/ai-review", "AI-чат", Brain)}
              {isTeacherOrAdmin &&
                navItemMobile(
                  "/assignment-builder",
                  "Конструктор заданий",
                  Wrench,
                )}
              {isTeacherOrAdmin &&
                navItemMobile("/analytics", "Аналитика", ChartColumn)}
              {isAdmin &&
                navItemMobile("/roles-access", "Роли и доступы", ShieldCheck)}
              {navItemMobile("/feedback", "Обратная связь", MessageSquare)}
              {navItemMobile("/help-center", "Справка", LifeBuoy)}
            </nav>

            <div className="mt-8 space-y-3">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/40 dark:bg-zinc-900/40 border border-white/50 dark:border-white/5 shadow-sm font-medium"
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                {theme === "light" ? "Тёмная тема" : "Светлая тема"}
              </button>
              <button
                onClick={openAddCourse}
                className="w-full px-4 py-3 rounded-2xl text-white bg-gradient-to-r from-rose-600 to-red-600 font-semibold shadow-lg shadow-rose-500/25"
              >
                Новый курс
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
          className="relative z-40 overflow-visible glass-panel m-4 md:ml-4 md:mt-4 rounded-[2rem] h-20 flex items-center justify-between px-4 md:px-8 shadow-sm"
        >
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              title="Open menu"
              className="w-10 h-10 rounded-full glass-panel flex items-center justify-center border-none shadow-sm"
            >
              ≡
            </button>
            <BrandLogo
              text="Gradus"
              iconClassName="h-8 w-8 text-rose-600 dark:text-rose-500"
              textClassName="text-lg font-extrabold bg-gradient-to-r from-rose-600 to-red-800 dark:from-rose-400 dark:to-red-600 bg-clip-text text-transparent"
            />
          </div>

          <div className="hidden md:flex items-center gap-3 w-full max-w-md input-field px-4 py-2.5 rounded-full border-none !bg-white/40 dark:!bg-zinc-900/40">
            <Search size={18} className="text-slate-400" />
            <input
              placeholder="Поиск курсов, тем, заданий..."
              className="bg-transparent outline-none w-full text-sm font-medium placeholder:text-slate-400"
            />
          </div>

          <div className="relative z-50 flex items-center gap-3 md:gap-5">
            <button
              onClick={toggleNotifications}
              aria-label="Open notifications"
              title="Open notifications"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/50 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-700 transition-colors border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300"
            >
              <Bell size={18} />
            </button>

            <button
              onClick={openAddCourse}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 text-white rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 hover:shadow-lg hover:shadow-rose-500/25 active:scale-95 transition-all font-medium text-sm"
            >
              <Plus size={16} />
              Новый курс
            </button>

            <button
              onClick={toggleProfile}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-200 to-red-300 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center text-sm font-bold text-red-900 dark:text-slate-100 overflow-hidden ring-2 ring-white/50 dark:ring-white/10 shadow-sm"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </button>

            <button className="hidden md:flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-full bg-amber-50/80 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30 shadow-sm">
              <Sparkles size={16} />
              {streakDays} дней
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute right-0 top-14 mt-4 w-[calc(100vw-2.5rem)] max-w-[360px] rounded-[2rem] border border-white/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/40 p-5 z-[90]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">Уведомления</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      aria-label="Close notifications"
                      title="Close notifications"
                      className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-3 max-h-72 overflow-auto pr-1">
                    {notificationsLoading && (
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Загрузка...
                      </p>
                    )}

                    {!notificationsLoading && notificationsError && (
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {notificationsError}
                      </p>
                    )}

                    {!notificationsLoading &&
                      !notificationsError &&
                      notifications.length === 0 && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Пока нет уведомлений
                        </p>
                      )}

                    {!notificationsLoading &&
                      !notificationsError &&
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                            {item.title}
                          </p>
                          <p className="text-xs font-medium text-slate-500 mt-2">
                            {item.time}
                          </p>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute right-0 top-14 mt-4 w-[calc(100vw-2.5rem)] max-w-[320px] rounded-[2.5rem] border border-white/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-slate-900/15 dark:shadow-black/40 p-5 z-[90]"
                >
                  <div className="flex items-center gap-4 p-2 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-200 to-red-300 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center text-sm font-bold text-red-900 dark:text-slate-100 overflow-hidden ring-2 ring-white/50 dark:ring-white/10 shadow-sm">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">{user?.name || "Гость"}</p>
                      <p className="text-xs text-slate-500">{roleLabel}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      onClick={() => {
                        setShowProfile(false);
                        navigate("/account?tab=profile");
                      }}
                      className="w-full text-left rounded-2xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-3 inline-flex items-center gap-3 transition-colors font-medium"
                    >
                      <UserRound size={18} className="text-slate-400" />
                      Профиль
                    </button>
                    <button
                      onClick={() => {
                        setShowProfile(false);
                        navigate("/account?tab=settings");
                      }}
                      className="w-full text-left rounded-2xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-3 inline-flex items-center gap-3 transition-colors font-medium"
                    >
                      <Wrench size={18} className="text-slate-400" />
                      Настройки аккаунта
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left rounded-2xl bg-rose-50/50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-4 py-3 inline-flex items-center gap-3 transition-colors font-medium mt-2"
                    >
                      Выйти
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.header>

        {/* Content */}
        <main className="p-4 md:p-8">{children}</main>

        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden px-4 pb-4">
          <div className="glass-panel !rounded-full px-2 py-2 flex items-center justify-around shadow-2xl">
            <Link
              to="/dashboard"
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-full text-[10px] font-medium transition-all ${
                pathname === "/dashboard"
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <LayoutDashboard size={20} className="mb-1" />
              Панель
            </Link>

            <Link
              to="/course"
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-full text-[10px] font-medium transition-all ${
                pathname === "/course"
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <BookOpen size={20} className="mb-1" />
              Курсы
            </Link>

            <Link
              to="/task"
              className={`flex flex-col items-center justify-center w-16 h-14 rounded-full text-[10px] font-medium transition-all ${
                pathname === "/task"
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <Code size={20} className="mb-1" />
              Review
            </Link>

            <button
              onClick={openAddCourse}
              className="flex flex-col items-center justify-center w-16 h-14 rounded-full text-[10px] font-medium transition-all text-white bg-gradient-to-r from-rose-600 to-red-600 shadow-md shadow-rose-500/25"
            >
              <Plus size={20} className="mb-1" />
              Добав.
            </button>
          </div>
        </div>

        <Modal open={showAddCourse} onClose={closeAddCourse} title="Новый курс">
          <div className="space-y-4 py-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 mb-1.5 block">
                Название курса
              </span>
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Введите название"
                className="input-field px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 mb-1.5 block">
                Уровень
              </span>
              <select
                value={courseLevel}
                onChange={(e) => setCourseLevel(e.target.value)}
                className="input-field px-4 py-3 appearance-none"
              >
                <option>Начальный</option>
                <option>Средний</option>
                <option>Продвинутый</option>
              </select>
            </label>

            {courseFormError && (
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 p-3 rounded-2xl">
                {courseFormError}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end mt-8">
            <button
              onClick={closeAddCourse}
              className="px-6 py-3 rounded-full font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={createCourse}
              className="px-8 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-500/25 transition-all"
            >
              Добавить
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
