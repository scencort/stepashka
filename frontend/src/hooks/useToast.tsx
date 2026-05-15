/* eslint-disable react-refresh/only-export-components */
// useToast — система всплывающих уведомлений (тостов) в правом верхнем углу
// реализована как Context + хук, в одном файле провайдер и хук
//
// КАК РАБОТАЕТ (полная цепочка):
//   любой компонент вызывает toast.success("Сохранено!")
//     → push("success", "Сохранено!") добавляет объект в массив toasts через setToasts
//       → React видит что toasts изменился → перерисовывает контейнер тостов
//         → новый <div> появляется с анимацией toast-in (объявлена в index.css)
//           → через 2800мс setTimeout: ставит dying=true → анимация toast-out запускается
//             → через 3200мс второй setTimeout: удаляет тост из массива фильтром
//               → React снова перерисовывается → тост исчезает из DOM
//
// ПОЧЕМУ ДВА ТАЙМЕРА (2800 и 3200):
//   нельзя удалить элемент из DOM пока идёт CSS-анимация исчезновения
//   2800мс — начало анимации исчезновения (400мс анимации)
//   3200мс — удаление из DOM (анимация уже закончилась)
//
// z-index 120 — выше модалок (z-110) и всего остального интерфейса
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"

// два вида тостов — влияют только на цвет фона
type ToastType = "success" | "error"

type ToastItem = {
  id: number       // уникальный id: Date.now() + случайное число — нужен для точечного удаления
  message: string  // текст который видит пользователь
  type: ToastType
  dying?: boolean  // когда true — CSS меняет анимацию с toast-in на toast-out
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // массив всех активных тостов — может быть несколько одновременно
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // храним id таймеров в ref (не в state) — изменение ref не вызывает ре-рендер
  // это важно: нам не нужно перерисовывать компонент при добавлении таймера
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  // добавляет тост и запускает два таймера: на анимацию и на удаление
  // useCallback мемоизирует функцию — она не пересоздаётся при каждом рендере
  // это нужно чтобы useMemo ниже не пересоздавал value при каждом рендере
  const push = useCallback((type: ToastType, message: string) => {
    // Date.now() + random — защита от коллизий если два тоста появятся в одну миллисекунду
    const id = Date.now() + Math.floor(Math.random() * 1000)

    // добавляем новый тост к существующим (spread чтобы не мутировать массив)
    setToasts(prev => [...prev, { id, type, message }])

    // через 2.8с — помечаем тост как dying
    // map возвращает новый массив где только нужный тост изменён (immutable update)
    const dyingTimer = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, dying: true } : t))
    }, 2800)

    // через 3.2с — удаляем тост из DOM
    // filter возвращает новый массив без элемента с нашим id
    const removeTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, 3200)

    timers.current.set(id, removeTimer)
    void dyingTimer
  }, [])

  // useMemo — пересоздаёт объект только когда меняется push
  // без него каждый рендер ToastProvider создавал бы новый объект value
  // все компоненты которые читают контекст перерисовывались бы без причины
  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push("success", message),
      error:   (message: string) => push("error",   message),
    }),
    [push]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* fixed — контейнер всегда в правом верхнем углу независимо от скролла */}
      {/* z-[120] — выше модалок (z-110) и сайдбара (z-30) */}
      {/* w-[min(92vw,340px)] — на узких экранах не выходит за края */}
      <div className="fixed z-[120] top-4 right-4 space-y-2 w-[min(92vw,340px)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              // dying=false → появление: opacity 0→1, сдвиг вправо→центр за 220мс
              // dying=true  → исчезновение: opacity 1→0, сдвиг центр→вправо за 300мс
              // keyframes объявлены в index.css как @keyframes toast-in / toast-out
              animation: toast.dying
                ? "toast-out 0.3s ease forwards"
                : "toast-in 0.22s ease both",
            }}
            className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 shadow-[0_10px_24px_rgba(26,10,10,0.18)] text-sm font-semibold ${
              toast.type === "success"
                ? "bg-gradient-to-r from-[#CD3036] to-[#7A171C] border-red-700/40 text-white"
                : "bg-gradient-to-r from-[#8A1D24] to-[#4A1014] border-red-900/40 text-rose-50"
            }`}
          >
            {/* декоративный блик — тонкая белая линия по верхнему краю карточки */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/45" />
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// хук — даёт любому компоненту доступ к toast.success() и toast.error()
// бросает ошибку если вызван вне ToastProvider — защита от забытого провайдера
// пример использования: const toast = useToast(); toast.error("Ошибка сети")
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}
