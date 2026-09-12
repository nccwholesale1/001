import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Banner, type BannerProps } from './Banner'

/**
 * A carousel of Banner slides — a separate component from Banner itself so
 * a single static banner and a rotating one are two distinct, independently
 * usable pieces. Whether the homepage (or anywhere else) actually uses the
 * carousel vs. a single Banner is an open design decision for a later phase;
 * this just makes the option available, fully built and tested.
 *
 * Accessible carousel pattern: role="region" + aria-roledescription, one
 * live-announced slide change, keyboard arrow support, autoplay pauses on
 * hover/focus and is skipped entirely under prefers-reduced-motion.
 */
export interface BannerCarouselProps {
  slides: Array<BannerProps>
  /** Autoplay interval in ms. Omit or 0 to disable autoplay. */
  autoplayInterval?: number
  className?: string
  label?: string
}

export function BannerCarousel({
  slides,
  autoplayInterval = 0,
  className,
  label = 'Featured',
}: BannerCarouselProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const count = slides.length

  const goTo = (next: number) => {
    setIndex(((next % count) + count) % count)
  }

  useEffect(() => {
    if (!autoplayInterval || prefersReducedMotion || paused || count <= 1) return
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count)
    }, autoplayInterval)
    return () => window.clearInterval(id)
  }, [autoplayInterval, prefersReducedMotion, paused, count])

  if (count === 0) return null

  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex --
       The WAI-ARIA APG carousel pattern makes the rotation region itself a
       focusable, arrow-key-operable widget (not just its buttons) — jsx-a11y's
       generic "non-interactive element" heuristic doesn't model composite
       widgets like this, so these are deliberately disabled for this specific,
       spec-following pattern rather than the interaction being removed. */
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      className={cn('relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') goTo(index + 1)
        if (event.key === 'ArrowLeft') goTo(index - 1)
      }}
    >
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${count}`}
        className={cn('rise-in', prefersReducedMotion && 'motion-reduce:animate-none')}
        key={index}
      >
        <Banner {...slides[index]} />
      </div>

      <span className="sr-only" aria-live="polite">
        Slide {index + 1} of {count}
      </span>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-2 text-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-2 text-foreground shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((_, slideIndex) => (
              <button
                key={slideIndex}
                type="button"
                onClick={() => goTo(slideIndex)}
                aria-label={`Go to slide ${slideIndex + 1}`}
                aria-current={slideIndex === index}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors motion-reduce:transition-none',
                  slideIndex === index ? 'bg-primary' : 'bg-border hover:bg-muted-foreground',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  const mediaRef = useRef<MediaQueryList | null>(null)

  useEffect(() => {
    mediaRef.current = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mediaRef.current.matches)
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches)
    mediaRef.current.addEventListener('change', listener)
    return () => mediaRef.current?.removeEventListener('change', listener)
  }, [])

  return reduced
}
