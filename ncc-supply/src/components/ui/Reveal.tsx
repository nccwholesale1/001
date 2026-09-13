import { useEffect, useRef, type ReactNode } from 'react'

export interface RevealProps {
  children: ReactNode
  className?: string
  /** Stagger children in a grid/list — pass `index * 80` or similar from the caller. */
  delayMs?: number
}

/**
 * Progressive-enhancement scroll reveal. Deliberately imperative (direct
 * DOM attribute writes via the ref, no React state) rather than
 * state+effect: the server-rendered/pre-hydration DOM never carries a
 * "hidden" attribute at all, so a no-JS visitor always sees full content —
 * only the effect below ever adds `data-reveal`/`data-state="hidden"`, right
 * before immediately watching for the element to enter the viewport and
 * flipping it to "visible" (see the `[data-reveal]` rules in styles.css).
 * Fires once; it never re-hides on scroll-away.
 */
export function Reveal({ children, className, delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Real graceful degradation, not just a test-environment workaround:
    // an old browser without IntersectionObserver support gets the same
    // "just show it" fallback as reduced-motion, rather than a crash.
    if (typeof IntersectionObserver === 'undefined') return

    node.dataset.reveal = ''
    node.dataset.state = 'hidden'
    if (delayMs) node.style.transitionDelay = `${delayMs}ms`

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.dataset.state = 'visible'
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [delayMs])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
