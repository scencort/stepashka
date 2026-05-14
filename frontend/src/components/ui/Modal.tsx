// универсальный модальный диалог — backdrop + карточка по центру экрана
// клик на backdrop закрывает модал, кнопка X тоже
// z-index 110 чтобы быть поверх всего кроме тостов (z-120)
import { X } from "lucide-react"

type Props = {
  open: boolean          // если false — компонент не рендерится совсем
  title: string          // заголовок модала
  onClose: () => void    // вызывается при клике на backdrop или X
  children: React.ReactNode
}

export default function Modal({ open, title, onClose, children }: Props) {
  // ранний выход — не рендерим ничего если модал закрыт
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110]">
      {/* полупрозрачный backdrop — клик закрывает модал */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* карточка модала — абсолютно по центру экрана */}
      <div
        className="absolute left-1/2 top-1/2 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-[24px] p-4 sm:p-7"
      >
        {/* шапка модала — заголовок и кнопка закрытия */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
