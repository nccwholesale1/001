import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogueAdapter } from './types'

async function loadAdapterWithEnv(
  envOverrides: Record<string, string | undefined>,
): Promise<CatalogueAdapter> {
  vi.resetModules()
  vi.doMock('../../env', () => ({
    env: {
      DATABASE_FILE: './local.db',
      SESSION_SECRET: 'x'.repeat(32),
      NODE_ENV: 'test',
      CATALOGUE_ADAPTER: 'live',
      SHOPIFY_API_VERSION: '2026-07',
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'test-storefront-token',
      SHOPIFY_ADMIN_ACCESS_TOKEN: undefined,
      ...envOverrides,
    },
  }))
  const { createStorefrontCatalogueAdapter } = await import('./storefront-adapter')
  return createStorefrontCatalogueAdapter()
}

function mockFetchOnce(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  global.fetch = fetchMock
  return fetchMock
}

const PRODUCT_NODE = {
  title: '20W USB-C Fast Charger',
  featuredImage: {
    url: 'https://cdn.shopify.com/img.jpg',
    altText: 'Charger',
    width: 800,
    height: 800,
  },
  priceRange: { minVariantPrice: { amount: '12.99', currencyCode: 'GBP' } },
  collections: { edges: [{ node: { handle: 'chargers', title: 'Chargers' } }] },
  variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/1', sku: 'NCC-CHG-001' } }] },
}

describe('storefront catalogue adapter (contract only, mocked fetch)', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.doUnmock('../../env')
  })

  it('getCollection maps a real response shape into CollectionResult', async () => {
    const adapter = await loadAdapterWithEnv({})
    mockFetchOnce({
      data: {
        collectionByHandle: {
          title: 'Chargers',
          description: 'All chargers',
          products: {
            edges: [{ node: PRODUCT_NODE }],
            pageInfo: { hasNextPage: false, endCursor: 'abc' },
            filters: [
              { id: 'f1', label: 'Brand', values: [{ id: 'v1', label: 'Anker', count: 3 }] },
            ],
          },
        },
      },
    })

    const result = await adapter.getCollection('chargers', { first: 10 })

    expect(result.title).toBe('Chargers')
    expect(result.products).toEqual([
      {
        sku: 'NCC-CHG-001',
        title: '20W USB-C Fast Charger',
        collectionHandle: 'chargers',
        collectionTitle: 'Chargers',
        price: { amountPence: 1299, currencyCode: 'GBP' },
        thumbnail: {
          url: 'https://cdn.shopify.com/img.jpg',
          altText: 'Charger',
          width: 800,
          height: 800,
        },
      },
    ])
    expect(result.availableFacets).toEqual([{ attribute: 'Brand', value: 'Anker', count: 3 }])
  })

  it('getProduct returns null when no product matches the SKU', async () => {
    const adapter = await loadAdapterWithEnv({})
    mockFetchOnce({ data: { products: { edges: [] } } })

    expect(await adapter.getProduct('NOT-A-REAL-SKU')).toBeNull()
  })

  it('getProduct picks the exact variant matching the requested SKU', async () => {
    const adapter = await loadAdapterWithEnv({})
    mockFetchOnce({
      data: {
        products: {
          edges: [
            {
              node: {
                ...PRODUCT_NODE,
                descriptionHtml: '<p>Fast charging</p>',
                options: [{ name: 'Colour', values: ['Black'] }],
                images: { edges: [] },
                variants: {
                  edges: [
                    { node: { id: 'gid://shopify/ProductVariant/1', sku: 'NCC-CHG-001' } },
                    { node: { id: 'gid://shopify/ProductVariant/2', sku: 'NCC-CHG-002' } },
                  ],
                },
              },
            },
          ],
        },
      },
    })

    const product = await adapter.getProduct('NCC-CHG-002')

    expect(product?.variantId).toBe('gid://shopify/ProductVariant/2')
    expect(product?.sku).toBe('NCC-CHG-002')
  })

  it('never requests inventory/stock fields (CLAUDE.md rule 10)', async () => {
    const adapter = await loadAdapterWithEnv({})
    const fetchMock = mockFetchOnce({
      data: {
        collectionByHandle: {
          title: '',
          description: '',
          products: { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, filters: [] },
        },
      },
    })

    await adapter.getCollection('chargers', { first: 10 })

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sentQuery = String(requestInit.body)
    expect(sentQuery).not.toMatch(/quantityAvailable|availableForSale|inventoryQuantity/)
  })
})
