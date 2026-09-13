import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CollectionSummary } from '../../server/integrations/shopify/types'
import { CategoryCard } from './CategoryCard'
import { Icon } from './Icon'
import { ResponsiveGrid } from './Layout'
import { Reveal } from './Reveal'

export interface CategoryGridProps {
  categories: CollectionSummary[]
  /** Homepage's "Shop By Category" wants the search box; a full /categories index may not. */
  searchable?: boolean
}

/** Design system §5.2 "CategoryGrid — searchable/filterable image tiles with line counts." */
export function CategoryGrid({ categories, searchable = true }: CategoryGridProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return categories
    const lowerQuery = query.toLowerCase()
    return categories.filter((category) => category.title.toLowerCase().includes(lowerQuery))
  }, [categories, query])

  return (
    <div className="flex flex-col gap-6">
      {searchable ? (
        <label className="relative block max-w-sm">
          <span className="sr-only">Search categories</span>
          <Icon
            icon={Search}
            size="sm"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories…"
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories found.</p>
      ) : (
        <ResponsiveGrid className="lg:grid-cols-5">
          {filtered.map((category, index) => (
            <Reveal key={category.slug} delayMs={(index % 5) * 70}>
              <CategoryCard category={category} />
            </Reveal>
          ))}
        </ResponsiveGrid>
      )}
    </div>
  )
}
