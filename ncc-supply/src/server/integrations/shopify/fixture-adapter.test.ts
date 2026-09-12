import { describe, expect, it } from 'vitest'
import { createFixtureCatalogueAdapter } from './fixture-adapter'

describe('fixture catalogue adapter', () => {
  const adapter = createFixtureCatalogueAdapter()

  it('every fixture product is clearly marked as fixture data, never real inventory', async () => {
    const product = await adapter.getProduct('FIXTURE-CHG-001')
    expect(product?.title).toMatch(/^\[Fixture\]/)
  })

  it('returns null for an unknown sku rather than throwing', async () => {
    expect(await adapter.getProduct('NOT-A-REAL-SKU')).toBeNull()
  })

  it('getCollection, search, and suggest all resolve without error', async () => {
    const collection = await adapter.getCollection('chargers', { page: 1, perPage: 10 })
    expect(collection.products.length).toBeGreaterThan(0)

    const search = await adapter.search('charger', { page: 1, perPage: 10 })
    expect(search.totalCount).toBeGreaterThan(0)

    const suggestions = await adapter.suggest('screen')
    expect(suggestions.products.length).toBeGreaterThan(0)
  })
})
