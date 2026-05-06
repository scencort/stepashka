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
  Flame,
  Plus,
  UserRound,
  X,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type MainLayoutProps = { children: ReactNode };
type NotificationItem = { id: number; title: string; time: string };

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
  const [streakDays, setStreakDays] = useState(0);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(10);

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const data = await api.get<NotificationItem[]>("/notifications");
      setNotifications(data);
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Не удалось загрузить уведомления");
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => { void loadNotifications(); }, []);

  useEffect(() => {
    if (!user) { setStreakDays(0); return; }
    const load = async () => {
      try {
        const data = await api.get<{
          stats?: { streakDays?: number };
          weeklyPlan?: { completedSteps?: number; goalSteps?: number };
        }>("/dashboard");
        setStreakDays(Number(data?.stats?.streakDays || 0));
        setWeeklyCompleted(Number(data?.weeklyPlan?.completedSteps || 0));
        setWeeklyGoal(Math.max(Number(data?.weeklyPlan?.goalSteps || 10), 1));
      } catch { setStreakDays(0); }
    };
    void load();
  }, [user]);

  const toggleNotifications = () => {
    setShowNotifications((p) => !p);
    setShowProfile(false);
    setMobileMenuOpen(false);
  };

  const toggleProfile = () => {
    setShowProfile((p) => !p);
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
    if (!courseName.trim()) { setCourseFormError("Введите название курса"); return; }
    setCourseFormError("");
    try {
      await api.post("/courses", { title: courseName.trim(), level: courseLevel });
      closeAddCourse();
      void loadNotifications();
    } catch (error) {
      setCourseFormError(error instanceof Error ? error.message : "Не удалось создать курс");
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
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "--";

  const isAdmin = user?.role === "admin";
  const isTeacherOrAdmin = user?.role === "teacher" || user?.role === "admin";
  const roleLabel =
    user?.role === "admin" ? "Администратор"
    : user?.role === "teacher" ? "Преподаватель"
    : "Студент";

  const isActive = (path: string) =>
    path === "/course"
      ? pathname === "/course" || pathname.startsWith("/course/")
      : pathname === path;

  const NavLink = ({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={active ? "nav-item-active" : "nav-item"}
      >
        <Icon size={17} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const MobileNavLink = ({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        onClick={() => setMobileMenuOpen(false)}
        className={active ? "nav-item-active" : "nav-item"}
      >
        <Icon size={17} className="shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  const weekPercent = Math.min(100, Math.round((weeklyCompleted / weeklyGoal) * 100));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] md:flex">

      {/* ── Sidebar ── */}
      <motion.aside
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`${collapsed ? "w-[68px]" : "w-[260px]"} hidden md:flex flex-col shrink-0
          bg-[var(--bg)] border-r border-[var(--border)] transition-[width] duration-300 ease-in-out
          sticky top-0 h-screen overflow-y-auto overflow-x-hidden`}
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border)] shrink-0">
          {!collapsed && (
            <BrandLogo
              showText
              text="Gradus"
              iconClassName="h-8 w-8"
              textClassName="text-xl font-bold text-[var(--text)] font-display"
            />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors ml-auto"
            title={collapsed ? "Развернуть" : "Свернуть"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Progress block */}
        {!collapsed && (
          <div className="mx-3 mt-4 p-4 rounded-xl bg-[var(--bg-tint)] border border-primary/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Прогресс недели</span>
              <span className="text-xs font-bold text-primary">{weekPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${weekPercent}%` }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1.5">{weeklyCompleted} / {weeklyGoal} шагов</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-3 flex-1 mt-2">
          {!collapsed && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] px-3 py-1 mb-1">
              Главное
            </p>
          )}
          <NavLink to="/dashboard" label="Панель" icon={LayoutDashboard} />
          <NavLink to="/course" label="Курсы" icon={BookOpen} />
          <NavLink to="/task" label="AI Code Review" icon={Code} />
          <NavLink to="/ai-review" label="AI-чат" icon={Brain} />

          {isTeacherOrAdmin && (
            <>
              {!collapsed && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] px-3 py-1 mt-3 mb-1">
                  Преподавание
                </p>
              )}
              {!collapsed && <div className="h-px bg-[var(--border)] mx-3 mb-2" />}
              <NavLink to="/teacher" label="Кабинет преподавателя" icon={GraduationCap} />
              <NavLink to="/assignment-builder" label="Конструктор заданий" icon={Wrench} />
              <NavLink to="/analytics" label="Аналитика" icon={ChartColumn} />
            </>
          )}

          {isAdmin && (
            <>
              {!collapsed && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)] px-3 py-1 mt-3 mb-1">
                  Управление
                </p>
              )}
              {!collapsed && <div className="h-px bg-[var(--border)] mx-3 mb-2" />}
              <NavLink to="/admin" label="Панель администратора" icon={ShieldCheck} />
              <NavLink to="/roles-access" label="Роли и доступы" icon={ShieldCheck} />
            </>
          )}

          {!collapsed && <div className="h-px bg-[var(--border)] mx-3 my-2" />}
          <NavLink to="/feedback" label="Обратная связь" icon={MessageSquare} />
          <NavLink to="/help-center" label="Справка" icon={LifeBuoy} />
        </nav>

        {/* Bottom: theme + user */}
        <div className="p-3 border-t border-[var(--border)] space-y-1 shrink-0">
          <button
            onClick={toggleTheme}
            className="nav-item w-full"
          >
            {theme === "light" ? <Moon size={17} className="shrink-0" /> : <Sun size={17} className="shrink-0" />}
            {!collapsed && <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>}
          </button>
          <button
            onClick={() => navigate("/account")}
            className="nav-item w-full"
          >
            <div className="w-[17px] h-[17px] rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary shrink-0 overflow-hidden">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                : initials.charAt(0)
              }
            </div>
            {!collapsed && <span className="truncate">{user?.name || "Профиль"}</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg)] border-r border-[var(--border)] flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--border)]">
                <BrandLogo
                  showText
                  text="Gradus"
                  iconClassName="h-8 w-8"
                  textClassName="text-xl font-bold text-[var(--text)] font-display"
                />
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Progress mini */}
              <div className="mx-3 mt-4 p-3 rounded-xl bg-[var(--bg-tint)] border border-primary/10">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[var(--muted)]">Прогресс недели</span>
                  <span className="text-xs font-bold text-primary">{weekPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${weekPercent}%` }} />
                </div>
              </div>

              <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto mt-2">
                <MobileNavLink to="/dashboard" label="Панель" icon={LayoutDashboard} />
                <MobileNavLink to="/course" label="Курсы" icon={BookOpen} />
                <MobileNavLink to="/task" label="AI Code Review" icon={Code} />
                <MobileNavLink to="/ai-review" label="AI-чат" icon={Brain} />
                {isTeacherOrAdmin && (
                  <>
                    <div className="h-px bg-[var(--border)] mx-3 my-2" />
                    <MobileNavLink to="/teacher" label="Кабинет преподавателя" icon={GraduationCap} />
                    <MobileNavLink to="/assignment-builder" label="Конструктор заданий" icon={Wrench} />
                    <MobileNavLink to="/analytics" label="Аналитика" icon={ChartColumn} />
                  </>
                )}
                {isAdmin && (
                  <>
                    <div className="h-px bg-[var(--border)] mx-3 my-2" />
                    <MobileNavLink to="/admin" label="Панель администратора" icon={ShieldCheck} />
                    <MobileNavLink to="/roles-access" label="Роли и доступы" icon={ShieldCheck} />
                  </>
                )}
                <div className="h-px bg-[var(--border)] mx-3 my-2" />
                <MobileNavLink to="/feedback" label="Обратная связь" icon={MessageSquare} />
                <MobileNavLink to="/help-center" label="Справка" icon={LifeBuoy} />
              </nav>

              <div className="p-3 border-t border-[var(--border)] space-y-1">
                <button onClick={toggleTheme} className="nav-item w-full">
                  {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
                  <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
                </button>
                <button onClick={handleLogout} className="nav-item w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <LogOut size={17} />
                  <span>Выйти</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">

        {/* Header */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6
          bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)] shrink-0">

          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect width="18" height="2" rx="1" fill="currentColor"/>
                <rect y="6" width="12" height="2" rx="1" fill="currentColor"/>
                <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <BrandLogo
              showText
              text="Gradus"
              iconClassName="h-7 w-7"
              textClassName="text-lg font-bold text-[var(--text)] font-display"
            />
          </div>

          {/* Desktop: search */}
          <div className="hidden md:flex items-center gap-2.5 w-full max-w-sm
            bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5">
            <Search size={15} className="text-[var(--muted)] shrink-0" />
            <input
              placeholder="Поиск курсов, заданий..."
              className="bg-transparent outline-none w-full text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
            />
          </div>

          {/* Right side */}
          <div className="relative flex items-center gap-2">
            {/* Streak badge */}
            {streakDays > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                bg-orange-50 dark:bg-orange-900/20 border border-orange-200/60 dark:border-orange-800/40
                text-orange-600 dark:text-orange-400 text-xs font-semibold">
                <Flame size={13} />
                {streakDays} дней
              </div>
            )}

            {/* Add course — teachers only */}
            {isTeacherOrAdmin && (
              <button
                onClick={openAddCourse}
                className="hidden sm:flex btn-primary px-3.5 py-2 text-sm"
              >
                <Plus size={15} />
                Новый курс
              </button>
            )}

            {/* Notifications */}
            <button
              onClick={toggleNotifications}
              className="relative w-9 h-9 flex items-center justify-center rounded-lg
                text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]
                border border-[var(--border)] transition-colors"
            >
              <Bell size={16} />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>

            {/* Avatar / profile */}
            <button
              onClick={toggleProfile}
              className="w-9 h-9 rounded-full overflow-hidden
                bg-gradient-to-br from-primary-200 to-burgundy-200 dark:from-primary-800 dark:to-burgundy-700
                flex items-center justify-center text-xs font-bold text-primary-800 dark:text-primary-200
                ring-2 ring-[var(--border)] transition-all hover:ring-primary/30"
            >
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : initials
              }
            </button>

            {/* Notifications panel */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-80 card shadow-card-lg z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <h3 className="font-semibold text-sm font-display">Уведомления</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface)]"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notificationsLoading && (
                      <p className="text-sm text-[var(--muted)] px-4 py-8 text-center">Загрузка...</p>
                    )}
                    {!notificationsLoading && notificationsError && (
                      <p className="text-sm text-red-500 px-4 py-8 text-center">{notificationsError}</p>
                    )}
                    {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                      <p className="text-sm text-[var(--muted)] px-4 py-8 text-center">Нет уведомлений</p>
                    )}
                    {!notificationsLoading && notifications.map((item) => (
                      <div key={item.id}
                        className="px-4 py-3 border-b border-[var(--border-soft)] hover:bg-[var(--surface)] cursor-pointer transition-colors last:border-0">
                        <p className="text-sm font-medium text-[var(--text)]">{item.title}</p>
                        <p className="text-xs text-[var(--muted)] mt-0.5">{item.time}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Profile panel */}
            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-64 card shadow-card-lg z-50 overflow-hidden"
                >
                  {/* User info */}
                  <div className="px-4 py-4 border-b border-[var(--border)] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-200 to-burgundy-200 dark:from-primary-800 dark:to-burgundy-700 flex items-center justify-center text-xs font-bold text-primary-800 dark:text-primary-200 shrink-0">
                      {user?.avatarUrl
                        ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : initials
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{user?.name || "Гость"}</p>
                      <p className="text-xs text-[var(--muted)]">{roleLabel}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => { setShowProfile(false); navigate("/account?tab=profile"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
                    >
                      <UserRound size={15} className="text-[var(--muted)]" />
                      Профиль
                    </button>
                    <button
                      onClick={() => { setShowProfile(false); navigate("/account?tab=settings"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
                    >
                      <Settings size={15} className="text-[var(--muted)]" />
                      Настройки
                    </button>
                    <div className="h-px bg-[var(--border)] my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut size={15} />
                      Выйти
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden
          bg-[var(--bg)]/90 backdrop-blur-md border-t border-[var(--border)]
          grid grid-cols-4 px-2 py-1.5 safe-pb">
          {[
            { to: "/dashboard", label: "Панель", icon: LayoutDashboard },
            { to: "/course", label: "Курсы", icon: BookOpen },
            { to: "/task", label: "Review", icon: Code },
            { to: "/ai-review", label: "AI-чат", icon: Brain },
          ].map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-medium transition-colors
                  ${active ? "text-primary" : "text-[var(--muted)]"}`}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Modal: new course */}
        <Modal open={showAddCourse} onClose={closeAddCourse} title="Новый курс">
          <div className="space-y-4 py-2">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text-2)] mb-1.5 block">Название курса</span>
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="Введите название"
                className="input-field px-4 py-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text-2)] mb-1.5 block">Уровень</span>
              <select
                value={courseLevel}
                onChange={(e) => setCourseLevel(e.target.value)}
                className="input-field px-4 py-3"
              >
                <option>Начальный</option>
                <option>Средний</option>
                <option>Продвинутый</option>
              </select>
            </label>
            {courseFormError && (
              <p className="text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                {courseFormError}
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button onClick={closeAddCourse} className="btn-ghost px-5 py-2.5 text-sm">Отмена</button>
            <button onClick={createCourse} className="btn-primary px-6 py-2.5 text-sm">Добавить</button>
          </div>
        </Modal>
      </div>

      {/* Dismiss overlays on outside click */}
      {(showNotifications || showProfile) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setShowNotifications(false); setShowProfile(false); }}
        />
      )}
    </div>
  );
}
