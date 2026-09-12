import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadFactoryWithEnv(catalogueAdapter: 'fixture' | 'live') {
  vi.resetModules()
  vi.doMock('../../env', () => ({
    env: {
      DATABASE_FILE: './local.db',
      SESSION_SECRET: 'x'.repeat(32),
      NODE_ENV: 'test',
      CATALOGUE_ADAPTER: catalogueAdapter,
      SHOPIFY_API_VERSION: '2026-07',
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'test-token',
    },
  }))
  return import('./index')
}

describe('getCatalogueAdapter', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.doUnmock('../../env')
  })

  it('returns the fixture adapter by default (CATALOGUE_ADAPTER=fixture)', async () => {
    const { getCatalogueAdapter } = await loadFactoryWithEnv('fixture')
    const adapter = getCatalogueAdapter()

    const product = await adapter.getProduct('FIXTURE-CHG-001')
    expect(product?.title).toMatch(/^\[Fixture\]/)
  })

  it('never mixes fixture and live data: CATALOGUE_ADAPTER=live only ever calls the real Storefront endpoint', async () => {
    const { getCatalogueAdapter } = await loadFactoryWithEnv('live')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { products: { edges: [] } } }), { status: 200 }),
      )
    global.fetch = fetchMock

    const adapter = getCatalogueAdapter()
    await adapter.getProduct('ANY-SKU')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.myshopify.com/api/2026-07/graphql.json',
      expect.anything(),
    )
  })

  it('caches a repeated getProduct call against the live adapter within the TTL', async () => {
    const { getCatalogueAdapter } = await loadFactoryWithEnv('live')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { products: { edges: [] } } }), { status: 200 }),
      )
    global.fetch = fetchMock

    const adapter = getCatalogueAdapter()
    await adapter.getProduct('SAME-SKU')
    await adapter.getProduct('SAME-SKU')

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
