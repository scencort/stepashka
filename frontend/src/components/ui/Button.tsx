import { motion } from "framer-motion"
import { scaleHover, smooth } from "../../lib/animations"

type Props = {
  children: React.ReactNode
  variant?: "primary" | "outline"
  className?: string
  onClick?: () => void
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
}: Props) {
  const base =
    "px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"

  const variants = {
    primary: "bg-red-600 text-white",
    outline:
      "border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800",
  }

  return (
    <motion.button
      onClick={onClick}
      {...scaleHover}
      {...smooth}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  )
}