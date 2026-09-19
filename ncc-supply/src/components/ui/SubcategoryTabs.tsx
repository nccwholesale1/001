import type { Subcategory } from '../../lib/subcategories'
import { cn } from '../../lib/cn'

interface SubcategoryTabsProps {
  subcategories: readonly Subcategory[]
  /** The selected `sub` value, or null for "All". */
  active: string | null
  /** Builds the href for a tab; null means the All tab. */
  hrefFor: (sub: string | null) => string
}

/**
 * Tabs dividing one category, rendered as links rather than buttons so each
 * division has its own shareable URL, works with browser back, and is
 * reachable without JavaScript.
 *
 * "All" leads the list deliberately. The three tags cover every Screens
 * product today, but a product added without one of them would be invisible
 * behind tabs alone — All means a mis-tagged line is still findable rather
 * than silently dropped from the catalogue.
 */
export function SubcategoryTabs({ subcategories, active, hrefFor }: SubcategoryTabsProps) {
  if (subcategories.length === 0) return null

  const tabs: Array<{ key: string; label: string; sub: string | null }> = [
    { key: 'all', label: 'All', sub: null },
    ...subcategories.map((entry) => ({ key: entry.slug, label: entry.label, sub: entry.slug })),
  ]

  return (
    <nav aria-label="Subcategories" className="border-b border-border">
      <ul className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.sub === active
          return (
            <li key={tab.key} className="shrink-0">
              <a
                href={hrefFor(tab.sub)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium no-underline transition-colors hover:no-underline',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {tab.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
