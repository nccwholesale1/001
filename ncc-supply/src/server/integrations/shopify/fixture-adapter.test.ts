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

  it('listCollections returns every fixture collection with a real line count', async () => {
    const collections = await adapter.listCollections()
    expect(collections.find((c) => c.slug === 'chargers')).toMatchObject({ lineCount: 1 })
  })

  it('getCollection, search, and suggest all resolve without error', async () => {
    const collection = await adapter.getCollection('chargers', { first: 10 })
    expect(collection.products.length).toBeGreaterThan(0)
    expect(collection.pageInfo.hasNextPage).toBe(false)

    const search = await adapter.search('charger', { first: 10 })
    expect(search.products.length).toBeGreaterThan(0)

    const suggestions = await adapter.suggest('screen')
    expect(suggestions.products.length).toBeGreaterThan(0)
  })

  it('paginates via cursor rather than page number', async () => {
    const { totalCount } = await adapter.search('fixture', { first: 1 })

    const firstPage = await adapter.search('fixture', { first: 1 })
    expect(firstPage.products).toHaveLength(1)
    expect(firstPage.pageInfo.hasNextPage).toBe(totalCount > 1)

    const secondPage = await adapter.search('fixture', {
      first: 1,
      after: firstPage.pageInfo.endCursor,
    })
    expect(secondPage.products).toHaveLength(1)
    expect(secondPage.products[0]?.sku).not.toBe(firstPage.products[0]?.sku)

    const lastPage = await adapter.search('fixture', { first: totalCount })
    expect(lastPage.pageInfo.hasNextPage).toBe(false)
    expect(lastPage.products).toHaveLength(totalCount)
  })
})
