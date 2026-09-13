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

/** For flows that issue more than one request (e.g. getProduct's handle-scan then handle-fetch) — resolves each call in order. */
function mockFetchSequence(bodies: unknown[]) {
  const fetchMock = vi.fn()
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }))
  }
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
          allProducts: { edges: [{ node: { id: '1' } }, { node: { id: '2' } }] },
        },
      },
    })

    const result = await adapter.getCollection('chargers', { first: 10 })

    expect(result.title).toBe('Chargers')
    expect(result.lineCount).toBe(2)
    expect(result.products).toEqual([
      {
        sku: 'NCC-CHG-001',
        variantId: 'gid://shopify/ProductVariant/1',
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

  it('excludes Shopify\'s built-in Availability and Price filter groups, keeping real attribute facets', async () => {
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
              {
                id: 'filter.v.availability',
                label: 'Availability',
                values: [
                  { id: 'filter.v.availability.1', label: 'In stock', count: 10 },
                  { id: 'filter.v.availability.0', label: 'Out of stock', count: 0 },
                ],
              },
              {
                id: 'filter.v.price',
                label: 'Price',
                values: [{ id: 'filter.v.price', label: 'Price', count: 0 }],
              },
              { id: 'f1', label: 'Brand', values: [{ id: 'v1', label: 'Anker', count: 3 }] },
            ],
          },
          allProducts: { edges: [{ node: { id: '1' } }] },
        },
      },
    })

    const result = await adapter.getCollection('chargers', { first: 10 })

    expect(result.availableFacets).toEqual([{ attribute: 'Brand', value: 'Anker', count: 3 }])
  })

  it('listCollections maps handle/title/description and counts real products', async () => {
    const adapter = await loadAdapterWithEnv({})
    mockFetchOnce({
      data: {
        collections: {
          edges: [
            {
              node: {
                handle: 'chargers',
                title: 'Chargers',
                description: 'All chargers',
                image: {
                  url: 'https://cdn.shopify.com/collection.jpg',
                  altText: null,
                  width: 400,
                  height: 400,
                },
                products: { edges: [{ node: { id: '1' } }, { node: { id: '2' } }] },
              },
            },
          ],
        },
      },
    })

    const collections = await adapter.listCollections()

    expect(collections).toEqual([
      {
        slug: 'chargers',
        title: 'Chargers',
        description: 'All chargers',
        lineCount: 2,
        thumbnail: {
          url: 'https://cdn.shopify.com/collection.jpg',
          altText: 'Chargers',
          width: 400,
          height: 400,
        },
      },
    ])
  })

  it('search maps the real totalCount rather than the current page length', async () => {
    const adapter = await loadAdapterWithEnv({})
    mockFetchOnce({
      data: {
        search: {
          edges: [{ node: PRODUCT_NODE }],
          pageInfo: { hasNextPage: true, endCursor: 'abc' },
          productFilters: [],
          totalCount: 47,
        },
      },
    })

    const result = await adapter.search('charger', { first: 1 })

    expect(result.products).toHaveLength(1)
    expect(result.totalCount).toBe(47)
  })

  it('getProduct returns null when no product in the catalogue has that SKU', async () => {
    const adapter = await loadAdapterWithEnv({})
    // getProduct no longer trusts Shopify's `sku:` search filter (verified
    // unreliable against the real store — see storefront-adapter.ts's doc
    // comment); it scans the catalogue for the matching variant SKU first.
    mockFetchOnce({
      data: { products: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    })

    expect(await adapter.getProduct('NOT-A-REAL-SKU')).toBeNull()
  })

  it('getProduct scans the catalogue for the matching variant, then fetches that product by handle', async () => {
    const adapter = await loadAdapterWithEnv({})
    const fetchMock = mockFetchSequence([
      {
        data: {
          products: {
            edges: [
              {
                node: {
                  handle: 'fast-charger',
                  variants: {
                    edges: [
                      { node: { sku: 'NCC-CHG-001' } },
                      { node: { sku: 'NCC-CHG-002' } },
                    ],
                  },
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
      {
        data: {
          productByHandle: {
            ...PRODUCT_NODE,
            descriptionHtml: '<p>Fast charging</p>',
            options: [{ name: 'Colour', values: ['Black'] }],
            images: { edges: [] },
            // The real query aliases this to `allVariants` specifically to
            // avoid conflicting with PRODUCT_SUMMARY_FIELDS's own
            // `variants(first: 1)` — asserting against `allVariants` here
            // (not `variants`) is what would have caught the real
            // "argument conflict" GraphQL error found this session.
            allVariants: {
              edges: [
                { node: { id: 'gid://shopify/ProductVariant/1', sku: 'NCC-CHG-001' } },
                { node: { id: 'gid://shopify/ProductVariant/2', sku: 'NCC-CHG-002' } },
              ],
            },
          },
        },
      },
    ])

    const product = await adapter.getProduct('NCC-CHG-002')

    expect(product?.variantId).toBe('gid://shopify/ProductVariant/2')
    expect(product?.sku).toBe('NCC-CHG-002')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('getProduct returns null if the matched handle no longer resolves', async () => {
    const adapter = await loadAdapterWithEnv({})
    mockFetchSequence([
      {
        data: {
          products: {
            edges: [{ node: { handle: 'gone', variants: { edges: [{ node: { sku: 'NCC-CHG-001' } }] } } }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
      { data: { productByHandle: null } },
    ])

    expect(await adapter.getProduct('NCC-CHG-001')).toBeNull()
  })

  it('never requests inventory/stock fields (CLAUDE.md rule 10)', async () => {
    const adapter = await loadAdapterWithEnv({})
    const fetchMock = mockFetchOnce({
      data: {
        collectionByHandle: {
          title: '',
          description: '',
          products: { edges: [], pageInfo: { hasNextPage: false, endCursor: null }, filters: [] },
          allProducts: { edges: [] },
        },
      },
    })

    await adapter.getCollection('chargers', { first: 10 })

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    const sentQuery = String(requestInit.body)
    expect(sentQuery).not.toMatch(/quantityAvailable|availableForSale|inventoryQuantity/)
  })
})
