import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProductCard } from './ProductCard'
import type { ProductSummary } from '../../server/integrations/shopify/types'

const PRODUCT: ProductSummary = {
  sku: 'NCC-CHG-001',
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

  it('renders the Add-to-basket control as inert rather than faking a success state', () => {
    render(<ProductCard product={PRODUCT} />)
    expect(screen.getByRole('button', { name: /coming soon/i })).toBeDisabled()
  })
})
