import { motion } from "framer-motion";
import { scaleHover, smooth } from "../../lib/animations";

type Props = {
  children: React.ReactNode;
  variant?: "primary" | "outline";
  className?: string;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
}: Props) {
  const base =
    "px-5 py-2.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all duration-300";

  const variants = {
    primary:
      "text-white shadow-lg shadow-rose-500/25 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 hover:shadow-xl hover:shadow-rose-500/30",
    outline:
      "bg-white/40 dark:bg-zinc-900/40 border border-white/50 dark:border-white/5 shadow-sm hover:bg-white/60 dark:hover:bg-zinc-800/60 backdrop-blur-md text-slate-700 dark:text-slate-200",
  };

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
  );
}
