import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import type { CollectionSummary } from '../../server/integrations/shopify/types'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

export interface CategoryCardProps {
  category: CollectionSummary
  className?: string
}

/**
 * Design system §7 "Category card" (corrected 2026-09-13 to match the
 * reference site's actual white-card layout — see DECISIONS.md). Renders
 * `category.thumbnail` when the adapter provides one (fixture mode already
 * does, clearly marked "Fixture ... for local development only" in its own
 * description text per CLAUDE.md rule 20; live mode returns the real
 * Shopify collection image) — falling back to the gradient/mesh treatment
 * only when no thumbnail exists at all, never a fabricated photo.
 */
export function CategoryCard({ category, className }: CategoryCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(category.thumbnail?.url) && !imageFailed

  return (
    <a
      href={`/category/${category.slug}`}
      className={cn(
        'group rise-in surface-card flex flex-col overflow-hidden rounded-xl p-0 no-underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <div className="relative h-32 overflow-hidden">
        {hasImage ? (
          <img
            src={category.thumbnail!.url}
            alt=""
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="sky-gradient grid-mesh h-full w-full transition-transform duration-300 group-hover:scale-105" />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
          {category.lineCount} {category.lineCount === 1 ? 'line' : 'lines'}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="h-1 w-8 rounded-full bg-primary" aria-hidden="true" />
        <span className="text-base font-semibold text-foreground">{category.title}</span>
        {category.description ? (
          <span className="line-clamp-2 text-xs text-muted-foreground">{category.description}</span>
        ) : null}
        <span className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-primary">
          View products
          <Icon icon={ArrowRight} size="sm" className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </a>
  )
}
