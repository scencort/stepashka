export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

export const scaleHover = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 },
}

export const smooth = {
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
}