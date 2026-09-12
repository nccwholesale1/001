import { Plus } from 'lucide-react'
import type { ProductSummary } from '../../server/integrations/shopify/types'
import { Icon } from './Icon'
import { cn } from '../../lib/cn'

export interface ProductCardProps {
  product: ProductSummary
  className?: string
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/**
 * Design system §7 "Product card". Links use plain anchors, not the typed
 * RouterLink — /product/:sku doesn't exist until Phase 5 (built immediately
 * after this phase in the same session). The Add-to-basket control is
 * visual chrome only for now — there's no basket yet to add to (Phase 6
 * builds it) — so it renders inert rather than faking a success state.
 */
export function ProductCard({ product, className }: ProductCardProps) {
  const href = `/product/${product.sku}`
  return (
    <div className={cn('surface-card rise-in flex flex-col rounded-xl p-4', className)}>
      <a href={href} className="rounded-lg no-underline hover:no-underline">
        <div
          className="sky-gradient grid-mesh flex h-32 items-center justify-center rounded-lg p-3"
          role="img"
          aria-label={product.thumbnail.altText}
        />
      </a>
      <div className="mt-4 flex flex-1 flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {product.collectionTitle}
        </span>
        <a
          href={href}
          className="text-base font-semibold text-foreground no-underline hover:text-primary hover:underline"
        >
          {product.title}
        </a>
        <span className="text-xs text-muted-foreground">SKU {product.sku}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-display text-xl font-semibold text-foreground">
            {formatPrice(product.price.amountPence)}
          </span>
          <span className="text-xs text-muted-foreground">ex VAT · Available to order</span>
        </div>
        <button
          type="button"
          disabled
          aria-label={`Add ${product.title} to basket — coming soon`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/60"
        >
          <Icon icon={Plus} size="sm" />
          Add
        </button>
      </div>
    </div>
  )
}
