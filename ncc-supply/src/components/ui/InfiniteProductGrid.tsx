import { useCallback, useEffect, useRef, useState } from 'react'
import type { PageInfo, ProductSummary } from '../../server/integrations/shopify/types'
import { ProductCard } from './ProductCard'
import { Reveal } from './Reveal'
import { Button } from './Button'

interface InfiniteProductGridProps {
  /** The first page, already loaded by the route. */
  initialProducts: ProductSummary[]
  initialPageInfo: PageInfo
  /** Fetches the next page for a cursor. Resolves to null if it could not be loaded. */
  loadMore: (after: string) => Promise<{ products: ProductSummary[]; pageInfo: PageInfo } | null>
}

/**
 * Products keep loading as the buyer scrolls, instead of ending at a "Next"
 * button. Trade buyers scan long lists looking for one part; making them
 * stop and paginate every eight cards breaks that scan.
 *
 * The button is not decorative: it is the accessible path. An observer that
 * only fires on scroll leaves keyboard and screen-reader users with no way
 * to reach page two, and it never fires at all when `IntersectionObserver`
 * is unavailable. Both paths call the same loader, so the button stays
 * correct even when the observer is doing the work.
 */
export function InfiniteProductGrid({
  initialProducts,
  initialPageInfo,
  loadMore,
}: InfiniteProductGridProps) {
  const [products, setProducts] = useState(initialProducts)
  const [pageInfo, setPageInfo] = useState(initialPageInfo)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Pages accumulated for one query are stale under another, so the route
  // gives this component a `key` built from slug/sort/filters. Changing it
  // remounts with the new first page, which resets this state for free —
  // no effect needed, and no window where old pages sit under new filters.

  const handleLoadMore = useCallback(async () => {
    if (loading || !pageInfo.hasNextPage || !pageInfo.endCursor) return
    setLoading(true)
    setError(null)
    try {
      const next = await loadMore(pageInfo.endCursor)
      if (!next) {
        setError('Could not load more products.')
        return
      }
      setProducts((current) => {
        // The same product arriving twice would duplicate a React key and
        // render a duplicate card; cursors can overlap if the catalogue
        // changes between requests.
        const seen = new Set(current.map((product) => product.sku))
        return [...current, ...next.products.filter((product) => !seen.has(product.sku))]
      })
      setPageInfo(next.pageInfo)
    } catch {
      setError('Could not load more products.')
    } finally {
      setLoading(false)
    }
  }, [loading, pageInfo, loadMore])

  /**
   * Whether the sentinel is currently near the viewport — tracked as state
   * rather than starting the load from the observer callback directly.
   *
   * The sentinel sits at the end of the list and does not move when a page
   * is appended, so it emits no new intersection event. Loading straight
   * from the callback therefore broke on the production build: an event
   * arriving while a page was already in flight hit the in-flight guard and
   * was dropped, and nothing fired again — scrolling silently stopped
   * loading. Holding the state means the effect below re-runs when
   * `loading` returns to false and carries on by itself.
   */
  const [atSentinel, setAtSentinel] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => setAtSentinel(entries.some((entry) => entry.isIntersecting)),
      // Start fetching slightly before the sentinel is reached so the next
      // cards are usually in place by the time the buyer scrolls to them.
      { rootMargin: '400px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!atSentinel || loading || error || !pageInfo.hasNextPage) return
    // Scheduled rather than called straight from the effect: the load sets
    // state on its first line, and the cleanup cancels a pending start if
    // the sentinel leaves view or the query changes first.
    const timer = setTimeout(() => void handleLoadMore(), 0)
    return () => clearTimeout(timer)
  }, [atSentinel, loading, error, pageInfo.hasNextPage, handleLoadMore])

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {products.map((product, index) => (
          <Reveal key={product.sku} delayMs={(index % 6) * 70}>
            <ProductCard product={product} />
          </Reveal>
        ))}
      </div>

      {/* Announced politely so a screen reader hears that more arrived. */}
      <p aria-live="polite" className="sr-only">
        {loading ? 'Loading more products' : `Showing ${products.length} products`}
      </p>

      <div ref={sentinelRef} className="mt-8 flex flex-col items-center gap-3">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="secondary" onClick={() => void handleLoadMore()}>
              Try again
            </Button>
          </>
        ) : pageInfo.hasNextPage ? (
          <Button variant="secondary" onClick={() => void handleLoadMore()} disabled={loading}>
            {loading ? 'Loading…' : 'Load more products'}
          </Button>
        ) : products.length > 0 ? (
          <p className="text-sm text-muted-foreground">That's everything in this category.</p>
        ) : null}
      </div>
    </>
  )
}
