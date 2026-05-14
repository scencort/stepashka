// переиспользуемая кнопка с тремя вариантами оформления
// используется в: AiReview.tsx, Task.tsx, CourseEditor.tsx, AccountSettings.tsx
// и везде где нужна кнопка стандартного размера с иконкой или без
//
// варианты:
//   primary — основная кнопка с градиентом (--btn-grad-from → --btn-grad-to из CSS-переменных)
//             переменные объявлены в index.css, меняются вместе с темой
//   outline — кнопка с рамкой и прозрачным фоном, для второстепенных действий рядом с primary
//   ghost   — без рамки и фона, для иконок-кнопок и действий в тулбаре
//
// props:
//   children — содержимое кнопки (текст, иконка, или оба через gap)
//   variant  — "primary" | "outline" | "ghost", по умолчанию "primary"
//   className — дополнительные классы (например px-7 py-4 для большой кнопки)
//   onClick   — обработчик клика, может быть async (возвращает Promise)
//   disabled  — блокирует кнопку: opacity 50% + cursor-not-allowed + pointer-events-none
//   type      — "button" | "submit" | "reset", по умолчанию "button"
//               важно: без type="submit" кнопка не сабмитит форму
type Props = {
  children: React.ReactNode
  variant?: "primary" | "outline" | "ghost"
  className?: string
  onClick?: () => void | Promise<void>
  disabled?: boolean
  type?: "button" | "submit" | "reset"
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: Props) {
  // базовые классы общие для всех вариантов:
  // inline-flex + gap-2 чтобы иконка и текст шли рядом с одинаковым отступом
  // transition-all duration-200 — плавный переход hover/active состояний
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-5 py-2.5 transition-all duration-200 text-sm"

  // стили для каждого варианта
  // btn-gradient и btn-primary/btn-ghost/btn-secondary определены в index.css
  const variants = {
    // btn-gradient: background-image из CSS-переменных градиента, box-shadow, filter hover
    // hover:-translate-y-px — анимация подъёма кнопки при наведении (1px вверх)
    primary: "btn-gradient hover:-translate-y-px active:translate-y-0",
    // рамка через border, прозрачный фон, меняется на --surface при hover
    outline: "bg-transparent border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
    // полностью прозрачная, только hover-подсветка
    ghost: "bg-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      // pointer-events-none при disabled — убирает hover-эффекты полностью
      className={`${base} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""} ${className}`}
    >
      {children}
    </button>
  )
}
