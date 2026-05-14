// страница 404 — показывается при переходе на несуществующий маршрут
// используется в: router/index.tsx → <Route path="*" element={<NotFound />} />
//
// визуал: большая цифра 404 с gradient-text + статичные CSS blur-глоу
// (без canvas-анимаций — они избыточны для страницы ошибки)
// кнопки: "На главную" (btn-primary) и "Назад" (btn-ghost)
import { useNavigate } from "react-router-dom"
import { Home, ArrowLeft } from "lucide-react"
import BrandLogo from "../components/BrandLogo"

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-[var(--bg)] overflow-hidden flex flex-col items-center justify-center px-4">

      {/* статичный фон: два размытых круга дают ощущение глубины */}
      {/* blur-[160px] создаёт мягкое свечение без анимации — дёшево для браузера */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-primary/3 rounded-full blur-[120px] pointer-events-none" />

      {/* ── основной контент ── */}
      <div className="relative z-10 text-center max-w-lg">

        {/* логотип Gradus вверху */}
        <div className="flex justify-center mb-10">
          <BrandLogo
            showText
            iconClassName="h-10 w-10"
            textClassName="text-2xl font-bold font-display text-[var(--text)]"
          />
        </div>

        {/* цифра 404 — gradient-text через bg-clip-text trick:
            устанавливаем градиентный background, clip по тексту,
            делаем сам цвет прозрачным → видно градиент сквозь буквы */}
        <div className="relative mb-6">
          <span className="text-[6rem] sm:text-[10rem] md:text-[12rem] font-display font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-primary via-primary/80 to-primary/20 select-none">
            404
          </span>
          {/* дополнительный blur-круг за цифрой для свечения */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
          </div>
        </div>

        {/* заголовок и описание */}
        <h1 className="font-display font-bold text-2xl md:text-3xl text-[var(--text)] mb-3 tracking-tight">
          Страница не найдена
        </h1>
        <p className="text-[var(--muted)] text-base md:text-lg leading-relaxed mb-10 max-w-md mx-auto">
          Похоже, эта страница была удалена, перемещена или никогда не существовала.
        </p>

        {/* кнопки навигации */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* btn-primary — единый стиль из index.css: градиент from --btn-grad-from to --btn-grad-to */}
          <button
            onClick={() => navigate("/")}
            className="btn-primary px-7 py-3.5 text-sm"
          >
            <Home size={16} />
            На главную
          </button>
          {/* btn-ghost — прозрачная кнопка с рамкой для второстепенного действия */}
          <button
            onClick={() => navigate(-1)}
            className="btn-ghost px-7 py-3.5 text-sm"
          >
            <ArrowLeft size={16} />
            Назад
          </button>
        </div>
      </div>

      {/* декоративная линия-разделитель снизу страницы */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  )
}

export default NotFound
