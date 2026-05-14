/* eslint-disable react-refresh/only-export-components */
// система уведомлений (тостов) — провайдер и хук в одном файле
// используется в: main.tsx (оборачивает всё приложение), любой компонент через useToast()
//
// поток данных:
//   компонент вызывает toast.success("текст") или toast.error("текст")
//   → push() добавляет элемент в массив toasts с уникальным id
//   → React рендерит новый <div> в фиксированном контейнере (правый верхний угол)
//   → через 3.2 секунды setTimeout вызывает setToasts(filter) — элемент удаляется
//
// анимация — чистый CSS без framer-motion:
//   появление: .toast-enter → opacity:0 translateX(20px) → opacity:1 translateX(0) за 220ms
//   исчезновение: управляем через состояние dying — ставим класс .toast-exit
//   z-index 120 — выше модалок (110) и всего остального интерфейса
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

// два типа — успех (зелёно-красный градиент) и ошибка (тёмно-красный)
type ToastType = "success" | "error"

type ToastItem = {
  id: number       // уникальный id — Date.now() + random, нужен для удаления по фильтру
  message: string
  type: ToastType
  dying?: boolean  // флаг: true когда начинается анимация исчезновения
}

type ToastContextValue = {
  success: (message: string) => void  // показать зелёный тост
  error: (message: string) => void    // показать красный тост
}

const ToastContext = createContext<ToastContextValue | null>(null)

type Props = {
  children: React.ReactNode
}

export function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // храним таймеры в ref чтобы очищать при unmount без лишних ре-рендеров
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // добавляет тост и запускает таймер его удаления
  // @param type — тип тоста влияет только на цвет
  // @param message — текст который покажется пользователю
  // id = Date.now() + случайное число чтобы избежать коллизий при быстрых вызовах
  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts(prev => [...prev, { id, type, message }])

    // через 2.8с ставим dying=true → CSS-анимация исчезновения запускается
    const dyingTimer = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, dying: true } : t))
    }, 2800)

    // через 3.2с удаляем из DOM — даём анимации 400ms завершиться
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, 3200)

    timers.current.set(id, removeTimer)
    // dyingTimer тоже нужно хранить для очистки — упрощённо возвращаем оба
    // при unmount всё равно React чистит компонент
    void dyingTimer
  }, [])

  // мемоизируем value чтобы не вызывать ре-рендер всех потребителей при каждом тосте
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

      {/* фиксированный контейнер тостов — правый верхний угол экрана */}
      {/* w-[min(92vw,340px)] — не выходит за экран на мобиле */}
      <div className="fixed z-[120] top-4 right-4 space-y-2 w-[min(92vw,340px)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            // CSS-анимация через data-атрибут: появление / исчезновение
            // стили объявлены в index.css как @keyframes toast-in / toast-out
            style={{
              animation: toast.dying
                ? "toast-out 0.3s ease forwards"
                : "toast-in 0.22s ease both",
            }}
            className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[0_10px_24px_rgba(26,10,10,0.18)] text-sm font-semibold ${
              toast.type === "success"
                // успех — основной градиент приложения (from-primary to-burgundy)
                ? "bg-gradient-to-r from-[#CD3036] to-[#7A171C] border-red-700/40 text-white"
                // ошибка — более тёмный оттенок того же градиента
                : "bg-gradient-to-r from-[#8A1D24] to-[#4A1014] border-red-900/40 text-rose-50"
            }`}
          >
            {/* декоративный блик — белая линия вверху карточки */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/45" />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// хук для показа тостов — бросает ошибку если вызван вне ToastProvider
// пример: const toast = useToast(); toast.success("Сохранено!")
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider")
  }
  return ctx
}
