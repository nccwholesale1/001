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
      CUSTOMER_ACCOUNT_ADAPTER: 'fixture',
    },
  }))
  return import('./index')
}

async function loadFactoryWithCustomerAccountEnv(customerAccountAdapter: 'fixture' | 'live') {
  vi.resetModules()
  vi.doMock('../../env', () => ({
    env: {
      DATABASE_FILE: './local.db',
      SESSION_SECRET: 'x'.repeat(32),
      NODE_ENV: 'test',
      CATALOGUE_ADAPTER: 'fixture',
      SHOPIFY_API_VERSION: '2026-07',
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: 'test-client-id',
      CUSTOMER_ACCOUNT_ADAPTER: customerAccountAdapter,
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

describe('getCustomerAccountAdapter', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.doUnmock('../../env')
  })

  it('returns the fixture adapter by default — its login() never calls out to Shopify', async () => {
    const { getCustomerAccountAdapter } = await loadFactoryWithCustomerAccountEnv('fixture')
    const fetchMock = vi.fn()
    global.fetch = fetchMock

    const adapter = getCustomerAccountAdapter()
    const { url } = await adapter.login('https://app.example.com/auth-callback')

    expect(url).toContain('/dev/fixture-shopify-login')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the real adapter when CUSTOMER_ACCOUNT_ADAPTER=live — its login() discovers real Shopify endpoints', async () => {
    const { getCustomerAccountAdapter } = await loadFactoryWithCustomerAccountEnv('live')
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          authorization_endpoint: 'https://shopify.com/authentication/1/oauth/authorize',
          token_endpoint: 'https://shopify.com/authentication/1/oauth/token',
        }),
        { status: 200 },
      ),
    )

    const adapter = getCustomerAccountAdapter()
    const { url } = await adapter.login('https://app.example.com/auth-callback')

    expect(url).toContain('shopify.com/authentication/1/oauth/authorize')
  })
})
