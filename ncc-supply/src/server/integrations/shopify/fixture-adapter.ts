import type {
  CatalogueAdapter,
  CollectionResult,
  FacetOpts,
  PaginationOpts,
  ProductDetail,
  ProductSummary,
  SearchResult,
  TypeaheadResult,
} from './types'

/**
 * Dev-only fixture implementation of CatalogueAdapter (CLAUDE.md rule 20).
 * Every SKU/title/price below is obviously fake placeholder data — never
 * real inventory — for local development and contract tests before Phase 3
 * wires up the real Shopify Storefront API adapter.
 */

const FIXTURE_PRODUCTS: ProductDetail[] = [
  {
    sku: 'FIXTURE-CHG-001',
    title: '[Fixture] 20W USB-C Fast Charger',
    collectionHandle: 'chargers',
    collectionTitle: 'Chargers',
    price: { amountPence: 1299, currencyCode: 'GBP' },
    thumbnail: {
      url: 'https://placehold.co/400x400',
      altText: 'Fixture charger',
      width: 400,
      height: 400,
    },
    description: 'Fixture product for local development only — not real inventory.',
    images: [
      { url: 'https://placehold.co/800x800', altText: 'Fixture charger', width: 800, height: 800 },
    ],
    specs: [{ label: 'Output', value: '20W' }],
    variantId: 'gid://shopify/ProductVariant/fixture-1',
  },
  {
    sku: 'FIXTURE-SCR-001',
    title: '[Fixture] Tempered Glass Screen Protector',
    collectionHandle: 'screen-protectors',
    collectionTitle: 'Screen Protectors',
    price: { amountPence: 499, currencyCode: 'GBP' },
    thumbnail: {
      url: 'https://placehold.co/400x400',
      altText: 'Fixture screen protector',
      width: 400,
      height: 400,
    },
    description: 'Fixture product for local development only — not real inventory.',
    images: [
      {
        url: 'https://placehold.co/800x800',
        altText: 'Fixture screen protector',
        width: 800,
        height: 800,
      },
    ],
    specs: [{ label: 'Hardness', value: '9H' }],
    variantId: 'gid://shopify/ProductVariant/fixture-2',
  },
]

function toSummary(product: ProductDetail): ProductSummary {
  const { sku, title, collectionHandle, collectionTitle, price, thumbnail } = product
  return { sku, title, collectionHandle, collectionTitle, price, thumbnail }
}

function paginate<T>(items: T[], { page, perPage }: PaginationOpts): T[] {
  const start = (page - 1) * perPage
  return items.slice(start, start + perPage)
}

export function createFixtureCatalogueAdapter(): CatalogueAdapter {
  return {
    async getCollection(slug, opts) {
      return getCollectionFixture(slug, opts)
    },
    async getProduct(sku) {
      return FIXTURE_PRODUCTS.find((product) => product.sku === sku) ?? null
    },
    async search(query, opts) {
      return searchFixture(query, opts)
    },
    async suggest(query) {
      return suggestFixture(query)
    },
  }
}

function getCollectionFixture(
  slug: string,
  opts: PaginationOpts & FacetOpts,
): Promise<CollectionResult> {
  const matches = FIXTURE_PRODUCTS.filter((product) => product.collectionHandle === slug)
  return Promise.resolve({
    slug,
    title: matches[0]?.collectionTitle ?? slug,
    description: 'Fixture collection for local development only.',
    totalCount: matches.length,
    products: paginate(matches.map(toSummary), opts),
    availableFacets: [],
  })
}

function searchFixture(query: string, opts: PaginationOpts & FacetOpts): Promise<SearchResult> {
  const lowerQuery = query.toLowerCase()
  const matches = FIXTURE_PRODUCTS.filter((product) =>
    product.title.toLowerCase().includes(lowerQuery),
  )
  return Promise.resolve({
    query,
    totalCount: matches.length,
    products: paginate(matches.map(toSummary), opts),
    availableFacets: [],
  })
}

function suggestFixture(query: string): Promise<TypeaheadResult> {
  const lowerQuery = query.toLowerCase()
  const products = FIXTURE_PRODUCTS.filter((product) =>
    product.title.toLowerCase().includes(lowerQuery),
  ).map((product) => ({ sku: product.sku, title: product.title }))
  return Promise.resolve({ products, collections: [] })
}
