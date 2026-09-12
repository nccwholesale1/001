/**
 * Typed boundary interfaces promoted from docs/integration-contracts.md.
 * Phase 3 owns the real Shopify-backed implementations; Phase 2 defines the
 * shape so the fixture adapter (./fixture-adapter.ts) and later callers
 * agree on it. Pricing is uniform list pricing for every visitor (ADR-005 —
 * no contract/tier pricing), so nothing here carries a buyer/company
 * context.
 */

export interface Money {
  amountPence: number
  currencyCode: 'GBP'
}

export interface ProductImage {
  url: string
  altText: string
  width: number
  height: number
}

export interface ProductSummary {
  sku: string
  title: string
  collectionHandle: string
  collectionTitle: string
  price: Money
  thumbnail: ProductImage
}

export interface ProductDetail extends ProductSummary {
  description: string
  images: ProductImage[]
  specs: Array<{ label: string; value: string }>
  /** Shopify variant GID — the id basket lines and order lines reference. */
  variantId: string
}

export interface PaginationOpts {
  page: number
  perPage: number
}

export interface FacetFilter {
  attribute: string
  values: string[]
}

export interface FacetOpts {
  filters?: FacetFilter[]
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'title_asc'
}

export interface FacetOption {
  attribute: string
  value: string
  count: number
}

export interface CollectionResult {
  slug: string
  title: string
  description: string
  totalCount: number
  products: ProductSummary[]
  availableFacets: FacetOption[]
}

export interface SearchResult {
  query: string
  totalCount: number
  products: ProductSummary[]
  availableFacets: FacetOption[]
}

export interface TypeaheadResult {
  products: Array<{ sku: string; title: string }>
  collections: Array<{ slug: string; title: string }>
}

/**
 * Owns: products, variants, collections, images, pricing, pagination
 * (PRD §7.1). The fixture adapter and the real Storefront-API-backed
 * adapter both implement this — selected by environment variable, never
 * mixed in the same running process (CLAUDE.md rule 20).
 */
export interface CatalogueAdapter {
  getCollection(slug: string, opts: PaginationOpts & FacetOpts): Promise<CollectionResult>
  getProduct(sku: string): Promise<ProductDetail | null>
  search(query: string, opts: PaginationOpts & FacetOpts): Promise<SearchResult>
  suggest(query: string): Promise<TypeaheadResult>
}
