export const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export const scaleHover = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.97 },
}

export const smooth = {
  transition: { duration: 0.25 },
}