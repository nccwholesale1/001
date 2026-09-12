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
    title: node.title,
    collectionHandle: collection.handle,
    collectionTitle: collection.title,
    price: toMoneyPence(node.priceRange.minVariantPrice),
    thumbnail: toImage(node.featuredImage, node.title),
  }
}

function toFacetOptions(groups: StorefrontFilterGroup[] | undefined): FacetOption[] {
  if (!groups) return []
  return groups.flatMap((group) =>
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
            products(first: 250) { edges { node { id } } }
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
          products: { edges: unknown[] }
        }
      }>
    }
  }>('listCollections', query)

  return data.collections.edges.map(({ node }) => ({
    slug: node.handle,
    title: node.title,
    description: node.description,
    lineCount: node.products.edges.length,
    thumbnail: node.image ? toImage(node.image, node.title) : null,
  }))
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
        products(first: $first, after: $after, filters: $filters) {
          edges { node { ${PRODUCT_SUMMARY_FIELDS} } }
          pageInfo { hasNextPage endCursor }
          filters { ${FILTER_FIELDS} }
        }
      }
    }
  `
  const data = await storefrontRequest<{
    collectionByHandle: {
      title: string
      description: string
      products: {
        edges: Array<{ node: StorefrontProductNode }>
        pageInfo: PageInfo
        filters: StorefrontFilterGroup[]
      }
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
    }
  }

  const collection = data.collectionByHandle
  return {
    slug,
    title: collection.title,
    description: collection.description,
    products: collection.products.edges.map((edge) =>
      toSummary(edge.node, { handle: slug, title: collection.title }),
    ),
    pageInfo: collection.products.pageInfo,
    availableFacets: toFacetOptions(collection.products.filters),
  }
}

async function getProductLive(sku: string): Promise<ProductDetail | null> {
  const query = `
    query GetProductBySku($searchQuery: String!) {
      products(first: 1, query: $searchQuery) {
        edges {
          node {
            ${PRODUCT_SUMMARY_FIELDS}
            descriptionHtml
            options { name values }
            images(first: 10) { edges { node { url altText width height } } }
            variants(first: 100) { edges { node { id sku } } }
          }
        }
      }
    }
  `
  const data = await storefrontRequest<{
    products: { edges: Array<{ node: StorefrontProductNode }> }
  }>('getProductBySku', query, { searchQuery: `sku:${sku}` })

  const node = data.products.edges[0]?.node
  if (!node) return null

  const matchingVariant = node.variants.edges.find((edge) => edge.node.sku === sku)
  if (!matchingVariant) return null

  return {
    ...toSummary(node),
    sku,
    variantId: matchingVariant.node.id,
    description: node.descriptionHtml ?? '',
    images: (node.images?.edges ?? []).map((edge) => toImage(edge.node, node.title)),
    specs: (node.options ?? []).map((option) => ({
      label: option.name,
      value: option.values.join(', '),
    })),
  }
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
      }
    }
  `
  const data = await storefrontRequest<{
    search: {
      edges: Array<{ node: StorefrontProductNode }>
      pageInfo: PageInfo
      productFilters: StorefrontFilterGroup[]
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
