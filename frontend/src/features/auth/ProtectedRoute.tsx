// защищённый роут — сюда не попасть без авторизации
// если нет юзера — редиректим на /login
// если юзер есть но роль не та — редиректим на дашборд
import { Navigate, useLocation } from "react-router-dom"
import { useAppStore } from "../../store/AppStore"
import Skeleton from "../../components/ui/Skeleton"
import type { Role } from "../../services/api"

type Props = {
  children: React.ReactNode
  allowedRoles?: Role[]  // если не передать — доступно всем залогиненным
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const location = useLocation()
  const { user, loadingUser } = useAppStore()

  // пока не знаем кто юзер — показываем скелетон, иначе будет мигание
  if (loadingUser) {
    return (
      <div className="min-h-screen p-6 space-y-3">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // не залогинен — гоним на логин, запоминаем откуда пришёл чтобы вернуть после входа
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // залогинен, но нет нужной роли — отправляем на дашборд
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  // всё ок — рендерим дочерний контент
  return <>{children}</>
}
