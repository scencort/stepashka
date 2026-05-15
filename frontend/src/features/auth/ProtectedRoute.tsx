// ProtectedRoute — охранник маршрутов, стоит перед каждой закрытой страницей
// работает как вышибала: проверяет три вещи по очереди и либо пускает, либо разворачивает
//
// порядок проверок важен — именно такой:
//   1. loadingUser=true → рисуем скелетон (ещё не знаем кто залогинен, ждём /auth/me)
//   2. user=null → редирект на /login (точно не залогинен)
//   3. роль не подходит → редирект на /dashboard (залогинен, но нет прав)
//   4. всё ок → рендерим дочерний контент
//
// если показывать null вместо скелетона на шаге 1 — пользователь увидит мигание:
//   сначала редирект на /login, потом быстрый возврат когда /auth/me ответил
//   скелетон убирает это мигание — страница "думает" а не прыгает
import { Navigate, useLocation } from "react-router-dom"
import { useAppStore } from "../../store/AppStore"
import Skeleton from "../../components/ui/Skeleton"
import type { Role } from "../../services/api"

type Props = {
  children: React.ReactNode
  // если не передать allowedRoles — страница доступна любому залогиненному
  // если передать ["teacher", "admin"] — студент получит редирект на /dashboard
  allowedRoles?: Role[]
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const location = useLocation()
  // читаем из глобального стора — user и loadingUser заполняются при старте приложения
  // AppStoreProvider делает GET /auth/me и пишет результат в стейт
  const { user, loadingUser } = useAppStore()

  // шаг 1: /auth/me ещё не ответил — показываем скелетон вместо пустоты
  // loadingUser=true только первые ~200-500мс пока летит запрос к бэку
  if (loadingUser) {
    return (
      <div className="min-h-screen p-6 space-y-3">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // шаг 2: пользователь не залогинен — отправляем на /login
  // state={{ from }} запоминает откуда пришли: после успешного входа Login.tsx
  // может сделать navigate(location.state.from) чтобы вернуть на нужную страницу
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // шаг 3: залогинен, но роль не подходит для этой страницы
  // allowedRoles.includes(user.role) — проверяем есть ли роль в разрешённом списке
  // студент пытается открыть /admin → его роль "student" не в ["admin"] → /dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  // шаг 4: все проверки прошли — рендерим то что передали в children
  // <></> это React.Fragment — просто прозрачная обёртка без лишнего DOM-узла
  return <>{children}</>
}
