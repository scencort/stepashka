import { motion } from "framer-motion"
import { smooth } from "../../lib/animations"

type Props = {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = "" }: Props) {
  return (
    <motion.div
      {...smooth}
      className={`
        p-5
        rounded-2xl
        glass-panel
        hover:shadow-2xl
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}