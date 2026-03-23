import { motion } from "framer-motion"
import { scaleHover, smooth } from "../../lib/animations"

type Props = {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = "" }: Props) {
  return (
    <motion.div
      {...scaleHover}
      {...smooth}
      className={`
        p-5
        bg-white dark:bg-gray-950
        border dark:border-gray-800
        rounded-xl
        shadow-sm
        hover:shadow-xl
        transition
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}