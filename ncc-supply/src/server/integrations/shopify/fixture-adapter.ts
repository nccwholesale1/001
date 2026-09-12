import type {
  CatalogueAdapter,
  CollectionResult,
  CollectionSummary,
  FacetOpts,
  PageInfo,
  PaginationOpts,
  ProductDetail,
  ProductSummary,
  SearchResult,
  TypeaheadResult,
} from './types'

/**
 * Dev-only fixture implementation of CatalogueAdapter (CLAUDE.md rule 20).
 * Every SKU/title/price below is obviously fake placeholder data — never
 * real inventory — for local development and contract tests alongside the
 * real Shopify Storefront API adapter (./storefront-adapter.ts).
 */

/**
 * No real photography exists for fixture data, so every thumbnail/image
 * uses an empty url — `ProductCard`/`CategoryCard`/the product gallery all
 * treat that the same as "no image" and fall back to the on-brand
 * `sky-gradient grid-mesh` placeholder (design system §7's "Product banner"
 * placeholder rule, applied consistently to every image slot, not just the
 * hero) rather than a third-party placeholder-image service that renders
 * ugly literal "WIDTH × HEIGHT" text.
 */
function noImage(altText: string) {
  return { url: '', altText, width: 0, height: 0 }
}

/**
 * One fixture product per real collection in the connected Shopify store
 * (verified via the Admin API this session — see DECISIONS.md), so
 * "Shop By Category" reflects the store's actual category structure even
 * before SHOPIFY_STOREFRONT_ACCESS_TOKEN is configured. Names/prices/specs
 * below are still entirely fixture data, clearly marked — never a copy of
 * real SKUs, stock, or pricing.
 */
const FIXTURE_PRODUCTS: ProductDetail[] = [
  {
    sku: 'FIXTURE-CHG-001',
    title: '[Fixture] 20W USB-C Fast Charger',
    collectionHandle: 'chargers',
    collectionTitle: 'Chargers',
    price: { amountPence: 1299, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture charger'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture charger')],
    specs: [{ label: 'Output', value: '20W' }],
    variantId: 'gid://shopify/ProductVariant/fixture-1',
  },
  {
    sku: 'FIXTURE-CAB-001',
    title: '[Fixture] USB-C to Lightning Cable 1.2m',
    collectionHandle: 'charging-cables',
    collectionTitle: 'Charging Cables',
    price: { amountPence: 699, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture charging cable'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture charging cable')],
    specs: [{ label: 'Length', value: '1.2m' }],
    variantId: 'gid://shopify/ProductVariant/fixture-3',
  },
  {
    sku: 'FIXTURE-PWR-001',
    title: '[Fixture] 10,000mAh Power Bank',
    collectionHandle: 'power-banks',
    collectionTitle: 'Power Banks',
    price: { amountPence: 1899, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture power bank'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture power bank')],
    specs: [{ label: 'Capacity', value: '10,000mAh' }],
    variantId: 'gid://shopify/ProductVariant/fixture-4',
  },
  {
    sku: 'FIXTURE-CARH-001',
    title: '[Fixture] Magnetic Car Phone Holder',
    collectionHandle: 'car-holders',
    collectionTitle: 'Car Holders',
    price: { amountPence: 899, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture car phone holder'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture car phone holder')],
    specs: [{ label: 'Mount', value: 'Vent clip' }],
    variantId: 'gid://shopify/ProductVariant/fixture-5',
  },
  {
    sku: 'FIXTURE-CARC-001',
    title: '[Fixture] 48W Car Charger A+C',
    collectionHandle: 'car-chargers',
    collectionTitle: 'Car Chargers',
    price: { amountPence: 799, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture car charger'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture car charger')],
    specs: [{ label: 'Output', value: '48W' }],
    variantId: 'gid://shopify/ProductVariant/fixture-6',
  },
  {
    sku: 'FIXTURE-SCR-001',
    title: '[Fixture] Tempered Glass Screen Protector',
    collectionHandle: 'screen-protectors',
    collectionTitle: 'Screen Protectors',
    price: { amountPence: 499, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture screen protector'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture screen protector')],
    specs: [{ label: 'Hardness', value: '9H' }],
    variantId: 'gid://shopify/ProductVariant/fixture-2',
  },
  {
    sku: 'FIXTURE-WCH-001',
    title: '[Fixture] 15W Qi2 Wireless Charging Pad',
    collectionHandle: 'wireless-chargers',
    collectionTitle: 'Wireless Chargers',
    price: { amountPence: 1599, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture wireless charging pad'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture wireless charging pad')],
    specs: [{ label: 'Output', value: '15W' }],
    variantId: 'gid://shopify/ProductVariant/fixture-7',
  },
  {
    sku: 'FIXTURE-SCN-001',
    title: '[Fixture] Incell LCD Replacement Screen',
    collectionHandle: 'screens',
    collectionTitle: 'Screens',
    price: { amountPence: 2499, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture replacement screen'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture replacement screen')],
    specs: [{ label: 'Panel', value: 'Incell LCD' }],
    variantId: 'gid://shopify/ProductVariant/fixture-8',
  },
  {
    sku: 'FIXTURE-BAT-001',
    title: '[Fixture] Replacement Battery Cell',
    collectionHandle: 'batteries',
    collectionTitle: 'Batteries',
    price: { amountPence: 1199, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture replacement battery'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture replacement battery')],
    specs: [{ label: 'Capacity', value: '3,000mAh' }],
    variantId: 'gid://shopify/ProductVariant/fixture-9',
  },
  {
    sku: 'FIXTURE-HDP-001',
    title: '[Fixture] ANC Over-Ear Headphones',
    collectionHandle: 'headphones',
    collectionTitle: 'Headphones & Earphones',
    price: { amountPence: 3499, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture headphones'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture headphones')],
    specs: [{ label: 'Type', value: 'Over-ear, ANC' }],
    variantId: 'gid://shopify/ProductVariant/fixture-10',
  },
  {
    sku: 'FIXTURE-RPR-001',
    title: '[Fixture] Charging Port Flex Cable',
    collectionHandle: 'repair-parts',
    collectionTitle: 'Repair Parts',
    price: { amountPence: 599, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture repair flex cable'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture repair flex cable')],
    specs: [{ label: 'Type', value: 'Charging port flex' }],
    variantId: 'gid://shopify/ProductVariant/fixture-11',
  },
  {
    sku: 'FIXTURE-IPD-001',
    title: '[Fixture] iPad Digitizer Assembly',
    collectionHandle: 'ipad-digitizers',
    collectionTitle: 'iPad Digitizers',
    price: { amountPence: 3999, currencyCode: 'GBP' },
    thumbnail: noImage('Fixture iPad digitizer'),
    description: 'Fixture product for local development only — not real inventory.',
    images: [noImage('Fixture iPad digitizer')],
    specs: [{ label: 'Type', value: 'Touch glass + digitizer' }],
    variantId: 'gid://shopify/ProductVariant/fixture-12',
  },
]

function toSummary(product: ProductDetail): ProductSummary {
  const { sku, title, collectionHandle, collectionTitle, price, thumbnail } = product
  return { sku, title, collectionHandle, collectionTitle, price, thumbnail }
}

/**
 * Mirrors Shopify's cursor connection model on a plain in-memory array — the
 * cursor here is just a stringified index, which is fine for a fixture but
 * would never be exposed as a real Shopify cursor format.
 */
function paginate<T>(
  items: T[],
  { first, after }: PaginationOpts,
): { page: T[]; pageInfo: PageInfo } {
  const startIndex = after ? Number(after) + 1 : 0
  const page = items.slice(startIndex, startIndex + first)
  const endIndex = startIndex + page.length - 1
  return {
    page,
    pageInfo: {
      hasNextPage: startIndex + page.length < items.length,
      endCursor: page.length > 0 ? String(endIndex) : null,
    },
  }
}

export function createFixtureCatalogueAdapter(): CatalogueAdapter {
  return {
    async listCollections() {
      return listCollectionsFixture()
    },
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

function listCollectionsFixture(): Promise<CollectionSummary[]> {
  const byHandle = new Map<string, ProductDetail[]>()
  for (const product of FIXTURE_PRODUCTS) {
    const existing = byHandle.get(product.collectionHandle) ?? []
    existing.push(product)
    byHandle.set(product.collectionHandle, existing)
  }
  return Promise.resolve(
    Array.from(byHandle.entries()).map(([slug, products]) => ({
      slug,
      title: products[0]!.collectionTitle,
      description: 'Fixture collection for local development only.',
      lineCount: products.length,
      thumbnail: products[0]!.thumbnail,
    })),
  )
}

function getCollectionFixture(
  slug: string,
  opts: PaginationOpts & FacetOpts,
): Promise<CollectionResult> {
  const matches = FIXTURE_PRODUCTS.filter((product) => product.collectionHandle === slug)
  const { page, pageInfo } = paginate(matches.map(toSummary), opts)
  return Promise.resolve({
    slug,
    title: matches[0]?.collectionTitle ?? slug,
    description: 'Fixture collection for local development only.',
    products: page,
    pageInfo,
    availableFacets: [],
    lineCount: matches.length,
  })
}

function searchFixture(query: string, opts: PaginationOpts & FacetOpts): Promise<SearchResult> {
  const lowerQuery = query.toLowerCase()
  const matches = FIXTURE_PRODUCTS.filter((product) =>
    product.title.toLowerCase().includes(lowerQuery),
  )
  const { page, pageInfo } = paginate(matches.map(toSummary), opts)
  return Promise.resolve({
    query,
    products: page,
    pageInfo,
    availableFacets: [],
    totalCount: matches.length,
  })
}

function suggestFixture(query: string): Promise<TypeaheadResult> {
  const lowerQuery = query.toLowerCase()
  const products = FIXTURE_PRODUCTS.filter((product) =>
    product.title.toLowerCase().includes(lowerQuery),
  ).map((product) => ({ sku: product.sku, title: product.title }))
  return Promise.resolve({ products, collections: [] })
}
