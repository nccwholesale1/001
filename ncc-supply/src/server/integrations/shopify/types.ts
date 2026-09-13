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
  /** Shopify variant GID — the id basket lines, order lines, and quote lines reference. Already resolved for every summary, since a summary's own SKU already identifies one specific variant. */
  variantId: string
}

export interface ProductDetail extends ProductSummary {
  description: string
  images: ProductImage[]
  specs: Array<{ label: string; value: string }>
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
  /** Real count (Shopify's Collection type has no aggregate field for this — see ADR-014/ADR-015). */
  lineCount: number
}

export interface SearchResult {
  query: string
  products: ProductSummary[]
  pageInfo: PageInfo
  availableFacets: FacetOption[]
  totalCount: number
}

export interface TypeaheadResult {
  products: Array<{ sku: string; title: string }>
  collections: Array<{ slug: string; title: string }>
}

export interface CollectionSummary {
  slug: string
  title: string
  description: string
  /** Real product count, not a live stock quantity (CLAUDE.md rule 10 is about inventory, not catalogue size). */
  lineCount: number
  thumbnail: ProductImage | null
}

/**
 * Owns: products, variants, collections, images, pricing, pagination
 * (PRD §7.1). The fixture adapter and the real Storefront-API-backed
 * adapter both implement this — selected by environment variable, never
 * mixed in the same running process (CLAUDE.md rule 20).
 *
 * `listCollections` was added in Phase 4 — the original Phase 2 doc sketch
 * missed it, but both the homepage's "Shop By Category" and `/categories`
 * need a full collection index, and there's no other way to get one.
 */
export interface CatalogueAdapter {
  listCollections(): Promise<CollectionSummary[]>
  getCollection(slug: string, opts: PaginationOpts & FacetOpts): Promise<CollectionResult>
  getProduct(sku: string): Promise<ProductDetail | null>
  /**
   * Batch lookup for bulk order (PRD §6.6) — up to 500 SKUs at once. Never
   * call `getProduct` in a loop for this: each call scans the catalogue
   * independently, so N SKUs would mean N separate scans. Missing SKUs are
   * simply absent from the returned map, not an error.
   */
  getProductsBySku(skus: string[]): Promise<Map<string, ProductSummary>>
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

export interface VerifiedCustomerIdentity {
  email: string
  /** Shopify customer GID (the id_token's `sub` claim) — stored as `buyerUsers.shopifyCustomerId`. */
  shopifyCustomerId: string
}

/**
 * Owns: passwordless sign-in for company buyers via Shopify's own OAuth2 +
 * PKCE + OIDC flow (ADR-003 — the app never builds its own buyer password
 * system). `login()` returns the URL to redirect the buyer to; `authorize`
 * exchanges the callback's authorization code for a session; `verifyIdentity`
 * verifies and decodes the session's id_token into the email/customer-id
 * pair Phase 7's callback route matches against `buyerUsers` — this is the
 * actual authentication boundary (CLAUDE.md rule 9), not just token
 * exchange. Real adapter verifies the id_token's signature against
 * Shopify's own JWKS; not live-testable until a real HTTPS callback route
 * and a configured client id exist (see docs/DECISIONS.md). A fixture
 * adapter (CUSTOMER_ACCOUNT_ADAPTER=fixture, the dev default) implements
 * the same contract against a self-signed token so the whole sign-in flow
 * is exercisable with zero Shopify credentials.
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
  verifyIdentity(idToken: string): Promise<VerifiedCustomerIdentity>
  /** Phase 10 — needs a real authenticated session to mean anything. */
  getReturnEligibility(orderId: string, accessToken: string): Promise<{ eligible: boolean }>
  /** Phase 10. */
  requestReturn(
    accessToken: string,
    input: { orderId: string; lineIds: string[] },
  ): Promise<ShopifyReturn>
}
