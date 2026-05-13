import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/theme";
import { useEffect, useMemo, useRef, useState } from "react";
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
  ChartColumn,
  ShieldCheck,
  MessageSquare,
  LifeBuoy,
  Sun,
  Moon,
  Bell,
  Flame,
  Plus,
  UserRound,
  X,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";

type MainLayoutProps = { children: ReactNode };
type NotificationItem = { id: number; title: string; time: string };

const READ_NOTIFICATIONS_KEY = "gradus_read_notifications_v1";

function loadReadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v) => typeof v === "number"));
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<number>) {
  try {
    localStorage.setItem(
      READ_NOTIFICATIONS_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* ignore */
  }
}

const RU_WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const RU_MONTHS_FULL = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfIsoWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const dow = copy.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // shift to Monday
  copy.setDate(copy.getDate() + diff);
  return copy;
}

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
  const [readNotificationIds, setReadNotificationIds] = useState<Set<number>>(
    () => loadReadIds(),
  );
  const notificationsListRef = useRef<HTMLDivElement | null>(null);
  const [showStreakPanel, setShowStreakPanel] = useState(false);
  const [courseFormError, setCourseFormError] = useState("");
  const [streakDays, setStreakDays] = useState(0);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(10);
  const [activeDays, setActiveDays] = useState<string[]>([]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !readNotificationIds.has(n.id)).length,
    [notifications, readNotificationIds],
  );

  const markAllNotificationsRead = () => {
    if (notifications.length === 0) return;
    const next = new Set(readNotificationIds);
    notifications.forEach((n) => next.add(n.id));
    setReadNotificationIds(next);
    persistReadIds(next);
  };

  const handleNotificationsScroll = (
    event: React.UIEvent<HTMLDivElement>,
  ) => {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
      markAllNotificationsRead();
    }
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
    void loadNotifications();
    const handler = () => void loadNotifications();
    window.addEventListener("gradus:notifications:refresh", handler);
    return () => window.removeEventListener("gradus:notifications:refresh", handler);
  }, []);

  useEffect(() => {
    if (!user) {
      setStreakDays(0);
      return;
    }
    const load = async () => {
      try {
        const data = await api.get<{
          stats?: { streakDays?: number };
          weeklyPlan?: { completedSteps?: number; goalSteps?: number };
        }>("/dashboard");
        setStreakDays(Number(data?.stats?.streakDays || 0));
        setWeeklyCompleted(Number(data?.weeklyPlan?.completedSteps || 0));
        setWeeklyGoal(Math.max(Number(data?.weeklyPlan?.goalSteps || 10), 1));
        setActiveDays(
          Array.isArray((data as { activeDays?: string[] }).activeDays)
            ? (data as { activeDays?: string[] }).activeDays!
            : [],
        );
      } catch {
        setStreakDays(0);
      }
    };
    void load();
  }, [user]);

  const toggleNotifications = () => {
    setShowNotifications((p) => !p);
    setShowProfile(false);
    setShowStreakPanel(false);
    setMobileMenuOpen(false);
  };

  const toggleProfile = () => {
    setShowProfile((p) => !p);
    setShowNotifications(false);
    setShowStreakPanel(false);
    setMobileMenuOpen(false);
  };

  const toggleStreakPanel = () => {
    setShowStreakPanel((p) => !p);
    setShowNotifications(false);
    setShowProfile(false);
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
      void loadNotifications();
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
        .map((w) => w[0])
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

  const isActive = (path: string) =>
    path === "/course"
      ? pathname === "/course" || pathname.startsWith("/course/")
      : pathname === path;

  const NavLink = ({
    to,
    label,
    icon: Icon,
  }: {
    to: string;
    label: string;
    icon: LucideIcon;
  }) => {
    const active = isActive(to);
    return (
      <Link to={to} className={active ? "nav-item-active" : "nav-item"}>
        <Icon size={17} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const MobileNavLink = ({
    to,
    label,
    icon: Icon,
  }: {
    to: string;
    label: string;
    icon: LucideIcon;
  }) => {
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

  const weekPercent = Math.min(
    100,
    Math.round((weeklyCompleted / weeklyGoal) * 100),
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] md:flex">
      {/* ── Sidebar ── */}
      <aside
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
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                Прогресс недели
              </span>
              <span className="text-xs font-bold text-primary">
                {weekPercent}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${weekPercent}%` }}
              />
            </div>
            <p className="text-xs text-[var(--muted)] mt-1.5">
              {weeklyCompleted} / {weeklyGoal} шагов
            </p>
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
              {!collapsed && (
                <div className="h-px bg-[var(--border)] mx-3 mb-2" />
              )}
              <NavLink
                to="/teacher"
                label="Кабинет преподавателя"
                icon={GraduationCap}
              />
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
              {!collapsed && (
                <div className="h-px bg-[var(--border)] mx-3 mb-2" />
              )}
              <NavLink
                to="/admin"
                label="Панель администратора"
                icon={ShieldCheck}
              />
            </>
          )}

          {!collapsed && <div className="h-px bg-[var(--border)] mx-3 my-2" />}
          <NavLink to="/feedback" label="Обратная связь" icon={MessageSquare} />
          <NavLink to="/help-center" label="Справка" icon={LifeBuoy} />
        </nav>

        {/* Bottom: theme + user */}
        <div className="p-3 border-t border-[var(--border)] space-y-1 shrink-0">
          <button onClick={toggleTheme} className="nav-item w-full">
            {theme === "light" ? (
              <Moon size={17} className="shrink-0" />
            ) : (
              <Sun size={17} className="shrink-0" />
            )}
            {!collapsed && (
              <span>{theme === "light" ? "Тёмная тема" : "Светлая тема"}</span>
            )}
          </button>
          <button
            onClick={() => navigate("/account")}
            className="nav-item w-full"
          >
            <div className="w-[17px] h-[17px] rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary shrink-0 overflow-hidden">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                initials.charAt(0)
              )}
            </div>
            {!collapsed && (
              <span className="truncate">{user?.name || "Профиль"}</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[var(--bg)] border-r border-[var(--border)] flex flex-col md:hidden"
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
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    Прогресс недели
                  </span>
                  <span className="text-xs font-bold text-primary">
                    {weekPercent}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${weekPercent}%` }}
                  />
                </div>
              </div>

              <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto mt-2">
                <MobileNavLink
                  to="/dashboard"
                  label="Панель"
                  icon={LayoutDashboard}
                />
                <MobileNavLink to="/course" label="Курсы" icon={BookOpen} />
                <MobileNavLink to="/task" label="AI Code Review" icon={Code} />
                <MobileNavLink to="/ai-review" label="AI-чат" icon={Brain} />
                {isTeacherOrAdmin && (
                  <>
                    <div className="h-px bg-[var(--border)] mx-3 my-2" />
                    <MobileNavLink
                      to="/teacher"
                      label="Кабинет преподавателя"
                      icon={GraduationCap}
                    />
                    <MobileNavLink
                      to="/analytics"
                      label="Аналитика"
                      icon={ChartColumn}
                    />
                  </>
                )}
                {isAdmin && (
                  <>
                    <div className="h-px bg-[var(--border)] mx-3 my-2" />
                    <MobileNavLink
                      to="/admin"
                      label="Панель администратора"
                      icon={ShieldCheck}
                    />
                  </>
                )}
                <div className="h-px bg-[var(--border)] mx-3 my-2" />
                <MobileNavLink
                  to="/feedback"
                  label="Обратная связь"
                  icon={MessageSquare}
                />
                <MobileNavLink
                  to="/help-center"
                  label="Справка"
                  icon={LifeBuoy}
                />
              </nav>

              <div className="p-3 border-t border-[var(--border)] space-y-1">
                <button onClick={toggleTheme} className="nav-item w-full">
                  {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
                  <span>
                    {theme === "light" ? "Тёмная тема" : "Светлая тема"}
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="nav-item w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut size={17} />
                  <span>Выйти</span>
                </button>
              </div>
            </div>
          </>
        )}

      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Header */}
        <header
          className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6
          bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)] shrink-0"
        >
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)]"
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <rect width="18" height="2" rx="1" fill="currentColor" />
                <rect y="6" width="12" height="2" rx="1" fill="currentColor" />
                <rect y="12" width="18" height="2" rx="1" fill="currentColor" />
              </svg>
            </button>
            <BrandLogo
              showText
              text="Gradus"
              iconClassName="h-7 w-7"
              textClassName="text-lg font-bold text-[var(--text)] font-display"
            />
          </div>

          {/* Right side */}
          <div className="relative flex items-center gap-2 ml-auto">
            {/* Streak badge */}
            <button
              onClick={toggleStreakPanel}
              title="Календарь активности"
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                streakDays > 0
                  ? "bg-primary-50 dark:bg-primary-900/20 border-primary-200/60 dark:border-primary-800/40 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:bg-[var(--border)]/30"
              }`}
            >
              <Flame size={13} />
              {streakDays} {streakDays === 1 ? "день" : streakDays >= 2 && streakDays <= 4 ? "дня" : "дней"}
            </button>

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
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[8px] h-2 px-[2px] rounded-full bg-red-500" />
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

            {/* Notifications panel */}
                          {showNotifications && (
                <div className="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] card shadow-card-lg z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm font-display text-[var(--text)]">Уведомления</h3>
                      {unreadNotificationsCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                          {unreadNotificationsCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {unreadNotificationsCount > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="text-xs font-medium text-primary hover:text-primary-700 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                        >
                          Прочитать всё
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          title="Очистить уведомления"
                          onClick={async () => {
                            try {
                              await api.delete("/notifications");
                              setNotifications([]);
                              setReadNotificationIds(new Set());
                              persistReadIds(new Set());
                            } catch {}
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setShowNotifications(false)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface)] transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={notificationsListRef}
                    onScroll={handleNotificationsScroll}
                    className="max-h-72 overflow-y-auto"
                  >
                    {notificationsLoading && (
                      <p className="text-sm text-[var(--muted)] px-4 py-8 text-center">
                        Загрузка...
                      </p>
                    )}
                    {!notificationsLoading && notificationsError && (
                      <p className="text-sm text-red-500 px-4 py-8 text-center">
                        {notificationsError}
                      </p>
                    )}
                    {!notificationsLoading &&
                      !notificationsError &&
                      notifications.length === 0 && (
                        <p className="text-sm text-[var(--muted)] px-4 py-8 text-center">
                          Нет уведомлений
                        </p>
                      )}
                    {!notificationsLoading &&
                      notifications.map((item) => {
                        const isUnread = !readNotificationIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (!isUnread) return;
                              const next = new Set(readNotificationIds);
                              next.add(item.id);
                              setReadNotificationIds(next);
                              persistReadIds(next);
                            }}
                            className={`px-4 py-3 border-b border-[var(--border-soft)] hover:bg-[var(--surface)] cursor-pointer transition-colors last:border-0 flex items-start gap-2 ${
                              isUnread ? "bg-primary/5" : ""
                            }`}
                          >
                            <span
                              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                                isUnread ? "bg-red-500" : "bg-transparent"
                              }`}
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm text-[var(--text)] ${
                                  isUnread ? "font-semibold" : "font-medium"
                                }`}
                              >
                                {item.title}
                              </p>
                              <p className="text-xs text-[var(--muted)] mt-0.5">
                                {item.time}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}


            {/* Profile panel */}
                          {showProfile && (
                <div className="absolute right-0 top-12 w-64 card shadow-card-lg z-50 overflow-hidden"
                >
                  {/* User info */}
                  <div className="px-4 py-4 border-b border-[var(--border)] flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-primary-200 to-burgundy-200 dark:from-primary-800 dark:to-burgundy-700 flex items-center justify-center text-xs font-bold text-primary-800 dark:text-primary-200 shrink-0">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {user?.name || "Гость"}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{roleLabel}</p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowProfile(false);
                        navigate("/account?tab=profile");
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
                    >
                      <UserRound size={15} className="text-[var(--muted)]" />
                      Профиль
                    </button>
                    <button
                      onClick={() => {
                        setShowProfile(false);
                        navigate("/account?tab=settings");
                      }}
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
                </div>
              )}


            {/* Streak panel */}
                          {showStreakPanel && (
                <div className="absolute right-0 top-12 w-[320px] max-w-[calc(100vw-2rem)] card shadow-card-lg z-50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200/60 dark:border-primary-800/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
                        <Flame size={14} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm font-display leading-tight">
                          {streakDays > 0
                            ? `${streakDays} ${streakDays === 1 ? "день" : streakDays >= 2 && streakDays <= 4 ? "дня" : "дней"} подряд`
                            : "0 дней без перерыва"}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          Календарь активности
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowStreakPanel(false)}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface)]"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Current week */}
                    {(() => {
                      const today = new Date();
                      const todayIso = toIsoDay(today);
                      const weekStart = startOfIsoWeek(today);
                      const days = Array.from({ length: 7 }).map((_, idx) => {
                        const d = new Date(weekStart);
                        d.setDate(d.getDate() + idx);
                        const iso = toIsoDay(d);
                        return {
                          iso,
                          label: RU_WEEKDAYS_SHORT[idx],
                          dayNumber: d.getDate(),
                          isFuture: iso > todayIso,
                          isToday: iso === todayIso,
                          isActive: activeDays.includes(iso),
                        };
                      });
                      const monthLabel = `${RU_MONTHS_FULL[today.getMonth()]} ${today.getFullYear()}`;
                      return (
                        <>
                          <p className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-semibold">
                            Эта неделя · {monthLabel}
                          </p>
                          <div className="grid grid-cols-7 gap-1.5">
                            {days.map((d) => (
                              <div
                                key={d.iso}
                                title={`${d.iso}${d.isActive ? " · были активности" : d.isFuture ? "" : " · без активности"}`}
                                className="flex flex-col items-center gap-1"
                              >
                                <span className="text-[10px] uppercase text-[var(--muted)] font-medium">
                                  {d.label}
                                </span>
                                <div
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold border transition-colors ${
                                    d.isFuture
                                      ? "bg-transparent border-dashed border-[var(--border)] text-[var(--muted)]"
                                      : d.isActive
                                        ? "btn-gradient text-white border-transparent"
                                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)]"
                                  } ${
                                    d.isToday ? "ring-2 ring-primary/40" : ""
                                  }`}
                                >
                                  {d.dayNumber}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}

                    {/* Last 9 weeks heatmap */}
                    <div className="pt-2 border-t border-[var(--border)]">
                      <p className="text-[11px] uppercase tracking-wide text-[var(--muted)] font-semibold mb-2">
                        Последние 9 недель
                      </p>
                      <div className="flex items-end gap-[3px]">
                        {Array.from({ length: 9 }).map((_, weekIdx) => (
                          <div
                            key={weekIdx}
                            className="flex flex-col gap-[3px]"
                          >
                            {Array.from({ length: 7 }).map((_, dayIdx) => {
                              const daysAgo =
                                (8 - weekIdx) * 7 + (6 - dayIdx);
                              const d = new Date();
                              d.setHours(0, 0, 0, 0);
                              d.setDate(d.getDate() - daysAgo);
                              const iso = toIsoDay(d);
                              const active = activeDays.includes(iso);
                              return (
                                <div
                                  key={dayIdx}
                                  title={`${iso}${active ? " · были активности" : ""}`}
                                  className={`w-[10px] h-[10px] rounded-[2px] ${
                                    active
                                      ? "bg-primary"
                                      : "bg-[var(--border)]"
                                  }`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-[var(--muted)] pt-1">
                      Чтобы продлить серию, выполните хотя бы одно задание
                      сегодня.
                    </p>
                  </div>
                </div>
              )}
          </div>
        </header>

        {/* Page content — pb-24 на мобиле чтобы контент не уходил под нижнюю навигацию */}
        <main className="flex-1 p-4 pb-24 md:pb-6 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>

        {/* Mobile bottom bar */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30 md:hidden
          bg-[var(--bg)]/95 backdrop-blur-md border-t border-[var(--border)]
          grid grid-cols-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {[
            { to: "/dashboard", label: "Панель",  icon: LayoutDashboard },
            { to: "/course",    label: "Курсы",   icon: BookOpen },
            { to: "/task",      label: "Review",  icon: Code },
            { to: "/ai-review", label: "AI-чат",  icon: Brain },
          ].map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center justify-center gap-1 pt-2 pb-3 transition-colors"
              >
                <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all
                  ${active ? "bg-primary/10" : ""}`}>
                  <Icon size={20} className={active ? "text-primary" : "text-[var(--muted)]"} />
                </div>
                <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-[var(--muted)]"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Modal: new course */}
        <Modal open={showAddCourse} onClose={closeAddCourse} title="Новый курс">
          <div className="space-y-4 py-2">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--text-2)] mb-1.5 block">
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
              <span className="text-sm font-semibold text-[var(--text-2)] mb-1.5 block">
                Уровень
              </span>
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
            <button
              onClick={closeAddCourse}
              className="btn-ghost px-5 py-2.5 text-sm"
            >
              Отмена
            </button>
            <button
              onClick={createCourse}
              className="btn-primary px-6 py-2.5 text-sm"
            >
              Добавить
            </button>
          </div>
        </Modal>
      </div>

      {/* Dismiss overlays on outside click */}
      {(showNotifications || showProfile || showStreakPanel) && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => {
            setShowNotifications(false);
            setShowProfile(false);
            setShowStreakPanel(false);
          }}
        />
      )}
    </div>
  );
}
