import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

export interface CategoryRailItem {
  slug: string
  title: string
}

export interface CategoryRailProps {
  categories: CategoryRailItem[]
}

const SCROLL_STEP_RATIO = 0.8

/**
 * Horizontal category rail. The native scrollbar is hidden (`scrollbar-none`)
 * and replaced with arrow buttons, which only appear when there is actually
 * something to scroll to in that direction — so on a wide screen showing every
 * category, no controls render at all.
 *
 * Scrolling itself is never taken away: wheel, trackpad, touch and keyboard
 * (the links are ordinary tabbable anchors) all still work, and the arrows are
 * `aria-hidden` because they duplicate navigation that is already reachable.
 */
export function CategoryRail({ categories }: CategoryRailProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const syncArrows = useCallback(() => {
    const rail = railRef.current
    if (!rail) return
    // 1px tolerance: sub-pixel layout can leave scrollLeft a fraction short of
    // its true maximum, which would otherwise strand the right arrow visible.
    setCanScrollLeft(rail.scrollLeft > 1)
    setCanScrollRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    syncArrows()
    rail.addEventListener('scroll', syncArrows, { passive: true })
    const observer = new ResizeObserver(syncArrows)
    observer.observe(rail)
    return () => {
      rail.removeEventListener('scroll', syncArrows)
      observer.disconnect()
    }
  }, [syncArrows, categories.length])

  function scrollBy(direction: -1 | 1) {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * rail.clientWidth * SCROLL_STEP_RATIO, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={railRef}
        className="scrollbar-none flex gap-1 overflow-x-auto scroll-smooth py-2"
      >
        <nav aria-label="Categories" className="flex gap-1">
          {categories.map((category) => (
            <a
              key={category.slug}
              href={`/category/${category.slug}`}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-sky-soft hover:text-primary"
            >
              {category.title}
            </a>
          ))}
        </nav>
      </div>

      {(['left', 'right'] as const).map((side) => {
        const active = side === 'left' ? canScrollLeft : canScrollRight
        if (!active) return null
        return (
          <div
            key={side}
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-y-0 flex items-center',
              side === 'left' ? 'left-0 pr-6' : 'right-0 pl-6',
            )}
          >
            <div
              className={cn(
                'absolute inset-y-0 w-16 from-background to-transparent',
                side === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l',
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => scrollBy(side === 'left' ? -1 : 1)}
              className="pointer-events-auto relative flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-foreground/70 shadow-sm transition-colors hover:bg-secondary hover:text-primary"
            >
              <Icon icon={side === 'left' ? ChevronLeft : ChevronRight} size="sm" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
