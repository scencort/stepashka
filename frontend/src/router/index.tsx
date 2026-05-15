/**
 * router/index.tsx — Центральный роутер приложения
 *
 * Здесь определяются ВСЕ маршруты (URL-пути) приложения.
 * Используется React Router v6 (компонентный стиль через <Routes> / <Route>).
 *
 * ──────────────────────────────────────────────────────────────
 * АРХИТЕКТУРНЫЕ РЕШЕНИЯ
 * ──────────────────────────────────────────────────────────────
 *
 * 1. LAZY LOADING (ленивая загрузка)
 *    Каждая страница импортируется через React.lazy() + dynamic import.
 *    Это означает, что код страницы загружается из сети ТОЛЬКО тогда,
 *    когда пользователь впервые переходит на этот маршрут.
 *    Без этого весь JS грузился бы одним огромным файлом при старте.
 *    Итог: быстрый первый экран, меньше трафика.
 *
 * 2. SUSPENSE (заглушка во время загрузки)
 *    Пока lazy-компонент ещё не загружен с сервера, React показывает
 *    `pageFallback` — стеклянная панель «Загрузка страницы...».
 *    `withSuspense()` — вспомогательная функция, которая оборачивает
 *    любой элемент в <Suspense> с нужным fallback, чтобы не дублировать
 *    эту обёртку вручную для каждого маршрута.
 *
 * 3. ЗАЩИЩЁННЫЕ МАРШРУТЫ (ProtectedRoute)
 *    <ProtectedRoute> — компонент-«охранник» (features/auth/ProtectedRoute).
 *    Если пользователь не авторизован → редирект на /login.
 *    Если передан allowedRoles и роль пользователя не подходит → редирект на /dashboard.
 *    Используется для всех страниц, требующих входа.
 *
 * 4. ROLE-BASED ROUTES (маршруты по роли)
 *    /teacher и /teacher/courses/* — только для ролей "teacher" и "admin".
 *    /admin — только для роли "admin".
 *    Остальные защищённые маршруты доступны любому авторизованному пользователю.
 *
 * ──────────────────────────────────────────────────────────────
 * СТРУКТУРА МАРШРУТОВ
 * ──────────────────────────────────────────────────────────────
 *
 * Публичные (без авторизации):
 *   /                    — Landing (главная страница)
 *   /login               — Вход в аккаунт
 *   /register            — Регистрация
 *   /forgot-password     — Запрос сброса пароля (отправка письма)
 *   /reset-password      — Ввод нового пароля по ссылке из письма
 *   /privacy             — Политика конфиденциальности
 *   /terms               — Пользовательское соглашение
 *   *                    — NotFound (404 для всех неизвестных URL)
 *
 * Защищённые (требуют авторизации, любая роль):
 *   /dashboard           — Главная панель студента: статистика, курсы, активность
 *   /course              — Список курсов (без конкретного курса)
 *   /course/:courseId    — Конкретный курс по ID (уроки, прогресс)
 *   /ai-review           — Страница задания с кодом (Task.tsx, несмотря на URL)
 *   /ai-chat             — AI-ассистент (чат с искусственным интеллектом)
 *   /analytics           — Аналитика успеваемости студента
 *   /feedback            — Форма обратной связи
 *   /help-center         — Центр помощи / FAQ
 *   /account             — Настройки аккаунта (аватар, пароль, имя)
 *
 * Защищённые (только teacher + admin):
 *   /teacher                          — Студия преподавателя (список своих курсов)
 *   /teacher/courses/new              — Создание нового курса
 *   /teacher/courses/:courseId/edit   — Редактирование существующего курса
 *
 * Защищённые (только admin):
 *   /admin               — Административная панель (пользователи, статистика)
 */

import { lazy, Suspense, type ReactNode } from "react"
import { Routes, Route } from "react-router-dom"

// ─── Ленивая загрузка страниц ────────────────────────────────────────────────
// Каждый lazy() возвращает Promise, который разрешается в модуль страницы.
// Webpack/Vite автоматически создаёт отдельный chunk (файл) для каждой страницы.

const Landing        = lazy(() => import("../pages/Landing"))           // Публичная главная
const Dashboard      = lazy(() => import("../pages/Dashboard"))         // Панель студента
const Course         = lazy(() => import("../pages/Course"))            // Страница курса
const Task           = lazy(() => import("../pages/Task"))              // Страница задания с кодом
const Login          = lazy(() => import("../pages/Login"))             // Вход
const Register       = lazy(() => import("../pages/Register"))          // Регистрация
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"))   // Сброс пароля — шаг 1
const ResetPassword  = lazy(() => import("../pages/ResetPassword"))    // Сброс пароля — шаг 2
const AiReview       = lazy(() => import("../pages/AiReview"))         // AI-чат ассистент
const Analytics      = lazy(() => import("../pages/Analytics"))        // Аналитика
const Feedback       = lazy(() => import("../pages/Feedback"))         // Обратная связь
const HelpCenter     = lazy(() => import("../pages/HelpCenter"))       // Центр помощи
const AdminPanel     = lazy(() => import("../pages/AdminPanel"))       // Панель администратора
const TeacherStudio  = lazy(() => import("../pages/TeacherStudio"))   // Студия преподавателя
const AccountSettings = lazy(() => import("../pages/AccountSettings")) // Настройки аккаунта
const CourseEditor   = lazy(() => import("../pages/CourseEditor"))     // Редактор курса
const NotFound       = lazy(() => import("../pages/NotFound"))         // 404
const Privacy        = lazy(() => import("../pages/Privacy"))          // Политика конфиденциальности
const Terms          = lazy(() => import("../pages/Terms"))            // Пользовательское соглашение

// ProtectedRoute импортируется синхронно — он нужен сразу при инициализации,
// чтобы корректно перехватить навигацию до того, как lazy-страница загрузится.
import ProtectedRoute from "../features/auth/ProtectedRoute"

// ─── Заглушка на время загрузки страницы ─────────────────────────────────────
// Показывается внутри <Suspense fallback=...> пока lazy-компонент ещё не готов.
// glass-panel — CSS-класс из глобальных стилей (полупрозрачная карточка с blur).
const pageFallback = (
  <div className="min-h-[40vh] flex items-center justify-center px-4">
    <div className="glass-panel rounded-xl px-4 py-3 text-sm text-slate-500">Загрузка страницы...</div>
  </div>
)

// ─── Вспомогательная обёртка Suspense ────────────────────────────────────────
// Принимает любой ReactNode и оборачивает его в <Suspense> с нашим fallback.
// Позволяет не писать <Suspense fallback={pageFallback}> вручную на каждой строке.
const withSuspense = (element: ReactNode) => <Suspense fallback={pageFallback}>{element}</Suspense>

// ─── Главный компонент роутера ────────────────────────────────────────────────
// Монтируется в App.tsx (или main.tsx) внутри <BrowserRouter>.
// <Routes> выбирает первый подходящий <Route> сверху вниз (как switch).
export const Router = () => {
  return (
    <Routes>
      {/* ── Публичные маршруты (без авторизации) ──────────────────────────── */}

      {/* Главная страница — видна всем, включая незарегистрированных */}
      <Route path="/" element={withSuspense(<Landing />)} />

      {/* Страница входа — если уже авторизован, Login сам редиректит на /dashboard */}
      <Route path="/login" element={withSuspense(<Login />)} />

      {/* Регистрация нового аккаунта */}
      <Route path="/register" element={withSuspense(<Register />)} />

      {/* Шаг 1: ввод email для получения письма со ссылкой сброса пароля */}
      <Route path="/forgot-password" element={withSuspense(<ForgotPassword />)} />

      {/* Шаг 2: переход по ссылке из письма → ввод нового пароля */}
      <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />

      {/* ── Защищённые маршруты (любой авторизованный пользователь) ──────── */}

      {/* Личный кабинет студента: статистика, еженедельный план, продолжить курс */}
      <Route path="/dashboard" element={withSuspense(<ProtectedRoute><Dashboard /></ProtectedRoute>)} />

      {/* Список всех доступных курсов (без выбранного курса) */}
      <Route path="/course" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />

      {/* Страница задания с кодом. URL /ai-review исторически, но рендерит Task.tsx */}
      <Route path="/ai-review" element={withSuspense(<ProtectedRoute><Task /></ProtectedRoute>)} />

      {/* AI-чат ассистент — помогает разобраться с темой, отвечает на вопросы */}
      <Route path="/ai-chat" element={withSuspense(<ProtectedRoute><AiReview /></ProtectedRoute>)} />

      {/* Аналитика: прогресс по курсам, XP, рейтинг, активность по дням */}
      <Route path="/analytics" element={withSuspense(<ProtectedRoute><Analytics /></ProtectedRoute>)} />

      {/* Конкретный курс по его ID из базы данных (уроки, шаги, прогресс) */}
      <Route path="/course/:courseId" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />

      {/* Форма обратной связи — студент может сообщить о проблеме */}
      <Route path="/feedback" element={withSuspense(<ProtectedRoute><Feedback /></ProtectedRoute>)} />

      {/* Центр помощи: FAQ, документация, советы */}
      <Route path="/help-center" element={withSuspense(<ProtectedRoute><HelpCenter /></ProtectedRoute>)} />

      {/* Настройки аккаунта: имя, аватар, смена пароля, уведомления */}
      <Route path="/account" element={withSuspense(<ProtectedRoute><AccountSettings /></ProtectedRoute>)} />

      {/* ── Маршруты преподавателя (teacher + admin) ──────────────────────── */}

      {/* Студия преподавателя: список созданных им курсов, статистика по ним */}
      <Route path="/teacher" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><TeacherStudio /></ProtectedRoute>)} />

      {/* Создание нового курса с нуля через визуальный редактор */}
      <Route path="/teacher/courses/new" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><CourseEditor /></ProtectedRoute>)} />

      {/* Редактирование существующего курса: добавление/удаление уроков, шагов */}
      <Route path="/teacher/courses/:courseId/edit" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><CourseEditor /></ProtectedRoute>)} />

      {/* ── Только для администратора ─────────────────────────────────────── */}

      {/* Административная панель: управление пользователями, глобальная статистика */}
      <Route path="/admin" element={withSuspense(<ProtectedRoute allowedRoles={["admin"]}><AdminPanel /></ProtectedRoute>)} />

      {/* ── Публичные служебные страницы ──────────────────────────────────── */}

      {/* Политика конфиденциальности (GDPR / требование магазинов приложений) */}
      <Route path="/privacy" element={withSuspense(<Privacy />)} />

      {/* Пользовательское соглашение */}
      <Route path="/terms" element={withSuspense(<Terms />)} />

      {/* Ловушка для всех неизвестных URL — показывает страницу 404 */}
      <Route path="*" element={withSuspense(<NotFound />)} />
    </Routes>
  )
}
