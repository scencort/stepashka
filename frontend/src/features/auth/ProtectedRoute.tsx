import { Navigate, useLocation } from "react-router-dom"
import { useAppStore } from "../../store/AppStore"
import Skeleton from "../../components/ui/Skeleton"
import type { Role } from "../../services/api"

type Props = {
  children: React.ReactNode
  allowedRoles?: Role[]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const location = useLocation()
  const { user, loadingUser } = useAppStore()

  if (loadingUser) {
    return (
      <div className="min-h-screen p-6 space-y-3">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
