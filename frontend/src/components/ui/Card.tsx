import { motion } from "framer-motion";
import { smooth } from "../../lib/animations";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className = "" }: Props) {
  return (
    <motion.div
      {...smooth}
      className={`
        p-6 sm:p-8
        rounded-[2rem]
        glass-panel
        hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/30 dark:hover:shadow-black/40
        transition-all duration-500 ease-out
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
