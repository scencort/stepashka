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
        p-7
        rounded-[24px]
        glass-panel
        hover:shadow-xl dark:hover:shadow-zinc-900/50
        transition-all duration-500
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}

