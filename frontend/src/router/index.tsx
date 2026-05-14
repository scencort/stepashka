// главный роутер приложения — здесь описаны все страницы и их пути
// lazy-импорты чтобы не грузить весь код сразу, только нужную страницу
import { lazy, Suspense, type ReactNode } from "react"
import { Routes, Route } from "react-router-dom"

// ленивая загрузка страниц — каждая страница грузится только когда нужна
const Landing = lazy(() => import("../pages/Landing"))
const Dashboard = lazy(() => import("../pages/Dashboard"))
const Course = lazy(() => import("../pages/Course"))
const Task = lazy(() => import("../pages/Task"))
const Login = lazy(() => import("../pages/Login"))
const Register = lazy(() => import("../pages/Register"))
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"))
const ResetPassword = lazy(() => import("../pages/ResetPassword"))
const AiReview = lazy(() => import("../pages/AiReview"))
const Analytics = lazy(() => import("../pages/Analytics"))
const Feedback = lazy(() => import("../pages/Feedback"))
const HelpCenter = lazy(() => import("../pages/HelpCenter"))
const AdminPanel = lazy(() => import("../pages/AdminPanel"))
const TeacherStudio = lazy(() => import("../pages/TeacherStudio"))
const AccountSettings = lazy(() => import("../pages/AccountSettings"))
const CourseEditor = lazy(() => import("../pages/CourseEditor"))
const NotFound = lazy(() => import("../pages/NotFound"))
const Privacy = lazy(() => import("../pages/Privacy"))
const Terms = lazy(() => import("../pages/Terms"))
// protectedRoute не ленивый — нужен сразу чтобы проверить авторизацию
import ProtectedRoute from "../features/auth/ProtectedRoute"

// заглушка пока страница грузится — показываем простой текст вместо пустоты
const pageFallback = (
  <div className="min-h-[40vh] flex items-center justify-center px-4">
    <div className="glass-panel rounded-xl px-4 py-3 text-sm text-slate-500">Загрузка страницы...</div>
  </div>
)

// обёртка которая добавляет Suspense с нашей заглушкой
const withSuspense = (element: ReactNode) => <Suspense fallback={pageFallback}>{element}</Suspense>

export const Router = () => {
  return (
    <Routes>
      {/* публичные страницы — доступны всем без входа */}
      <Route path="/" element={withSuspense(<Landing />)} />
      <Route path="/login" element={withSuspense(<Login />)} />
      <Route path="/register" element={withSuspense(<Register />)} />
      <Route path="/forgot-password" element={withSuspense(<ForgotPassword />)} />
      <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />

      {/* защищённые страницы — нужна авторизация */}
      <Route path="/dashboard" element={withSuspense(<ProtectedRoute><Dashboard /></ProtectedRoute>)} />
      <Route path="/course" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />
      <Route path="/task" element={withSuspense(<ProtectedRoute><Task /></ProtectedRoute>)} />
      <Route path="/ai-review" element={withSuspense(<ProtectedRoute><AiReview /></ProtectedRoute>)} />
      <Route path="/analytics" element={withSuspense(<ProtectedRoute><Analytics /></ProtectedRoute>)} />
      {/* курс по id — тот же компонент Course, просто с параметром */}
      <Route path="/course/:courseId" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />
      <Route path="/feedback" element={withSuspense(<ProtectedRoute><Feedback /></ProtectedRoute>)} />
      <Route path="/help-center" element={withSuspense(<ProtectedRoute><HelpCenter /></ProtectedRoute>)} />
      <Route path="/account" element={withSuspense(<ProtectedRoute><AccountSettings /></ProtectedRoute>)} />

      {/* только для преподавателей и администраторов */}
      <Route path="/teacher" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><TeacherStudio /></ProtectedRoute>)} />
      <Route path="/teacher/courses/new" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><CourseEditor /></ProtectedRoute>)} />
      <Route path="/teacher/courses/:courseId/edit" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><CourseEditor /></ProtectedRoute>)} />

      {/* только для администраторов */}
      <Route path="/admin" element={withSuspense(<ProtectedRoute allowedRoles={["admin"]}><AdminPanel /></ProtectedRoute>)} />

      {/* страницы без защиты — политика и условия */}
      <Route path="/privacy" element={withSuspense(<Privacy />)} />
      <Route path="/terms" element={withSuspense(<Terms />)} />

      {/* всё остальное — 404 */}
      <Route path="*" element={withSuspense(<NotFound />)} />
    </Routes>
  )
}
