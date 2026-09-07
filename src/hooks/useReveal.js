import { useReducedMotion } from 'framer-motion'

// Shared "fade-in + slide-up" entrance for on-scroll reveals.
//
//   initial   { opacity: 0, y: 30 }  -> start hidden, 30px lower
//   whileInView { opacity: 1, y: 0 } -> rise into place when scrolled into view
//   viewport.once   true             -> play once; never replay on scroll-up
//   viewport.margin "-50px"          -> fire ~50px before the element is fully in view
//   transition duration 0.5 + ease   -> matches the app's `ease-out` curve
//                                       (cubic-bezier(0.2, 0, 0, 1) in tailwind.config.js)
const EASE_OUT = [0.2, 0, 0, 1]

/**
 * Motion props for a scroll-reveal wrapper.
 * @param {number} [delay=0] seconds to offset the entrance (used for stagger)
 * @returns props to spread onto a <motion.*> element
 */
export function useReveal(delay = 0) {
  const reduceMotion = useReducedMotion()

  // Respect the OS "reduce motion" setting: render in place, no transform.
  if (reduceMotion) return { initial: false }

  return {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-50px' },
    transition: { duration: 0.5, ease: EASE_OUT, delay },
  }
}

export default useReveal
