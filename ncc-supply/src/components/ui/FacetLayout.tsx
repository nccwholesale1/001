import type { ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './Dialog'
import { FacetSidebar, type FacetSidebarProps } from './FacetSidebar'
import { Icon } from './Icon'

export interface FacetLayoutProps extends FacetSidebarProps {
  /** The results grid + pagination — rendered in the wide column next to the sidebar. */
  children: ReactNode
}

/**
 * Collection/search listing shell — PRD §5.3's exact responsive contract:
 * below `lg` (1024px) the facet sidebar is "hidden behind a Filters button
 * → full-screen sheet"; at `lg` and above it's a static sticky sidebar. The
 * same `FacetSidebar` content renders in both places (once inside the sheet,
 * once as the static aside) so every real filter/sort link still works with
 * no client JS — only the sheet's open/close chrome needs it.
 */
export function FacetLayout({ children, ...facetProps }: FacetLayoutProps) {
  const appliedCount = facetProps.appliedChips.length

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[240px_1fr] lg:items-start lg:gap-8">
      <div className="lg:hidden">
        <Dialog>
          <DialogTrigger className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Icon icon={SlidersHorizontal} size="sm" />
            Filters &amp; Sort
            {appliedCount > 0 ? (
              <span className="sky-gradient inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
                {appliedCount}
              </span>
            ) : null}
          </DialogTrigger>
          <DialogContent sheet aria-describedby="facet-sheet-description">
            <DialogTitle className="text-lg font-semibold text-foreground">Filters &amp; Sort</DialogTitle>
            <DialogDescription id="facet-sheet-description" className="sr-only">
              Filter and sort the current results. Selecting an option reloads the list.
            </DialogDescription>
            <div className="mt-4">
              <FacetSidebar {...facetProps} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <FacetSidebar {...facetProps} />
      </aside>

      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
