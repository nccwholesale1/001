import { useEffect, useRef, useState } from 'react'

/**
 * Returns a ref to attach to the scrolling container and a translateY (px)
 * for a decorative background layer to move at `speed` of real scroll —
 * `speed` between 0 (fixed) and 1 (moves with scroll, i.e. no effect); 0.3-0.5
 * reads as a subtle depth effect without motion sickness territory. Tracked
 * via the element's own bounding rect (not window.scrollY) so it only
 * animates while the hero is actually on screen, and does nothing once it
 * scrolls away — cheaper than a page-wide scroll listener driving elements
 * far off screen. No-ops entirely under prefers-reduced-motion.
 */
export function useParallax(speed: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let ticking = false
    function update() {
      ticking = false
      if (!node) return
      const rect = node.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) return
      setOffset(rect.top * speed)
    }
    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [speed])

  return { ref, offset }
}
