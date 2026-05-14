/* eslint-disable react-refresh/only-export-components */
// система уведомлений (тостов) — провайдер и хук в одном файле
// анимации через framer-motion (AnimatePresence следит за массивом и анимирует вход/выход)
// поток: компонент вызывает toast.success("...") → push() добавляет в массив toasts
//   → AnimatePresence рендерит motion.div → через 3.2с setTimeout удаляет по id
//   → AnimatePresence видит что элемент убрали → запускает exit анимацию → пропадает
// тосты стекаются в правом верхнем углу, z-index 120 чтобы поверх модалок
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

// два типа тоста — успех и ошибка
type ToastType = "success" | "error"

type ToastItem = {
  id: number       // уникальный id для AnimatePresence
  message: string
  type: ToastType
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

type Props = {
  children: React.ReactNode
}

export function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // push добавляет тост и через 3.2 секунды удаляет его по id
  // id = Date.now + random чтобы избежать коллизий при частых вызовах
  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3200)
  }, [])

  // мемоизируем value чтобы не перерендеривать всё дерево на каждый тост
  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* фиксированный контейнер тостов — правый верхний угол */}
      <div className="fixed z-[120] top-4 right-4 space-y-2 w-[min(92vw,340px)]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, y: -6 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 14, y: -4 }}
              // оба типа — красные, но ошибка темнее
              className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[0_10px_24px_rgba(26,10,10,0.18)] text-sm font-semibold ${
                toast.type === "success"
                  ? "bg-gradient-to-r from-[#CD3036] to-[#7A171C] border-red-700/40 text-white"
                  : "bg-gradient-to-r from-[#8A1D24] to-[#4A1014] border-red-900/40 text-rose-50"
              }`}
            >
              {/* декоративная полоска бликов сверху */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/45" />
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// хук для использования тостов — бросает ошибку если вызван вне провайдера
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider")
  }
  return ctx
}
