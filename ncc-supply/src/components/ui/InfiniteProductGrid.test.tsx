import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InfiniteProductGrid } from './InfiniteProductGrid'
import type { ProductSummary } from '../../server/integrations/shopify/types'

function product(sku: string): ProductSummary {
  return {
    sku,
    title: `Product ${sku}`,
    collectionHandle: 'screens',
    collectionTitle: 'Screens',
    price: { amountPence: 900, currencyCode: 'GBP' },
    thumbnail: { url: `https://example.test/${sku}.jpg`, altText: `Product ${sku}`, width: 400, height: 400 },
    variantId: `gid://shopify/ProductVariant/${sku}`,
  }
}

const PAGE_ONE = [product('A1'), product('A2')]

describe('InfiniteProductGrid', () => {
  it('renders the first page and offers a way to load the next', () => {
    render(
      <InfiniteProductGrid
        initialProducts={PAGE_ONE}
        initialPageInfo={{ hasNextPage: true, endCursor: 'cursor-1' }}
        loadMore={vi.fn()}
      />,
    )

    expect(screen.getByText('Product A1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /load more products/i })).toBeInTheDocument()
  })

  /**
   * The observer cannot fire in jsdom, so this exercises the button — which
   * is the accessible path anyway, and calls the same loader the observer
   * does.
   */
  it('appends the next page without dropping the first', async () => {
    const loadMore = vi.fn().mockResolvedValue({
      products: [product('B1'), product('B2')],
      pageInfo: { hasNextPage: false, endCursor: null },
    })
    render(
      <InfiniteProductGrid
        initialProducts={PAGE_ONE}
        initialPageInfo={{ hasNextPage: true, endCursor: 'cursor-1' }}
        loadMore={loadMore}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /load more products/i }))

    await waitFor(() => expect(screen.getByText('Product B1')).toBeInTheDocument())
    expect(screen.getByText('Product A1')).toBeInTheDocument()
    expect(loadMore).toHaveBeenCalledWith('cursor-1')
  })

  it('never renders the same product twice when pages overlap', async () => {
    // Cursors can overlap if the catalogue changes between requests; a
    // repeated product would duplicate a React key and a visible card.
    const loadMore = vi.fn().mockResolvedValue({
      products: [product('A2'), product('B1')],
      pageInfo: { hasNextPage: false, endCursor: null },
    })
    render(
      <InfiniteProductGrid
        initialProducts={PAGE_ONE}
        initialPageInfo={{ hasNextPage: true, endCursor: 'cursor-1' }}
        loadMore={loadMore}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /load more products/i }))

    await waitFor(() => expect(screen.getByText('Product B1')).toBeInTheDocument())
    expect(screen.getAllByText('Product A2')).toHaveLength(1)
  })

  it('says the category is exhausted instead of leaving a dead button', () => {
    render(
      <InfiniteProductGrid
        initialProducts={PAGE_ONE}
        initialPageInfo={{ hasNextPage: false, endCursor: null }}
        loadMore={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument()
    expect(screen.getByText(/that's everything in this category/i)).toBeInTheDocument()
  })

  it('offers a retry when a page fails, rather than silently stopping', async () => {
    const loadMore = vi.fn().mockRejectedValue(new Error('network'))
    render(
      <InfiniteProductGrid
        initialProducts={PAGE_ONE}
        initialPageInfo={{ hasNextPage: true, endCursor: 'cursor-1' }}
        loadMore={loadMore}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /load more products/i }))

    await waitFor(() =>
      expect(screen.getByText(/could not load more products/i)).toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
