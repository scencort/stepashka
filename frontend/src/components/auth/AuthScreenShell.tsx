// обёртка для экранов авторизации (Login, Register, ForgotPassword, ResetPassword)
// отвечает только за фон и кнопку смены темы — содержимое передаётся через children
//
// фон состоит из трёх слоёв (снизу вверх):
//   1. canvas с матричным дождём — символы кода падают колонками, 18 кадров/сек
//   2. radial-gradient оверлей — мягкий красный акцент в углах
//   3. dot-grid + SVG кривые — лёгкий геометрический паттерн
//
// матричный дождь (useMatrixRain):
//   разбивает ширину на колонки по COL_W пикселей
//   каждая колонка рисует символы из CODE_LINES посимвольно сверху вниз
//   "голова" красная, 3 символа "хвост" с затуханием
//   сбрасывается когда достигает низа + случайный шанс 6%
//
// используется: pages/Login.tsx, pages/Register.tsx,
//               pages/ForgotPassword.tsx, pages/ResetPassword.tsx
import { useEffect, useRef, type ReactNode } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "../../context/theme"

type Props = { children: ReactNode }

// моноширинный стек шрифтов для canvas-рендера символов
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

// строки кода на разных языках — источник символов для матричного дождя
// намеренно короткие фрагменты чтобы дождь выглядел "живым"
const CODE_LINES = [
  // Python
  "def quicksort(arr):", "  pivot = arr[0]", "  return left + [pivot] + right",
  "import hashlib", "h.update(b'secret')", "def gcd(a, b):",
  "  while b:", "    a, b = b, a % b", "  return a",
  "@cache", "def dp(i, j):", "  return min(dp(i-1,j)+1)",
  // JavaScript
  "function debounce(fn, ms) {", "  let timer;", "  clearTimeout(timer);",
  "class EventEmitter {", "  on(evt, cb) {", "  emit(evt, data) {",
  "const flatten = (arr) =>", "  arr.reduce((a, b) =>", "    a.concat(b), [])",
  // SQL
  "SELECT name, AVG(score)", "FROM exam_results", "GROUP BY name",
  "WITH ranked AS (", "  ROW_NUMBER() OVER(", "  ORDER BY salary DESC) rn",
  "SELECT * FROM ranked", "WHERE rn <= 3;",
  // Rust / Go
  "fn binary_search(a: &[i32],", "  let mid = (lo+hi)/2;",
  "func worker(ch <-chan Job) {", "  for job := range ch {",
  // Math
  "O(n log n)", "Θ(1) amort.", "∫₀¹ x² dx = 1/3", "E = mc²",
  // CSS / Infra
  ":root {", "  --gap: 1rem;", "FROM alpine:3.19", "EXPOSE 8000",
  // Multilingual
  "Hello World!", "Привет, мир!", "你好世界", "Bonjour!", "こんにちは",
]

// хук — запускает анимацию матричного дождя на переданном canvas-элементе
// @param canvasRef — ref на <canvas> элемент (должен быть absolute inset-0)
// @param isDark — если true используется тёмная цветовая схема (красный/серый)
//   если false — светлая (красный более прозрачный, хвост серо-синий)
// requestAnimationFrame → throttle до 18 FPS через разницу timestamp
// ResizeObserver не используется — вместо этого слушаем window resize
function useMatrixRain(canvasRef: React.RefObject<HTMLCanvasElement | null>, isDark: boolean) {
  // stateRef хранит позиции колонок и текущие строки — избегаем useState для перфоманса
  const stateRef = useRef<{ cols: number[]; texts: string[]; dpr: number }>({ cols: [], texts: [], dpr: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let last = 0
    const FONT = 10           // размер шрифта в пикселях
    const COL_W = FONT * 3.5  // ширина одной колонки — чем уже, тем больше колонок
    const ROW_H = FONT + 3    // высота строки с межстрочным интервалом
    const FPS = 1000 / 18     // ~55ms между кадрами = 18 fps

    // пересчитываем размеры canvas и количество колонок при ресайзе окна
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      // умножаем на dpr чтобы не было размытия на Retina-экранах
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const numCols = Math.floor(w / COL_W)
      stateRef.current = {
        // начальная позиция каждой колонки — случайная чтобы не все стартовали сверху
        cols: Array.from({ length: numCols }, () => Math.random() * h / ROW_H | 0),
        texts: Array.from({ length: numCols }, () => CODE_LINES[Math.random() * CODE_LINES.length | 0]),
        dpr,
      }
    }

    resize()
    window.addEventListener("resize", resize)

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      // throttle: пропускаем кадр если прошло меньше FPS миллисекунд
      if (now - last < FPS) return
      last = now

      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      const { cols, texts } = stateRef.current

      // полупрозрачный fill поверх предыдущего кадра — создаёт эффект "хвоста"
      // чем меньше alpha, тем длиннее хвост
      ctx.fillStyle = isDark ? "rgba(10,5,5,0.10)" : "rgba(250,245,245,0.09)"
      ctx.fillRect(0, 0, w, h)

      ctx.font = `${FONT}px ${MONO}`

      for (let i = 0; i < cols.length; i++) {
        const x = i * COL_W + 2
        const y = cols[i] * ROW_H
        const line = texts[i]
        const ci = cols[i] % line.length

        // "голова" колонки — яркий красный символ
        ctx.fillStyle = isDark ? "rgba(239,68,68,0.6)" : "rgba(220,38,38,0.45)"
        ctx.fillText(line.charAt(ci), x, y)

        // хвост из 3 символов с постепенным затуханием прозрачности
        for (let t = 1; t <= 3; t++) {
          const a = isDark ? Math.max(0.30 - t * 0.08, 0.04) : Math.max(0.25 - t * 0.07, 0.03)
          ctx.fillStyle = isDark ? `rgba(120,80,80,${a})` : `rgba(51,65,85,${a})`
          ctx.fillText(line.charAt((ci - t + line.length) % line.length), x, y - t * ROW_H)
        }

        cols[i]++
        // когда колонка ушла за нижний край — сброс с 6% вероятностью
        if (y > h && Math.random() > 0.94) {
          cols[i] = 0
          texts[i] = CODE_LINES[Math.random() * CODE_LINES.length | 0]
        }
      }
    }

    raf = requestAnimationFrame(draw)
    // очистка: отменяем анимацию и слушатель при unmount или смене isDark
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [canvasRef, isDark])
}

export default function AuthScreenShell({ children }: Props) {
  const { theme, toggleTheme } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDark = theme === "dark"

  // запускаем матричный дождь — эффект пересоздаётся при смене темы
  useMatrixRain(canvasRef, isDark)

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[var(--bg-soft)] dark:bg-[#0A0505]">

      {/* ── фоновые слои (pointer-events:none — не перехватывают клики) ── */}
      <div className="pointer-events-none absolute inset-0">

        {/* слой 1: матричный дождь на canvas — символы кода падают колонками */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* слой 2: мягкий красный градиент в углах для объёма */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 10% 15%,rgba(239,68,68,0.18),transparent 40%),radial-gradient(circle at 90% 85%,rgba(185,28,28,0.14),transparent 40%)" }}
        />
        {/* дополнительный тёмный оверлей только для dark-режима */}
        <div
          className="absolute inset-0 hidden dark:block"
          style={{ background: "radial-gradient(circle at 10% 15%,rgba(220,38,38,0.12),transparent 42%),radial-gradient(circle at 90% 85%,rgba(127,29,29,0.10),transparent 42%)" }}
        />

        {/* слой 3: dot-паттерн — мелкая сетка точек поверх canvas */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle,currentColor 1px,transparent 1px)", backgroundSize: "24px 24px" }}
        />

        {/* слой 4: две SVG кривых — еле заметные декоративные линии */}
        <svg className="absolute inset-0 h-full w-full opacity-5 dark:opacity-[0.07]" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 165 C180 120,290 285,470 238 C680 185,790 88,1200 205" fill="none" stroke="rgba(185,28,28,0.5)" strokeWidth="1.2" />
          <path d="M0 540 C180 620,360 450,560 525 C760 598,930 445,1200 548" fill="none" stroke="rgba(185,28,28,0.4)" strokeWidth="1.2" />
        </svg>
      </div>

      {/* ── кнопка смены темы — общая для всех экранов авторизации ── */}
      {/* вынесена сюда чтобы не дублировать на каждой странице */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 md:right-6 md:top-6 z-20 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 px-3 py-2 text-xs font-semibold text-[var(--text)] shadow-sm backdrop-blur-sm hover:bg-[var(--border)]/30 transition-colors"
        aria-label="Сменить тему"
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      </button>

      {/* ── содержимое страницы (форма входа / регистрации / сброса пароля) ── */}
      {children}
    </div>
  )
}
