import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ClientOnly } from '../ClientOnly'
import { addBasketLine } from '../../server/basket/server-functions'
import type { ProductSummary } from '../../server/integrations/shopify/types'
import { Icon } from './Icon'
import { cn } from '../../lib/cn'

export interface ProductCardProps {
  product: ProductSummary
  className?: string
}

type AddStatus = 'idle' | 'adding' | 'added' | 'error'

const CONFIRM_DURATION_MS = 1400

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/**
 * Design system §7 "Product card" (media block corrected 2026-09-13 to
 * render the adapter's real `product.thumbnail` — fixture mode already
 * provides one, clearly marked as fixture-only via the product's own
 * `[Fixture]`-prefixed title per CLAUDE.md rule 20; live mode returns the
 * real Shopify product image — falling back to the gradient/mesh treatment
 * only if the image itself fails to load). Links use plain anchors, not the
 * typed RouterLink — see Header.tsx for why. The Add-to-basket control is
 * real as of Phase 6: adds the chosen quantity via the server-truth-priced
 * basket module, confirms with a check for 1.4s per the design spec. The
 * quantity input accepts any positive integer — no minimum or maximum is
 * enforced anywhere (PRD §4 rule 12).
 */
function addButtonLabel(product: ProductSummary, status: AddStatus): string {
  if (status === 'added') return `${product.title} added to basket`
  if (status === 'error') return `Could not add ${product.title} to basket — try again`
  return `Add ${product.title} to basket`
}

function AddButton({
  product,
  status,
  onClick,
}: {
  product: ProductSummary
  status: AddStatus
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === 'adding' || !onClick}
      aria-label={addButtonLabel(product, status)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
        status === 'added'
          ? 'border-primary/40 bg-secondary text-primary'
          : status === 'error'
            ? 'border-destructive/40 text-destructive'
            : 'border-border text-foreground hover:bg-secondary',
      )}
    >
      <Icon icon={status === 'added' ? Check : status === 'error' ? X : Plus} size="sm" />
      {status === 'added' ? 'Added' : status === 'error' ? 'Retry' : 'Add'}
    </button>
  )
}

function AddToBasketButton({ product, quantity }: { product: ProductSummary; quantity: number }) {
  const [status, setStatus] = useState<AddStatus>('idle')
  const addLine = useServerFn(addBasketLine)
  const router = useRouter()

  async function handleAdd() {
    setStatus('adding')
    try {
      await addLine({ data: { sku: product.sku, quantity } })
      setStatus('added')
      // Refreshes the header's basket count badge — it's loaded by the root
      // route, not this component, so it has no other way to know a line
      // was just added.
      router.invalidate()
    } catch {
      setStatus('error')
    } finally {
      setTimeout(() => setStatus('idle'), CONFIRM_DURATION_MS)
    }
  }

  return <AddButton product={product} status={status} onClick={handleAdd} />
}

export function ProductCard({ product, className }: ProductCardProps) {
  const href = `/product/${product.sku}`
  const [imageFailed, setImageFailed] = useState(false)
  // Quantity lives here rather than inside AddToBasketButton so the input
  // renders server-side too — inside ClientOnly it would pop in on hydration
  // and shift the card's footer.
  const [quantity, setQuantity] = useState(1)

  return (
    <div className={cn('surface-card rise-in flex flex-col overflow-hidden rounded-xl p-0', className)}>
      <a href={href} className="block no-underline hover:no-underline">
        {imageFailed || !product.thumbnail.url ? (
          <div
            className="sky-gradient grid-mesh flex h-40 items-center justify-center"
            role="img"
            aria-label={product.thumbnail.altText}
          />
        ) : (
          <img
            src={product.thumbnail.url}
            alt={product.thumbnail.altText}
            onError={() => setImageFailed(true)}
            className="h-40 w-full object-cover"
          />
        )}
      </a>
      <div className="flex flex-1 flex-col gap-1 p-4">
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
      <div className="flex items-end justify-between gap-2 p-4 pt-0">
        <div className="flex flex-col">
          <span className="font-display text-xl font-semibold text-foreground">
            {formatPrice(product.price.amountPence)}
          </span>
          <span className="text-xs text-muted-foreground">Available to order</span>
        </div>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Quantity for {product.title}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="w-16 rounded-lg border border-border bg-background px-2 py-2 text-center text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <ClientOnly fallback={<AddButton product={product} status="idle" />}>
          <AddToBasketButton product={product} quantity={quantity} />
        </ClientOnly>

      </div>
    </div>
  )
}
