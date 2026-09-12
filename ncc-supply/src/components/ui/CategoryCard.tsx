import type { CollectionSummary } from '../../server/integrations/shopify/types'
import { cn } from '../../lib/cn'

export interface CategoryCardProps {
  category: CollectionSummary
  className?: string
}

/**
 * Design system §7 "Category card". No category imagery exists yet, so
 * this always uses the gradient/mesh placeholder treatment rather than a
 * fabricated photo (CLAUDE.md rule 20). Plain anchor, not RouterLink —
 * /category/:slug doesn't exist until Phase 5, built immediately after
 * this phase in the same session.
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  return (
    <a
      href={`/category/${category.slug}`}
      className={cn(
        'group rise-in relative flex h-40 flex-col justify-end overflow-hidden rounded-xl no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="sky-gradient grid-mesh absolute inset-0 transition-transform duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-foreground/10 to-transparent" />
      <div className="relative flex flex-col gap-1 p-4">
        <span className="w-fit rounded-full bg-foreground/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-foreground">
          {category.lineCount} {category.lineCount === 1 ? 'line' : 'lines'}
        </span>
        <span className="text-base font-semibold text-ink-foreground">{category.title}</span>
      </div>
    </a>
  )
}
