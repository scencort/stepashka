// универсальный модальный диалог — backdrop + карточка по центру экрана
// используется в: AccountSettings.tsx (смена email, 2FA), CourseEditor.tsx
//
// структура DOM:
//   div.fixed.inset-0.z-[110]  ← стекинг-контекст поверх всего кроме тостов (z-120)
//     div.backdrop              ← полупрозрачный фон, клик → onClose()
//     div.card                  ← сама карточка, абсолютно по центру через translate trick
//       div.header              ← заголовок + кнопка X
//       {children}              ← содержимое страницы
//
// "translate trick" центрирования: left:50% top:50% + -translate-x-1/2 -translate-y-1/2
// работает лучше чем flex на родителе — карточка не растягивает backdrop
//
// props:
//   open     — если false компонент не рендерится совсем (ранний return null)
//              это значит что CSS-анимации нет — карточка мгновенно появляется/исчезает
//   title    — заголовок в шапке модала
//   onClose  — вызывается при клике на backdrop ИЛИ кнопку X
//   children — содержимое модала (форма, список, etc.)
import { X } from "lucide-react"

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function Modal({ open, title, onClose, children }: Props) {
  // ранний выход — не рендерим DOM-узлы когда модал закрыт
  // это дешевле чем display:none — элементы вообще не существуют в DOM
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110]">
      {/* backdrop: полупрозрачный чёрный фон + blur */}
      {/* backdrop-blur-sm размывает содержимое под модалом для ощущения глубины */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* карточка модала */}
      {/* w-[min(92vw,560px)] — на мобиле 92% ширины, на десктопе max 560px */}
      <div className="absolute left-1/2 top-1/2 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-[24px] p-4 sm:p-7">

        {/* шапка: заголовок слева, кнопка X справа */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* содержимое — всё что передаётся через children */}
        {children}
      </div>
    </div>
  )
}
