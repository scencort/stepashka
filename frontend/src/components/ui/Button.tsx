import { motion } from "framer-motion"
import { scaleHover, smooth } from "../../lib/animations"

type Props = {
  children: React.ReactNode
  variant?: "primary" | "outline"
  className?: string
  onClick?: () => void | Promise<void>
  disabled?: boolean
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
}: Props) {
  const base =
    "px-4 py-2 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors duration-200"

  const variants = {
    primary:
      "text-white shadow-lg shadow-red-900/25 bg-gradient-to-r from-rose-700 via-red-700 to-red-900",
    outline:
      "glass-panel hover:bg-white/80 dark:hover:bg-slate-900/70",
  }

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      {...scaleHover}
      {...smooth}
      className={`${base} ${variants[variant]} ${disabled ? "opacity-60 pointer-events-none" : ""} ${className}`}
    >
      {children}
    </motion.button>
  )
}