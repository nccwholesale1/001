import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ProductSummary } from '../../server/integrations/shopify/types'
import { ProductCard } from './ProductCard'
import { addBasketLine } from '../../server/basket/server-functions'

vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => ({ invalidate: vi.fn() }) }))
vi.mock('../../server/basket/server-functions', () => ({ addBasketLine: vi.fn() }))

const PRODUCT: ProductSummary = {
  sku: 'NCC-CHG-001',
  variantId: 'gid://shopify/ProductVariant/1',
  title: '20W USB-C Fast Charger',
  collectionHandle: 'chargers',
  collectionTitle: 'Chargers',
  price: { amountPence: 1299, currencyCode: 'GBP' },
  thumbnail: { url: '', altText: '20W USB-C Fast Charger', width: 400, height: 400 },
}

describe('ProductCard', () => {
  it('renders real price and SKU, with no VAT label and no stock claim', () => {
    render(<ProductCard product={PRODUCT} />)
    expect(screen.getByText('£12.99')).toBeInTheDocument()
    expect(screen.getByText('SKU NCC-CHG-001')).toBeInTheDocument()
    expect(screen.getByText(/available to order/i)).toBeInTheDocument()
    expect(screen.queryByText(/in stock|left in stock/i)).not.toBeInTheDocument()
  })

  it('adds one real unit to the basket and shows a confirm state, never faking success before the call resolves', async () => {
    vi.mocked(addBasketLine).mockResolvedValueOnce({
      id: 'basket_1',
      status: 'open',
      lines: [],
      subtotalPence: 0,
    })
    const user = userEvent.setup()
    render(<ProductCard product={PRODUCT} />)

    await user.click(screen.getByRole('button', { name: /add.*to basket/i }))

    expect(addBasketLine).toHaveBeenCalledWith({ data: { sku: 'NCC-CHG-001', quantity: 1 } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /added to basket/i })).toBeInTheDocument(),
    )
  })

  it('shows a retry state rather than a silent failure when the add fails', async () => {
    vi.mocked(addBasketLine).mockRejectedValueOnce(new Error('network error'))
    const user = userEvent.setup()
    render(<ProductCard product={PRODUCT} />)

    await user.click(screen.getByRole('button', { name: /add.*to basket/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument(),
    )
  })
})
