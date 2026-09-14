import { sanitizeProductDescriptionHtml, stripToPlainText } from './sanitize-description'
import { storefrontRequest } from './storefront-client'
import type {
  CatalogueAdapter,
  CollectionResult,
  CollectionSummary,
  FacetOpts,
  FacetOption,
  PageInfo,
  PaginationOpts,
  ProductDetail,
  ProductSummary,
  SearchResult,
  TypeaheadResult,
} from './types'

/**
 * Real Storefront-API-backed CatalogueAdapter (verified against
 * https://shopify.dev/docs/api/storefront/2026-07 this session — exact
 * field/argument names below, not guessed). Never requests or surfaces
 * inventory/stock fields (CLAUDE.md rule 10) — only title, image, price,
 * and identity fields are ever selected.
 *
 * Facet/sort mapping is a best-effort pass-through: the NCC facet taxonomy
 * (brand, category, compatibility, grade — PRD §6.3) isn't configured in
 * Shopify's Search & Discovery app yet, so the exact ProductFilter shapes
 * that will actually return results can only be finalized once Phase 5
 * builds the real facet UI against a live token. Contract-tested here via
 * mocked fetch; verify against real data in the read-only smoke test once
 * SHOPIFY_STOREFRONT_ACCESS_TOKEN is configured.
 */

interface StorefrontImage {
  url: string
  altText: string | null
  width: number
  height: number
}

interface StorefrontMoney {
  amount: string
  currencyCode: string
}

interface StorefrontProductNode {
  title: string
  descriptionHtml?: string
  featuredImage: StorefrontImage | null
  priceRange: { minVariantPrice: StorefrontMoney }
  options?: Array<{ name: string; values: string[] }>
  images?: { edges: Array<{ node: StorefrontImage }> }
  collections?: { edges: Array<{ node: { handle: string; title: string } }> }
  variants: { edges: Array<{ node: { id: string; sku: string } }> }
  /**
   * Product-detail-only: the full variant list, aliased to avoid a GraphQL
   * "argument conflict" error against the `variants(first: 1)` already
   * selected by PRODUCT_SUMMARY_FIELDS (the same field can't be selected
   * twice with different arguments in one query) — a real, confirmed bug
   * this session: getProductLive always errored against live data before
   * this fix, for every SKU, independent of the sku-search bug fixed above.
   */
  allVariants?: { edges: Array<{ node: { id: string; sku: string } }> }
}

interface StorefrontFilterGroup {
  id: string
  label: string
  values: Array<{ id: string; label: string; count: number }>
}

const PRODUCT_SUMMARY_FIELDS = `
  title
  featuredImage { url altText width height }
  priceRange { minVariantPrice { amount currencyCode } }
  collections(first: 1) { edges { node { handle title } } }
  variants(first: 1) { edges { node { id sku } } }
`

const FILTER_FIELDS = `
  id
  label
  values { id label count }
`

function toImage(image: StorefrontImage | null, fallbackAlt: string) {
  return {
    url: image?.url ?? '',
    altText: image?.altText ?? fallbackAlt,
    width: image?.width ?? 0,
    height: image?.height ?? 0,
  }
}

function toMoneyPence(money: StorefrontMoney) {
  return { amountPence: Math.round(Number(money.amount) * 100), currencyCode: 'GBP' as const }
}

function toSummary(
  node: StorefrontProductNode,
  collectionOverride?: { handle: string; title: string },
): ProductSummary {
  const collection = collectionOverride ??
    node.collections?.edges[0]?.node ?? { handle: '', title: '' }
  return {
    sku: node.variants.edges[0]?.node.sku ?? '',
    variantId: node.variants.edges[0]?.node.id ?? '',
    title: node.title,
    collectionHandle: collection.handle,
    collectionTitle: collection.title,
    price: toMoneyPence(node.priceRange.minVariantPrice),
    thumbnail: toImage(node.featuredImage, node.title),
  }
}

/**
 * Shopify's Storefront API injects its own built-in "Availability" and
 * "Price" filter groups alongside real product-attribute facets (verified
 * directly against the live store 2026-09-13). Both are excluded here:
 * "Availability" (in stock / out of stock) directly contradicts this site's
 * "Available to order" messaging and CLAUDE.md rule 10 (never surface live
 * stock state) — every line NCC lists is presented as orderable, so an
 * in-stock/out-of-stock split would openly contradict the checkout flow.
 * "Price" is a PRICE_RANGE-type filter (a single min/max control, not a
 * list of discrete values) that this app's checkbox-style FacetSidebar
 * can't render correctly — it already has dedicated Price ↑/↓ sort options.
 */
const EXCLUDED_FACET_LABELS = new Set(['availability', 'price'])

function toFacetOptions(groups: StorefrontFilterGroup[] | undefined): FacetOption[] {
  if (!groups) return []
  return groups
    .filter((group) => !EXCLUDED_FACET_LABELS.has(group.label.toLowerCase()))
    .flatMap((group) =>
      group.values.map((value) => ({
        attribute: group.label,
        value: value.label,
        count: value.count,
      })),
    )
}

/** Best-effort mapping — see module doc comment. */
function toProductFilters(filters: FacetOpts['filters']) {
  if (!filters || filters.length === 0) return undefined
  return filters.flatMap((filter) =>
    filter.values.map((value) => ({ variantOption: { name: filter.attribute, value } })),
  )
}

function toSearchSortKey(sort: FacetOpts['sort']): { sortKey: string; reverse: boolean } {
  switch (sort) {
    case 'price_asc':
      return { sortKey: 'PRICE', reverse: false }
    case 'price_desc':
      return { sortKey: 'PRICE', reverse: true }
    case 'title_asc':
      return { sortKey: 'TITLE', reverse: false }
    default:
      return { sortKey: 'RELEVANCE', reverse: false }
  }
}

export function createStorefrontCatalogueAdapter(): CatalogueAdapter {
  return {
    listCollections: listCollectionsLive,
    getCollection: getCollectionLive,
    getProduct: getProductLive,
    getProductsBySku: getProductsBySkuLive,
    search: searchLive,
    suggest: suggestLive,
  }
}

/**
 * The Storefront API's Collection type has no product-count field at all
 * (verified against shopify.dev/docs/api/storefront/2026-07/objects/Collection
 * this session — counting products is genuinely only possible by fetching
 * them). `first: 250` covers every realistic NCC collection size at launch
 * (321 SKUs across ~12 collections total); revisit if a single collection
 * ever approaches that cap.
 */
async function listCollectionsLive(): Promise<CollectionSummary[]> {
  const query = `
    query ListCollections {
      collections(first: 250) {
        edges {
          node {
            handle
            title
            description
            image { url altText width height }
            products(first: 250) { edges { node { id featuredImage { url altText width height } } } }
          }
        }
      }
    }
  `
  const data = await storefrontRequest<{
    collections: {
      edges: Array<{
        node: {
          handle: string
          title: string
          description: string
          image: StorefrontImage | null
          products: { edges: Array<{ node: { id: string; featuredImage: StorefrontImage | null } }> }
        }
      }>
    }
  }>('listCollections', query)

  return data.collections.edges.map(({ node }) => {
    // A collection's own dedicated image (set manually in Shopify admin)
    // takes priority; when that's unset (true for every real collection in
    // this store today), fall back to a real product photo from inside it
    // rather than a flat placeholder — still genuine catalogue imagery,
    // never a fabricated stock photo (CLAUDE.md rule 20).
    const fallbackImage = node.products.edges.find((edge) => edge.node.featuredImage)?.node.featuredImage ?? null
    const image = node.image ?? fallbackImage
    return {
      slug: node.handle,
      title: node.title,
      description: node.description,
      lineCount: node.products.edges.length,
      thumbnail: image ? toImage(image, node.title) : null,
    }
  })
}

async function getCollectionLive(
  slug: string,
  opts: PaginationOpts & FacetOpts,
): Promise<CollectionResult> {
  const query = `
    query GetCollection($handle: String!, $first: Int!, $after: String, $filters: [ProductFilter!]) {
      collectionByHandle(handle: $handle) {
        title
        description
        image { url altText width height }
        products(first: $first, after: $after, filters: $filters) {
          edges { node { ${PRODUCT_SUMMARY_FIELDS} } }
          pageInfo { hasNextPage endCursor }
          filters { ${FILTER_FIELDS} }
        }
        allProducts: products(first: 250) {
          edges { node { id } }
        }
      }
    }
  `
  const data = await storefrontRequest<{
    collectionByHandle: {
      title: string
      description: string
      image: StorefrontImage | null
      products: {
        edges: Array<{ node: StorefrontProductNode }>
        pageInfo: PageInfo
        filters: StorefrontFilterGroup[]
      }
      allProducts: { edges: unknown[] }
    } | null
  }>('getCollection', query, {
    handle: slug,
    first: opts.first,
    after: opts.after ?? null,
    filters: toProductFilters(opts.filters),
  })

  if (!data.collectionByHandle) {
    return {
      slug,
      title: slug,
      description: '',
      products: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      availableFacets: [],
      lineCount: 0,
      thumbnail: null,
    }
  }

  const collection = data.collectionByHandle
  const products = collection.products.edges.map((edge) =>
    toSummary(edge.node, { handle: slug, title: collection.title }),
  )
  // Same rule as listCollectionsLive: the collection's own dedicated image
  // takes priority, falling back to a real product photo from inside it
  // rather than a flat placeholder.
  const thumbnail = collection.image
    ? toImage(collection.image, collection.title)
    : (products.find((product) => product.thumbnail.url)?.thumbnail ?? null)

  return {
    slug,
    title: collection.title,
    description: collection.description,
    products,
    pageInfo: collection.products.pageInfo,
    availableFacets: toFacetOptions(collection.products.filters),
    lineCount: collection.allProducts.edges.length,
    thumbnail,
  }
}

/**
 * `products(query: "sku:X")` is not a reliable way to look a product up by
 * SKU — verified directly against the real store 2026-09-13: it silently
 * ignores the `sku:` field and returns an unfiltered default listing
 * instead of erroring or filtering (confirmed with plain, single-quoted,
 * and double-quoted values, and with `variants.sku:` too — all identical,
 * unrelated results), most likely because this store's search index
 * doesn't have SKU enabled as a searchable field. Free-text fields like
 * `title:` filter correctly, so this is specific to `sku:`. Every real
 * `getProduct(sku)` caller (this product page, `addLine`'s server-truth
 * pricing, order-submission re-pricing) depends on this returning the
 * right product or `null` — never a wrong one — so a full-catalogue scan
 * for the matching variant, cheap fields only, is the only Storefront-API
 * approach that doesn't depend on that store/search configuration.
 */
interface HandleScanNode {
  handle: string
  variants: { edges: Array<{ node: { sku: string } }> }
}

interface HandleScanPage {
  products: {
    edges: Array<{ node: HandleScanNode }>
    pageInfo: PageInfo
  }
}

async function findProductHandleBySku(sku: string): Promise<string | null> {
  const query = `
    query FindProductHandleBySku($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { node { handle variants(first: 100) { edges { node { sku } } } } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  let after: string | null = null
  // Capped at 4 pages of 250 (1000 products) — comfortably above the
  // documented real catalogue size (321 SKUs, see listCollectionsLive above).
  for (let page = 0; page < 4; page++) {
    const pageData: HandleScanPage = await storefrontRequest<HandleScanPage>(
      'findProductHandleBySku',
      query,
      { first: 250, after },
    )

    const match = pageData.products.edges.find((edge) =>
      edge.node.variants.edges.some((variantEdge) => variantEdge.node.sku === sku),
    )
    if (match) return match.node.handle
    if (!pageData.products.pageInfo.hasNextPage) return null
    after = pageData.products.pageInfo.endCursor ?? null
  }
  return null
}

async function getProductLive(sku: string): Promise<ProductDetail | null> {
  const handle = await findProductHandleBySku(sku)
  if (!handle) return null

  const query = `
    query GetProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        ${PRODUCT_SUMMARY_FIELDS}
        descriptionHtml
        options { name values }
        images(first: 10) { edges { node { url altText width height } } }
        allVariants: variants(first: 100) { edges { node { id sku } } }
      }
    }
  `
  const data = await storefrontRequest<{ productByHandle: StorefrontProductNode | null }>(
    'getProductByHandle',
    query,
    { handle },
  )

  const node = data.productByHandle
  if (!node) return null

  const matchingVariant = (node.allVariants ?? node.variants).edges.find(
    (edge) => edge.node.sku === sku,
  )
  if (!matchingVariant) return null

  const rawDescriptionHtml = node.descriptionHtml ?? ''
  return {
    ...toSummary(node),
    sku,
    variantId: matchingVariant.node.id,
    description: sanitizeProductDescriptionHtml(rawDescriptionHtml),
    descriptionText: stripToPlainText(rawDescriptionHtml),
    images: (node.images?.edges ?? []).map((edge) => toImage(edge.node, node.title)),
    specs: (node.options ?? []).map((option) => ({
      label: option.name,
      value: option.values.join(', '),
    })),
  }
}

interface BulkLookupPage {
  products: {
    edges: Array<{ node: StorefrontProductNode }>
    pageInfo: PageInfo
  }
}

/**
 * Batch SKU lookup for bulk order (PRD §6.6) — a single paginated catalogue
 * scan requesting full summary fields, matched against the requested SKU
 * set via the same `toSummary()` convention every other listing already
 * uses (first variant's SKU). Deliberately never calls `getProduct` in a
 * loop — see the CatalogueAdapter interface doc comment for why that would
 * mean up to 500 separate catalogue scans for a full bulk-order upload.
 * Same page cap and short-circuit-on-nothing-left-to-find approach as
 * `findProductHandleBySku` above.
 */
async function getProductsBySkuLive(skus: string[]): Promise<Map<string, ProductSummary>> {
  const wanted = new Set(skus)
  const result = new Map<string, ProductSummary>()
  if (wanted.size === 0) return result

  const query = `
    query BulkLookupProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        edges { node { ${PRODUCT_SUMMARY_FIELDS} } }
        pageInfo { hasNextPage endCursor }
      }
    }
  `
  let after: string | null = null
  for (let page = 0; page < 4 && result.size < wanted.size; page++) {
    const pageData: BulkLookupPage = await storefrontRequest<BulkLookupPage>(
      'bulkLookupProducts',
      query,
      { first: 250, after },
    )

    for (const edge of pageData.products.edges) {
      const summary = toSummary(edge.node)
      if (wanted.has(summary.sku)) result.set(summary.sku, summary)
    }
    if (!pageData.products.pageInfo.hasNextPage) break
    after = pageData.products.pageInfo.endCursor ?? null
  }
  return result
}

async function searchLive(
  searchQuery: string,
  opts: PaginationOpts & FacetOpts,
): Promise<SearchResult> {
  const { sortKey, reverse } = toSearchSortKey(opts.sort)
  const query = `
    query Search($query: String!, $first: Int!, $after: String, $productFilters: [ProductFilter!], $sortKey: SearchSortKeys!, $reverse: Boolean!) {
      search(query: $query, first: $first, after: $after, types: [PRODUCT], productFilters: $productFilters, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            ... on Product { ${PRODUCT_SUMMARY_FIELDS} }
          }
        }
        pageInfo { hasNextPage endCursor }
        productFilters { ${FILTER_FIELDS} }
        totalCount
      }
    }
  `
  const data = await storefrontRequest<{
    search: {
      edges: Array<{ node: StorefrontProductNode }>
      pageInfo: PageInfo
      productFilters: StorefrontFilterGroup[]
      totalCount: number
    }
  }>('search', query, {
    query: searchQuery,
    first: opts.first,
    after: opts.after ?? null,
    productFilters: toProductFilters(opts.filters),
    sortKey,
    reverse,
  })

  return {
    query: searchQuery,
    products: data.search.edges.map((edge) => toSummary(edge.node)),
    pageInfo: data.search.pageInfo,
    availableFacets: toFacetOptions(data.search.productFilters),
    totalCount: data.search.totalCount,
  }
}

async function suggestLive(searchQuery: string): Promise<TypeaheadResult> {
  const query = `
    query Suggest($query: String!) {
      predictiveSearch(query: $query, types: [PRODUCT, COLLECTION], limit: 5) {
        products { title variants(first: 1) { edges { node { sku } } } }
        collections { title handle }
      }
    }
  `
  const data = await storefrontRequest<{
    predictiveSearch: {
      products: Array<{ title: string; variants: { edges: Array<{ node: { sku: string } }> } }>
      collections: Array<{ title: string; handle: string }>
    }
  }>('suggest', query, { query: searchQuery })

  return {
    products: data.predictiveSearch.products.map((product) => ({
      sku: product.variants.edges[0]?.node.sku ?? '',
      title: product.title,
    })),
    collections: data.predictiveSearch.collections.map((collection) => ({
      slug: collection.handle,
      title: collection.title,
    })),
  }
}
