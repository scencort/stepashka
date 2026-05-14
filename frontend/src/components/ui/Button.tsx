// универсальная кнопка с тремя вариантами оформления
// primary — основная кнопка с градиентом
// outline — кнопка с рамкой
// ghost — прозрачная кнопка для второстепенных действий
type Props = {
  children: React.ReactNode;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
  type = "button",
}: Props) {
  // базовые стили общие для всех вариантов
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl px-5 py-2.5 transition-all duration-200 text-sm";

  // стили для каждого варианта — через CSS-переменные темы
  const variants = {
    primary: "btn-gradient hover:-translate-y-px active:translate-y-0",
    outline: "bg-transparent border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
    ghost: "bg-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      // при disabled убираем pointer-events чтобы не было hover-эффектов
      className={`${base} ${variants[variant]} ${disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
