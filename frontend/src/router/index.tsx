import { lazy, Suspense, type ReactNode } from "react"
import { Routes, Route } from "react-router-dom"

const Landing = lazy(() => import("../pages/Landing"))
const Dashboard = lazy(() => import("../pages/Dashboard"))
const Course = lazy(() => import("../pages/Course"))
const Task = lazy(() => import("../pages/Task"))
const Login = lazy(() => import("../pages/Login"))
const Register = lazy(() => import("../pages/Register"))
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"))
const ResetPassword = lazy(() => import("../pages/ResetPassword"))
const LearningPaths = lazy(() => import("../pages/LearningPaths"))
const AiReview = lazy(() => import("../pages/AiReview"))
const AssignmentBuilder = lazy(() => import("../pages/AssignmentBuilder"))
const Analytics = lazy(() => import("../pages/Analytics"))
const RolesAccess = lazy(() => import("../pages/RolesAccess"))
const Feedback = lazy(() => import("../pages/Feedback"))
const HelpCenter = lazy(() => import("../pages/HelpCenter"))
const AdminPanel = lazy(() => import("../pages/AdminPanel"))
const TeacherStudio = lazy(() => import("../pages/TeacherStudio"))
const AccountSettings = lazy(() => import("../pages/AccountSettings"))
import ProtectedRoute from "../features/auth/ProtectedRoute"

const pageFallback = (
  <div className="min-h-[40vh] flex items-center justify-center px-4">
    <div className="glass-panel rounded-xl px-4 py-3 text-sm text-slate-500">Загрузка страницы...</div>
  </div>
)

const withSuspense = (element: ReactNode) => <Suspense fallback={pageFallback}>{element}</Suspense>

export const Router = () => {
  return (
    <Routes>
      <Route path="/" element={withSuspense(<Landing />)} />
      <Route path="/login" element={withSuspense(<Login />)} />
      <Route path="/register" element={withSuspense(<Register />)} />
      <Route path="/forgot-password" element={withSuspense(<ForgotPassword />)} />
      <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />

      <Route path="/dashboard" element={withSuspense(<ProtectedRoute><Dashboard /></ProtectedRoute>)} />
      <Route path="/course" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />
      <Route path="/task" element={withSuspense(<ProtectedRoute><Task /></ProtectedRoute>)} />
      <Route path="/learning-paths" element={withSuspense(<ProtectedRoute><LearningPaths /></ProtectedRoute>)} />
      <Route path="/ai-review" element={withSuspense(<ProtectedRoute><AiReview /></ProtectedRoute>)} />
      <Route path="/assignment-builder" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><AssignmentBuilder /></ProtectedRoute>)} />
      <Route path="/teacher/assignments" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><AssignmentBuilder /></ProtectedRoute>)} />
      <Route path="/analytics" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><Analytics /></ProtectedRoute>)} />
      <Route path="/course/:courseId" element={withSuspense(<ProtectedRoute><Course /></ProtectedRoute>)} />
      <Route path="/roles-access" element={withSuspense(<ProtectedRoute allowedRoles={["admin"]}><RolesAccess /></ProtectedRoute>)} />
      <Route path="/feedback" element={withSuspense(<ProtectedRoute><Feedback /></ProtectedRoute>)} />
      <Route path="/help-center" element={withSuspense(<ProtectedRoute><HelpCenter /></ProtectedRoute>)} />
      <Route path="/account" element={withSuspense(<ProtectedRoute><AccountSettings /></ProtectedRoute>)} />
      <Route path="/teacher" element={withSuspense(<ProtectedRoute allowedRoles={["teacher", "admin"]}><TeacherStudio /></ProtectedRoute>)} />
      <Route path="/admin" element={withSuspense(<ProtectedRoute allowedRoles={["admin"]}><AdminPanel /></ProtectedRoute>)} />
    </Routes>
  )
}