// скелетон-заглушка для состояния загрузки данных
// используется в: ProtectedRoute.tsx (пока не известен юзер),
//                 AccountSettings.tsx (загрузка профиля),
//                 AdminPanel.tsx, TeacherStudio.tsx, Course.tsx
//
// как работает animate-pulse:
//   tailwind добавляет CSS анимацию opacity 1→0.5→1 с периодом 2 секунды
//   создаёт эффект "дышащего" блока — намекает пользователю что что-то загружается
//
// props:
//   className — задаёт размер и форму заглушки
//   примеры:
//     <Skeleton className="h-12 w-64" />          — прямоугольник (заголовок)
//     <Skeleton className="h-40 w-full" />         — большой блок (карточка)
//     <Skeleton className="h-8 w-8 rounded-full" /> — круг (аватар)
type Props = {
  className?: string
}

export default function Skeleton({ className = "" }: Props) {
  // rounded-[24px] — соответствует скруглению карточек (.card класс в index.css)
  // bg-zinc-200/70 light / bg-zinc-800/80 dark — нейтральный серый фон
  return <div className={`animate-pulse rounded-[24px] bg-zinc-200/70 dark:bg-zinc-800/80 ${className}`} />
}
