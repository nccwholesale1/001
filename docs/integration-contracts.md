# NCC Supply — Integration Contracts

Typed boundary shapes for Phase 3+ to implement against. These are interface sketches for planning purposes, not production code — Phase 3 owns the real implementation, tests, error handling, and exact types.

**Target Shopify store for development/contract testing:** `nccwholesale.org` (Basic plan, currently holds the real 321-SKU / 12-collection NCC catalogue). Per the build runbook, no phase performs a live mutation against this store without the phase's own explicit environment safety check, and production mutations are never performed until the gated launch prompt. Whether this store, a newly created dedicated dev store, or the eventual production store is used for which phase's testing is a call to make explicitly at the start of Phase 3 — not assumed here.

---

## 1. Storefront API boundary (public catalogue)

Owns: products, variants, collections, images, prices, metafields/metaobjects, pagination. Pricing is uniform standard list pricing for every visitor — guest or signed-in (DECISIONS.md ADR-005) — so this adapter needs no buyer/company context at all.

```ts
interface CatalogueAdapter {
  getCollection(slug: string, opts: PaginationOpts & FacetOpts): Promise<CollectionResult>;
  getProduct(sku: string): Promise<ProductDetail>;
  search(query: string, opts: PaginationOpts & FacetOpts): Promise<SearchResult>;
  suggest(query: string): Promise<TypeaheadResult>; // products + collections
}
```

Fixture adapter implements the same interface for local dev/tests — selected by environment variable, never mixed with the live adapter in the same running process (CLAUDE.md rule 20).

## 2. Customer Account API boundary (company buyer identity)

Owns: passwordless email-code sign-in for company buyers (plain new customer accounts, **not** B2B-linked — DECISIONS.md ADR-003/006) and native self-serve return eligibility. Company/buyer/role/spend-limit context comes from the app DB (`OrderWorkflowService` below), correlated to this Shopify customer by email — never from a B2B company-location lookup.

```ts
interface CustomerAccountAdapter {
  login(): RedirectResult;             // Shopify-hosted passwordless flow
  authorize(code: string): Promise<Session>;
  getReturnEligibility(orderId: string): Promise<ReturnEligibility>;
  requestReturn(input: ReturnRequestInput): Promise<ShopifyReturn>;
}
```

The application never issues its own password/session for a company buyer — this adapter is the only identity path for that role (ADR-003). Note there is no `getCompanyContext`/`companyLocationId` here (removed 2026-09-12) — that was only needed for B2B-contextualized pricing, which this build doesn't have.

## 3. Admin API boundary (server-only, privileged)

**Never reachable from browser code (CLAUDE.md rule 8).** Owns: draft order create/update/invoice-send, refunds via native returns. No company/price-list management — there is no Shopify B2B object to manage (DECISIONS.md ADR-006).

```ts
interface AdminCommerceAdapter {
  createDraftOrder(orderRequest: ConfirmedOrderRequest): Promise<DraftOrder>;
  sendDraftOrderInvoice(draftOrderId: string, email: EmailInput): Promise<DraftOrder>; // draftOrderInvoiceSend — confirmed live mutation
  approveReturn(returnId: string, resolution: 'refund' | 'replacement'): Promise<ShopifyReturn>;
}
```

✅ **Resolved (was an open risk in the original Phase 0 pass — see `DECISIONS.md` Question 8):** third-party Admin API access to *B2B-specific* resources (companies, B2B catalogs, B2B draft orders) is documented by Shopify as limited to dev stores, Plus Partners, and affiliates. Since this build no longer touches any of those resources (ADR-006), the restriction doesn't apply — plain Draft Order and Return mutations are standard Admin API surface available on every plan, including the current **Basic** plan on `nccwholesale.org`.

## 4. Custom backend boundary (app-owned domain)

Owns everything in `docs/domain-model.md` tagged "App DB." Exposed only via typed server functions/loaders, never a public API without its own auth layer.

```ts
interface OrderWorkflowService {
  submitBasket(basket: Basket, actor: GuestActor | BuyerActor): Promise<OrderRequest>;
  companyApprove(orderRequestId: string, actor: CompanyAdminActor, decision: 'approve' | 'reject'): Promise<OrderRequest>;
  nccApprove(orderRequestId: string, actor: NccAdminActor, input: NccApprovalInput): Promise<OrderRequest>; // one atomic action — rule 13/14
  cancel(orderRequestId: string, actor: NccAdminActor, reason: string): Promise<OrderRequest>;
}

interface TokenService {
  issue(resourceType: 'order' | 'quote' | 'return' | 'support', resourceId: string): Promise<{ token: string; expiresAt: Date }>;
  verify(token: string, resourceType: string): Promise<{ resourceId: string } | null>; // never leaks existence on failure
  revoke(token: string): Promise<void>;
}

interface AuthorizationService {
  canAccess(actor: Actor, resource: ResourceRef): boolean; // deny-by-default, CLAUDE.md rule 17
}
```

## 5. Error handling and observability (applies to all four boundaries)

- Structured, redacted logs — no tokens, no credentials, no full customer PII in log lines.
- Timeouts and bounded retries on every outbound Shopify call; no unbounded retry loops.
- Rate-limit responses from Shopify are caught and mapped to a typed error, not surfaced as a generic 500.
- Health diagnostics endpoint(s) report adapter connectivity status only — never credential values or raw API responses (CLAUDE.md rule 22).
