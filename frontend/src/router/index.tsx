// ─── РОУТЕР ПРИЛОЖЕНИЯ ────────────────────────────────────────────────────────
// здесь описаны все страницы и их URL-пути
//
// КАК РАБОТАЕТ НАВИГАЦИЯ (полная цепочка):
//   пользователь кликает на ссылку /dashboard
//     → react-router-dom перехватывает событие (без перезагрузки страницы!)
//       → сравнивает URL со всеми <Route path="..."> сверху вниз
//         → нашёл path="/dashboard" → рендерит его element
//           → element = withSuspense(<ProtectedRoute><Dashboard /></ProtectedRoute>)
//             → ProtectedRoute проверяет user в AppStore
//               → если нет → <Navigate to="/login" /> (браузер переходит на логин)
//               → если есть → React.lazy начинает скачивать Dashboard.tsx как отдельный файл
//                 → пока скачивается → Suspense показывает "Загрузка страницы..."
//                   → файл скачан и выполнен → React рендерит Dashboard
//
// ЗАЧЕМ React.lazy (ленивая загрузка):
//   без lazy — браузер скачивает ВСЕ страницы сразу при первом открытии (медленно)
//   с lazy — каждая страница это отдельный JS-файл (чанк), скачивается только при первом переходе
//   студент никогда не откроет AdminPanel → её код никогда не скачается → быстрее загрузка
//
// ЗАЧЕМ withSuspense хелпер:
//   без него пришлось бы писать <Suspense fallback={...}> вокруг каждого Route отдельно
//   withSuspense — просто сокращение: withSuspense(X) = <Suspense fallback={заглушка}>{X}</Suspense>
//
// УРОВНИ ДОСТУПА через ProtectedRoute:
//   без ProtectedRoute           → публичная страница (лендинг, логин, регистрация)
//   <ProtectedRoute>             → любой залогиненный (student / teacher / admin)
//   allowedRoles={["teacher","admin"]} → только учителя и администраторы
//   allowedRoles={["admin"]}     → только администраторы
//   проверка происходит в ProtectedRoute.tsx — он читает user.role из AppStore
import { lazy, Suspense, type ReactNode } from "react"
import { Routes, Route } from "react-router-dom"

// React.lazy принимает функцию которая возвращает динамический import
// import("../pages/Dashboard") — это Promise, он резолвится когда файл скачан
// браузер скачает Dashboard.tsx только когда пользователь первый раз перейдёт на /dashboard
const Landing        = lazy(() => import("../pages/Landing"))
const Dashboard      = lazy(() => import("../pages/Dashboard"))
const Course         = lazy(() => import("../pages/Course"))
const Task           = lazy(() => import("../pages/Task"))
const Login          = lazy(() => import("../pages/Login"))
const Register       = lazy(() => import("../pages/Register"))
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"))
const ResetPassword  = lazy(() => import("../pages/ResetPassword"))
const AiReview       = lazy(() => import("../pages/AiReview"))
const Analytics      = lazy(() => import("../pages/Analytics"))
const Feedback       = lazy(() => import("../pages/Feedback"))
const HelpCenter     = lazy(() => import("../pages/HelpCenter"))
const AdminPanel     = lazy(() => import("../pages/AdminPanel"))
const TeacherStudio  = lazy(() => import("../pages/TeacherStudio"))
const AccountSettings = lazy(() => import("../pages/AccountSettings"))
const CourseEditor   = lazy(() => import("../pages/CourseEditor"))
const NotFound       = lazy(() => import("../pages/NotFound"))
const Privacy        = lazy(() => import("../pages/Privacy"))
const Terms          = lazy(() => import("../pages/Terms"))

// ProtectedRoute НЕ lazy — импортируется синхронно
// причина: он должен проверить авторизацию СРАЗУ, до того как начнётся загрузка чанка страницы
// если бы он тоже был lazy — сначала качался бы его код, потом проверка, потом редирект
// это создавало бы лишнюю задержку для незалогиненных пользователей
import ProtectedRoute from "../features/auth/ProtectedRoute"

// заглушка — показывается пока lazy-чанк страницы скачивается из сети
// min-h-[40vh] чтобы не выглядело как пустая страница — хоть что-то по центру
const pageFallback = (
  <div className="min-h-[40vh] flex items-center justify-center px-4">
    <div className="glass-panel rounded-xl px-4 py-3 text-sm text-slate-500">Загрузка страницы...</div>
  </div>
)

// хелпер чтобы не дублировать <Suspense fallback={pageFallback}> на каждом Route
// withSuspense(<Dashboard />) превращается в <Suspense fallback={...}><Dashboard /></Suspense>
const withSuspense = (element: ReactNode) => <Suspense fallback={pageFallback}>{element}</Suspense>

export const Router = () => {
  return (
    // <Routes> перебирает дочерние <Route> сверху вниз и рендерит первый совпавший
    <Routes>
      {/* публичные страницы — ProtectedRoute не нужен, открыты для всех */}
      <Route path="/"               element={withSuspense(<Landing />)} />
      <Route path="/login"          element={withSuspense(<Login />)} />
      <Route path="/register"       element={withSuspense(<Register />)} />
      <Route path="/forgot-password" element={withSuspense(<ForgotPassword />)} />
      <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />

      {/* защищённые страницы — ProtectedRoute проверит user перед рендером */}
      <Route path="/dashboard"  element={withSuspense(<ProtectedRoute><Dashboard /></ProtectedRoute>)} />
      <Route path="/course"     element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />
      <Route path="/task"       element={withSuspense(<ProtectedRoute><Task /></ProtectedRoute>)} />
      <Route path="/ai-review"  element={withSuspense(<ProtectedRoute><AiReview /></ProtectedRoute>)} />
      <Route path="/analytics"  element={withSuspense(<ProtectedRoute><Analytics /></ProtectedRoute>)} />
      {/* :courseId — динамический параметр, Course читает его через useParams() */}
      <Route path="/course/:courseId" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />
      <Route path="/feedback"   element={withSuspense(<ProtectedRoute><Feedback /></ProtectedRoute>)} />
      <Route path="/help-center" element={withSuspense(<ProtectedRoute><HelpCenter /></ProtectedRoute>)} />
      <Route path="/account"    element={withSuspense(<ProtectedRoute><AccountSettings /></ProtectedRoute>)} />

      {/* только преподаватели и администраторы — ProtectedRoute проверит user.role */}
      <Route path="/teacher" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><TeacherStudio /></ProtectedRoute>)} />
      <Route path="/teacher/courses/new" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><CourseEditor /></ProtectedRoute>)} />
      <Route path="/teacher/courses/:courseId/edit" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><CourseEditor /></ProtectedRoute>)} />

      {/* только администраторы */}
      <Route path="/admin" element={withSuspense(<ProtectedRoute allowedRoles={["admin"]}><AdminPanel /></ProtectedRoute>)} />

      {/* публичные юридические страницы */}
      <Route path="/privacy" element={withSuspense(<Privacy />)} />
      <Route path="/terms"   element={withSuspense(<Terms />)} />

      {/* path="*" — ловит всё что не совпало ни с одним маршрутом выше → 404 */}
      <Route path="*" element={withSuspense(<NotFound />)} />
    </Routes>
  )
}
