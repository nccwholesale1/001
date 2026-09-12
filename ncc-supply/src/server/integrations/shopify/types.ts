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

/**
 * Cursor-based, matching Shopify's own connection model — there is no
 * random-access "page number" in the Storefront API, so the adapter
 * boundary doesn't pretend to have one either. `after` is an opaque cursor
 * from a previous PageInfo.endCursor; omit it for the first page.
 */
export interface PaginationOpts {
  first: number
  after?: string | null
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
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
  products: ProductSummary[]
  pageInfo: PageInfo
  availableFacets: FacetOption[]
}

export interface SearchResult {
  query: string
  products: ProductSummary[]
  pageInfo: PageInfo
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

// ---------------------------------------------------------------------------
// Admin API boundary (server-only, privileged — CLAUDE.md rule 8)
// ---------------------------------------------------------------------------

export interface DraftOrderLineInput {
  /** Shopify variant GID. */
  variantId: string
  quantity: number
}

export interface ShippingAddressInput {
  address1: string
  address2?: string
  city: string
  zip: string
  countryCode: string
}

export interface ConfirmedOrderRequest {
  lines: DraftOrderLineInput[]
  email: string
  shippingAddress?: ShippingAddressInput
  note?: string
}

export interface DraftOrder {
  /** Shopify draft order GID. */
  id: string
  name: string
  status: string
  invoiceUrl: string | null
  totalPrice: Money
}

export interface EmailInput {
  to: string
  subject?: string
  customMessage?: string
}

export interface ShopifyReturn {
  /** Shopify return GID. */
  id: string
  status: string
}

/**
 * Owns: draft order create/update/invoice-send, and the return-approval
 * step (PRD §7.1). Never reachable from browser code. Unlike the doc sketch
 * in docs/integration-contracts.md, `approveReturn` takes no `resolution`
 * parameter — the real `returnApproveRequest` mutation only approves the
 * return and creates a reverse fulfillment order; choosing refund vs.
 * replacement is a separate subsequent mutation that Phase 10 implements
 * alongside the actual returns workflow.
 */
export interface AdminCommerceAdapter {
  createDraftOrder(orderRequest: ConfirmedOrderRequest): Promise<DraftOrder>
  sendDraftOrderInvoice(draftOrderId: string, email: EmailInput): Promise<DraftOrder>
  approveReturn(returnId: string): Promise<ShopifyReturn>
}

// ---------------------------------------------------------------------------
// Customer Account API boundary (company buyer identity — ADR-003)
// ---------------------------------------------------------------------------

export interface CustomerAccountSession {
  accessToken: string
  idToken: string
  expiresAt: Date
  /** Present only for clients configured on the shop (e.g. a Headless storefront) — see docs/integration-contracts.md. */
  refreshToken?: string
}

/**
 * Owns: passwordless sign-in for company buyers via Shopify's own OAuth2 +
 * PKCE + OIDC flow (ADR-003 — the app never builds its own buyer password
 * system). `login()` returns the URL to redirect the buyer to; `authorize`
 * exchanges the callback's authorization code for a session. Genuinely not
 * live-testable until a real HTTPS callback route exists (Phase 7) — this
 * phase implements real URL/token-exchange construction, contract-tested
 * via mocked fetch.
 */
export interface CustomerAccountAdapter {
  login(
    redirectUri: string,
  ): Promise<{ url: string; state: string; codeVerifier: string; nonce: string }>
  authorize(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<CustomerAccountSession>
  /** Phase 10 — needs a real authenticated session to mean anything. */
  getReturnEligibility(orderId: string, accessToken: string): Promise<{ eligible: boolean }>
  /** Phase 10. */
  requestReturn(
    accessToken: string,
    input: { orderId: string; lineIds: string[] },
  ): Promise<ShopifyReturn>
}
