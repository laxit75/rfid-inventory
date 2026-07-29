import { motion } from 'framer-motion'

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2
    }
  }
}

/**
 * Wraps page content with Framer Motion fade/slide animation.
 * Inspired by the MSIL production system's animation patterns.
 *
 * Usage:
 *   <AnimatedPage>
 *     <Dashboard />
 *   </AnimatedPage>
 */
export default function AnimatedPage({ children, className = '', ...props }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}
