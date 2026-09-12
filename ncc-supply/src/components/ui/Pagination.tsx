import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Icon } from './Icon'

export interface PaginationProps {
  previousHref: string | null
  nextHref: string | null
}

/**
 * Previous/Next rather than the design system's literal "numbered
 * pagination" spec (ADR-015) — Shopify's Storefront API connections are
 * cursor-only with no total-page count or random-access jump, so a
 * numbered control would either lie about page counts or require walking
 * every prior page just to render page numbers.
 */
export function Pagination({ previousHref, nextHref }: PaginationProps) {
  if (!previousHref && !nextHref) return null

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-4">
      {previousHref ? (
        <a
          href={previousHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          <Icon icon={ChevronLeft} size="sm" />
          Previous
        </a>
      ) : (
        <span />
      )}
      {nextHref ? (
        <a
          href={nextHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          Next
          <Icon icon={ChevronRight} size="sm" />
        </a>
      ) : (
        <span />
      )}
    </nav>
  )
}
