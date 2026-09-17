# NCC Supply — Tasks

Checkboxes are grouped by phase. Nothing is checked unless it exists in the repo *and* has been verified (CLAUDE.md rule 25) — no task is pre-checked based on intent.

## Phase 0 — Discovery, architecture, project memory

- [x] Read PRD, Design System, and build runbook in full
- [x] Visually cross-check reference site against Design System doc
- [x] Verify `draftOrderInvoiceSend` exists as a current Admin GraphQL mutation
- [x] Verify B2B Admin API `companies` resource is reachable on the current dev store
- [x] Create `CLAUDE.md` with the 25 permanent operating rules
- [x] Create `IMPLEMENTATION_PLAN.md` with architecture, routes, boundaries, phase sequence, environments
- [x] Create `TASKS.md` (this file)
- [x] Create `DECISIONS.md` with confirmed decisions + awaiting-business-confirmation section
- [x] Create `PHASE_HANDOFF.md` template
- [x] Create `docs/domain-model.md`
- [x] Create `docs/route-permissions-matrix.md`
- [x] Create `docs/integration-contracts.md`
- [ ] Business review of `DECISIONS.md` open items (external — not something Claude can complete)

## Phase 1 — Application scaffold and design-system foundation

- [x] TanStack Start project scaffold, strict TypeScript, agreed package manager (pnpm) — `ncc-supply/`
- [x] Tailwind v4 CSS-first tokens under `@theme inline` (light + dark values defined; light is the only one that renders — see DECISIONS.md)
- [x] Inter loaded via `<link>` in document head (`src/routes/__root.tsx`)
- [x] Named utilities: `surface-card`, `hero-gradient`, `sky-gradient`, `text-gradient`, `grid-mesh`, `rise-in`
- [x] Accessible primitives: Button, Link (router + external), Field/TextareaField, Badge, StatusChip, Card, Dialog (Radix-based sheet/modal), Disclosure
- [x] Shared container + responsive layout primitives (`Container`, `Section`, `ResponsiveGrid`)
- [x] Lucide icon wrapper (decorative/accessible variants) — `src/components/ui/Icon.tsx`
- [x] App error boundary, not-found boundary, loading patterns — `src/components/app-boundaries/*`
- [x] Component-preview surface: dev-only `/dev/components` route (no Storybook — see DECISIONS.md)
- [x] Automated token-usage + primitive-behaviour checks — 47 Vitest/Testing Library tests incl. a hardcoded-colour static scan
- [x] Lint, type-check, test, production build all pass — evidence in PHASE_HANDOFF.md
- [x] Visual check at 375/768/1024/1440px — via Browser tool, one real bug found and fixed (see PHASE_HANDOFF.md)
- [x] Banner primitive (hero + compact variants, gradient-only background per 2026-09-12 direction — no grid-mesh) + BannerCarousel (separate component, usage decision deferred) — added mid-Phase-1 at explicit user request, both in `/dev/components` and covered by tests

## Phase 2 — Domain model, persistence, integration boundaries

- [x] Database schema/migrations for app-owned concepts only (PRD §7.2) — `src/server/db/schema.ts`, 19 tables; SQLite via libSQL, not Postgres (DECISIONS.md ADR-004 revision); migration generated and verified applying cleanly to a real file (`pnpm db:migrate`, tables confirmed via direct query, artifact deleted)
- [x] Order/quote/return/support status enums + transition guards — `src/server/domain/status.ts`, enums re-exported from `schema.ts`, pure `transition*` functions throwing `InvalidTransitionError` on an invalid move; `assertConfirmedQuantityAllowed` enforces PRD rule 2/15 (never silently increased)
- [x] Immutable audit-event records — `src/server/audit/audit-log.ts`; `recordAuditEvent` is the only exported function (no update/delete), backed by the indexed `audit_events` table
- [x] Tenant/role authorization helpers (deny-by-default) — `src/server/auth/authorization.ts`; `Actor` discriminated union + `canViewCompanyResource`/`canMutateCompanyResource`/`canManageStaffTeam` matching `docs/route-permissions-matrix.md` exactly
- [x] Guest-token generation/hashing/expiry/revocation — `src/server/tokens/token-service.ts` (`issueGuestToken`/`verifyGuestToken`/`revokeGuestToken`), hash-only storage via shared `src/server/shared/opaque-token.ts`
- [x] Idempotency support for order submission + Shopify mutations — `src/server/idempotency/idempotency.ts`, `withIdempotency(db, scope, key, run)`, unique `(scope, key)` constraint backs concurrent-call safety
- [x] Validation schemas for all domain commands — `src/server/validation/commands.ts`; guest/buyer-facing schemas are `.strict()` so an unexpected field (e.g. a client-supplied price) fails validation rather than being silently dropped
- [x] Typed Shopify Storefront/Customer/Admin service interfaces — `src/server/integrations/shopify/types.ts` (`CatalogueAdapter` + supporting types promoted from `docs/integration-contracts.md`); Customer Account / Admin adapters left as the doc-sketch interfaces for Phase 3 to implement, since Phase 2 has no routes to call them from yet
- [x] Mock/fixture adapters for local dev + contract tests — `src/server/integrations/shopify/fixture-adapter.ts`, every fixture SKU/title prefixed `[Fixture]` (CLAUDE.md rule 20)
- [x] Environment validation + `.env.example` — `src/server/env.ts` (Zod, refuses the insecure default `SESSION_SECRET` in production), `.env.example` at the `ncc-supply/` root
- [x] Dev-only seed data, unmistakably marked — `src/server/seed.ts` (`pnpm db:seed`), refuses to run when `NODE_ENV=production`; every seeded name/email prefixed `[Fixture]`; verified end-to-end against a throwaway DB file, rows inspected, file deleted
- [x] Security tests: cross-company denial, sales-rep scope, buyer-vs-admin, invalid transitions, token enumeration, duplicate-submission idempotency, no client-trusted totals/pricing, sales-rep first-login activation gated on employee ID (ADR-007) — all covered by name in `authorization.test.ts`, `status.test.ts`, `token-service.test.ts`, `idempotency.test.ts`, `commands.test.ts`
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (19 files / 141 tests), `pnpm build` all pass — see PHASE_HANDOFF.md for the exact commands and output

## Phase 3 — Shopify connectivity and catalogue adapter

- [x] Storefront API client: products, variants, collections, images, prices, pagination — `src/server/integrations/shopify/storefront-client.ts` + `storefront-adapter.ts`, real GraphQL shapes verified against `shopify.dev/docs/api/storefront/2026-07` this session (SKU search syntax, `search`/`predictiveSearch` field shapes, cursor pagination). Metafields/metaobjects deferred — nothing in the PRD's launch scope needs them yet
- [x] Customer Account API boundary — `src/server/integrations/shopify/customer-account-adapter.ts`; real OIDC discovery + PKCE `login()`/`authorize()`, contract-tested via mocked fetch. Not live-testable until Phase 7 has a real HTTPS callback route (Shopify never accepts localhost redirect URIs) — documented blocker, not silently skipped
- [x] Server-only Admin API boundary — `src/server/integrations/shopify/admin-client.ts` + `admin-adapter.ts`; `createDraftOrder`/`sendDraftOrderInvoice`/`approveReturn` against real, doc-verified mutations (`draftOrderCreate`, `draftOrderInvoiceSend`, `returnApproveRequest`). No live mutation ever fired this phase — contract-tested only, per the phase's own rule
- [x] Pagination, rate-limit handling, timeouts, retries, error mapping, redacted logs — `src/server/integrations/shopify/http-client.ts` (shared by both Storefront and Admin clients): `AbortController` timeout, bounded retry-with-backoff on network failure/429/`THROTTLED`, typed `ShopifyApiError`, logs never include headers/tokens/variables
- [x] Catalogue normalization into app Product/Collection view models — `toSummary`/`toImage`/`toMoneyPence`/`toFacetOptions` in `storefront-adapter.ts` map raw Shopify shapes into the `CatalogueAdapter` types from Phase 2
- [x] Fixture adapter selectable by environment, never mixed with production — `src/server/integrations/shopify/index.ts`'s `getCatalogueAdapter()` factory, gated by `CATALOGUE_ADAPTER` env var (default `fixture`); test asserts a `live`-configured factory only ever calls the real Storefront endpoint
- [x] Caching/revalidation strategy for a wholesale catalogue — `src/server/integrations/shopify/cache.ts`, in-memory TTL memoization wrapping the live adapter's `getCollection`/`getProduct` calls
- [x] Health diagnostics with no credential exposure — `src/server/integrations/shopify/health.ts` (`checkStorefrontHealth`/`checkAdminHealth`) + dev-only `/dev/shopify-health` route (noindex), manually verified in-browser showing `{configured: false, ok: false}` for both in fixture mode
- [x] Contract tests + read-only smoke test against dev store (never production) — contract tests via mocked fetch for every adapter; `storefront-adapter.smoke.test.ts` is a real read-only call against `nccwholesale.org` that no-ops with a recorded blocker until `SHOPIFY_STOREFRONT_ACCESS_TOKEN` is configured (blocked on a manual Shopify-admin step only the user can do — see DECISIONS.md)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (26 files / 165 passed, 1 skipped), `pnpm build` all pass

## Phase 4 — Public shell and homepage

- [x] Sticky header: announcement strip, logo, primary nav, category rail (real `listCollections()` data via a root-route loader), basket/account/search icon row, always-visible Help entry point — `src/components/ui/Header.tsx`
- [x] Responsive mobile navigation with focus management and keyboard support — hamburger toggle, Escape closes and returns focus to the toggle button (tested in `Header.test.tsx`); category rail and desktop nav correctly hidden below `md`
- [x] Footer — `src/components/ui/Footer.tsx`, `bg-ink`/`text-ink-foreground`, 4-column grid, no staff-facing link anywhere
- [x] Homepage sections built from PRD §6.1: Hero (reusing Phase 1's `Banner`), four trust stats, Shop By Category (`CategoryGrid`/`CategoryCard`, real collection data), Popular This Month (`ProductCard`, real fixture product data — explicitly documented as a data sample, not a fabricated "popularity" ranking), How It Works (`OrderSteps`, copy grounded in PRD §4's actual flow), FAQ (`FAQ`/`Disclosure`, content grounded only in confirmed PRD facts, no invented policy numbers) + CTA banner — `src/routes/index.tsx`
- [x] Explicit empty/error states for every adapter-backed section (tested: `CategoryGrid.test.tsx` "no categories found"; `index.tsx`'s `getHomeData` server function catches adapter failures and the route renders a distinct error message rather than crashing)
- [x] Organization, WebSite/SearchAction, and FAQPage structured data — verified present and correctly shaped by inspecting the live page's `<script type="application/ld+json">` output in a real browser
- [x] Responsive checks at 375/1024/1440px via the Browser tool — real fixture data confirmed rendering end-to-end at each breakpoint; keyboard Tab order and Escape-to-close confirmed via `document.activeElement` inspection (a dev-only TanStack Devtools overlay obstructed a couple of mouse-click checks in the live preview — not a production issue, confirmed by the build log stripping devtools code entirely — so those specific interactions were verified via keyboard/DOM inspection and `Header.test.tsx` instead)
- [x] `CatalogueAdapter.listCollections()` added — a real gap in the Phase 2/3 interface (no way to list all collections at all) surfaced while building this phase; implemented for both fixture and live adapters, cache-wrapped in `index.ts` (ADR-014)
- [x] No copied tutorial-video layout/content; no invented testimonials, reviews, stock claims, or delivery promises
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (29 files / 197 passed, 1 skipped), `pnpm build` all pass

## Phase 5 — Catalogue, search and product discovery

- [x] `/categories` — full catalogue index using real `listCollections()` data, ItemList structured data — `src/routes/categories.tsx`
- [x] `/category/:slug` — collection listing: breadcrumb, real "N lines · all available to order" header, facet sidebar, sort, cursor-based pagination, 2/3/4-up responsive product grid, honest "No products found" empty state, canonical always pointing to the unfiltered URL, `noindex` on zero-result facet combinations, BreadcrumbList + ItemList structured data — `src/routes/category/$slug.tsx`
- [x] `/search` — server-backed full-catalogue search with the same facet/sort/pagination machinery, `q` reflected in the URL, real `totalCount` from Shopify (not the current page length), typeahead suggestions, same canonical/noindex/structured-data treatment — `src/routes/search.tsx`
- [x] `/product/:sku` — gallery, spec list, real price ("Available to order", no VAT label, matching cards), inert quantity + Add-to-basket control (Phase 6 wires it up for real), `notFound()` for an unknown SKU, Product structured data with `PreOrder` availability, no reviews/ratings UI — `src/routes/product/$sku.tsx`
- [x] Shared components: `FacetSidebar` (grouped checkboxes, applied chips, clear-all — all plain links, no client JS required), `Pagination` (Previous/Next — ADR-016), `Breadcrumbs`, `SearchBar` (typeahead with keyboard Up/Down/Enter/Escape, debounced, progressive-enhancement `<form method="get">` base)
- [x] Facet/sort/pagination state lives entirely in shareable, crawlable URL query params (ADR-015) — ProductCard/CategoryCard/Header links stay plain anchors for routes that exist as of this phase too, consistent with the pattern established in Phase 4
- [x] `CatalogueAdapter.lineCount`/`totalCount` added where Shopify's API actually provides real values (aliased query for collections, native `totalCount` for search) — never fabricated
- [x] "Available to order" only everywhere — no stock counts, no delivery promises, no contract-pricing UI (ADR-005)
- [x] Manual verification via the Browser tool: `/categories`, `/category/chargers` (sort links, real facet-empty state), `/search?q=...` (real results + real totalCount + zero-result `noindex`), `/product/:sku` (real data + structured data + 404 for an unknown SKU), typeahead dropdown with real suggestions, keyboard Up/Down/Enter/Escape (Enter verified via a proper `userEvent` test after the Browser tool's own synthetic key event proved non-standard — see DECISIONS.md), canonical tags confirmed stripping facet/sort/pagination params, mobile (375px) layout confirmed usable
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (30 files / 214 passed, 1 skipped), `pnpm build` all pass

## Phase 6 — Basket and guest order-request vertical slice

- [x] Persistent guest basket — TanStack Start's `useSession` (encrypted, httpOnly, sealed with the existing `SESSION_SECRET`) holds only a pointer to a server-persisted basket row, never contents — `src/server/basket/session.ts`
- [x] Add/update/remove basket lines, any positive integer quantity (rule 12), same-SKU adds bump quantity rather than duplicating — `src/server/basket/basket.ts`
- [x] Server-side product/price lookup for every line, on every read and again at submission — never a stored or client-supplied price (rule 9); a line whose product has since become unavailable is kept visible with a clear reason, not silently dropped
- [x] Idempotent "submit basket" — a duplicate/retried submission always replays the exact same `{orderRequestId, token}` rather than creating a second order or erroring — `src/server/basket/submit-order-request.ts`, proven by a test that submits the same basket twice and asserts exactly one `order_requests` row exists
- [x] Guest order request created directly at `awaiting_ncc_review` (guests skip company approval — rule 6); copy never says "Pay" or "Checkout" anywhere in the basket/submission flow
- [x] Secure guest status link (`issueGuestToken`) + `/order-submitted` confirmation + token-gated `/order/:id` — a missing, wrong, expired, or revoked token and a nonexistent order id all render the identical "we couldn't find that order" state (no enumeration, rule 16) — verified in a real browser for all four cases
- [x] `noindex` on `/basket`, `/order-submitted`, `/order/:id`
- [x] Schema gap fixes discovered while building this phase (ADR-017): `baskets.status`/`orderRequestId`, `basket_lines.sku`, `order_request_lines.sku` — none of these existed even though the domain model and the adapter's by-SKU-only lookup already required them
- [x] Manual verification via the Browser tool against the real (migrated) dev database: added a real fixture product to the basket from the product page, edited its quantity, submitted, landed on `/order-submitted`, followed the private link to a fully populated `/order/:id`, confirmed the identical not-found state for a tampered token/wrong id/missing token, confirmed a fresh basket is issued after submission rather than resurfacing the completed one, confirmed mobile (375px) and desktop layouts both work
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (33 files / 231 passed, 1 skipped), `pnpm build` all pass — and, distinctly from every prior phase, the production build was inspected to confirm `createServerFn` correctly splits server-only code (db client, adapters) out of the client bundle even when called from a shared component (`ProductCard`) rather than only from route loaders

## Phase 7 — Company accounts, buyer identity, company approval

- [x] Buyer identity via Shopify's own OIDC/PKCE Customer Account flow (ADR-003, no app password system) — real HTTPS callback route `/auth-callback` finally live-wires `customer-account-adapter.ts` (built Phase 3); `verifyIdentity` added for real JWKS-verified email/customer-id extraction (ADR-020)
- [x] Fixture/live split for the Customer Account adapter (`CUSTOMER_ACCOUNT_ADAPTER`, default `fixture`) so the whole sign-in flow is testable with zero Shopify credentials — dev-only `/dev/fixture-shopify-login` (ADR-019)
- [x] `/auth` (buyer sign-in entry) and `/register` (first-time company creation for a verified identity with no existing `buyerUsers` row) — invite acceptance happens via `/auth` itself, no separate accept step (ADR-022)
- [x] Buyer session (`ncc_buyer` cookie, separate from the guest basket session) + OIDC round-trip state session (`ncc_oidc_pending`) — `src/server/buyers/buyer-session.ts`, `oidc-flow.ts` (ADR-021)
- [x] `/account` shell (sidebar layout route + guard), `/account` dashboard, `/account/orders` (buyer-own vs company-admin-all via the existing `canViewCompanyResource`), `/account/users` (admin-only: invite/edit role+spend-limit/remove), `/account/pricing` (plain uniform-pricing statement, no fabricated tier table — ADR-005)
- [x] Reorder duplicates a past order's lines (confirmed quantity if set, else requested) into a fresh basket via the existing `addLine` — `src/server/orders/order-view.ts`
- [x] Buyer basket ownership unified into the existing `getOrCreateBasketId` (buyer session checked first, guest cookie unchanged otherwise) — every existing basket call site works unchanged for both
- [x] Buyer order submission creates the order request at `awaiting_company_approval` (guests still skip straight to `awaiting_ncc_review`) — company-admin approve/reject (`src/server/orders/company-approval.ts`) is what exercises the existing guarded `transitionOrderRequest` (ADR-023); a replayed decision fails cleanly via the existing `InvalidTransitionError` guard, no new idempotency wrapper needed
- [x] Audit events for company registration, buyer invite/role/spend-limit/removal, buyer activation, and every company approval/rejection — all via the existing `recordAuditEvent`
- [x] Header shows signed-in company name + role, with sign-out — root loader extended alongside the existing category loader
- [x] A real pre-existing type bug found and fixed: `isCompanyAdmin`'s type predicate always narrowed to `never` (see DECISIONS.md) — first exercised by this phase's code, not introduced by it
- [x] Tests: cross-company isolation (orders, buyer management, approval), buyer-vs-admin visibility, removed-user sign-in denial, pending-invite activation, replayed approval, unauthorized price/order access, all relevant `OrderRequestAction`/`BuyerAction` transitions, real JWKS verification (including a rejected-signature and rejected-audience case) for both the fixture and real adapters
- [x] Manual, via the Browser tool against the fixture adapter: registered a new company end-to-end through the simulated Shopify login, invited a second buyer, signed that buyer in (confirmed invite→active activation and landing on `/account`), submitted an order as the plain buyer, confirmed it showed `awaiting_company_approval` on `/account/orders` for both the buyer's own view and the admin's all-orders view, approved it as the admin and confirmed it flipped to `awaiting_ncc_review` with the replay guard working (no stale Approve/Reject after refetch), reordered it into a fresh basket, and confirmed a second company's admin saw zero orders at all (cross-tenant isolation) — a real UI bug (a decided order stayed visually expanded with a stale, empty detail rather than re-fetching) was found and fixed during this pass, not just asserted from tests
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (39 files / 291 passed, 1 skipped), `pnpm build` all pass — client bundle re-checked for no `jose`/`@libsql/client`/server-only leakage

## Phase 8 — NCC order console, Shopify draft order, confirmed checkout

- [x] Staff authentication boundary — `server/auth/session.ts`/`password.ts` (Phase 2, never wired up before now) behind a new `/staff-login` route; opaque bearer token in a plain httpOnly cookie (ADR-024), email-or-username-in-one-field per PRD
- [x] ADR-007's sales-rep first-login activation actually fires for the first time — verified against the real seeded dev database, not just a unit test
- [x] `/staff/orders` queue and `/staff/order/:id` detail — sorted by submission time, status chips, reuses the existing `canViewCompanyResource` (ncc_admin full, sales_rep read-only/assigned-companies-only/never-sees-guest-orders) — no new authorization rule invented
- [x] Per-line confirmed-quantity input (zero allowed, never above requested — reuses the existing `assertConfirmedQuantityAllowed`), delivery/VAT inputs, live recalculated total, internal notes, single atomic Approve action (`server/orders/ncc-approval.ts::confirmOrder`, one `db.transaction`), Cancel with a required reason, copy-to-clipboard customer link (mints a fresh guest token on demand, since the raw token is never stored — rule 16)
- [x] Real Shopify Draft Order creation + invoice send behind `getAdminCommerceAdapter()` (ADR-025, fixture/live split matching the other two Shopify boundaries) — reconciliation state needs no new schema column: a `confirmed` order with `shopifyDraftOrderId`/`invoiceUrl` still `null` *is* the explicit "needs Shopify sync" state, with a working Retry action (ADR-026)
- [x] `/checkout/:id` — dual guest-token/buyer-session access reusing `/order/:id`'s existing pattern, redirects to the equivalent order-status view unless `confirmed`, offers invoice-link and cash-on-delivery without processing either (ADR-027)
- [x] Audit events for every approval and cancellation (`ncc_approve_order`, `ncc_cancel_order`) via the existing `recordAuditEvent`
- [x] **A real, pre-existing security bug found and fixed**: `dev/fixture-shopify-login.tsx`'s `beforeLoad` read `env` directly, shipping `SESSION_SECRET`'s and `SITE_ACCESS_PASSWORD`'s literal default values into the public client JS bundle since Phase 7 — see DECISIONS.md. Re-swept the entire client bundle for every known secret/dependency after the fix; clean.
- [x] **A real Shopify credential provided this session, and used for real**: a token the user described as a Storefront token turned out to be a working Admin API token (verified via direct HTTP checks against both endpoints) — wired in as `SHOPIFY_ADMIN_ACCESS_TOKEN` with `ADMIN_COMMERCE_ADAPTER=live`. A real approval against the real dev store produced a real, informative Shopify error (`write_draft_orders` scope missing) — the reconciliation design (ADR-026) handled this correctly on the first real-world failure it ever hit, not just in a mocked test
- [x] Two more real bugs found via manual testing against real leftover order data: a guest order with no contact email can never get a Shopify invoice (recorded as a business-decision gap, not fixed this phase), and `getGuestOrderLink` used the wrong signal (`guestContactEmail` presence) to detect "is this a guest order" instead of `buyerUserId` — both in DECISIONS.md
- [x] Tests: unauthorized `/staff/*` access (no session, wrong role, sales rep outside assignment redirected cleanly rather than hitting the generic error boundary), quantity-increase-above-requested rejected, double-approval rejected via `InvalidTransitionError` with no double Shopify call, a mocked Shopify failure leaves `confirmed` + null `shopifyDraftOrderId`/`invoiceUrl` and retry recovers, sales rep denied every mutation (approve/cancel/retry/copy-link), cross-company staff-queue isolation (including guest-order exclusion for sales reps), ADR-007 activation (success and refused-without-employee-id cases)
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm test` (43 files / 316 passed, 1 skipped), `pnpm build` all pass — client bundle re-swept for every known secret value and server-only dependency name, not just dependency names as in prior phases
- [x] **Live Shopify Storefront connection established (2026-09-13)**: two more credentials verified via direct HTTP checks; the real working Storefront token wired in as `SHOPIFY_STOREFRONT_ACCESS_TOKEN` with `CATALOGUE_ADAPTER=live` — resolves the Phase 3-onward Storefront-token blocker. 321+ real SKUs across all 12 real collections confirmed live in-browser. The second credential ("Private Access Token") verified to be another Admin token, not used — see DECISIONS.md
- [x] **A real bug found and fixed via going live**: homepage hero CTA hardcoded `/category/chargers`, but the real collection handle is `wall-chargers` — fixed by deriving the featured category dynamically from loaded `collections` instead of a hardcoded slug (`src/routes/index.tsx`, commit `afceb7b`). Verified in-browser against the real category page
- [x] Real data-completeness gap noted, not fixed: live products currently show £0.00 (store hasn't set prices yet) — flagged for the user, not a code defect
- [x] **Critical bug found and fixed (2026-09-13, second pass)**: `getProduct(sku)` was broken for virtually every real SKU — Shopify's `sku:` search filter is unreliable on this store (verified directly) and the query separately double-selected `variants` with conflicting arguments (a GraphQL error on every call). This meant "Add to Basket" silently failed site-wide against live data, not just the product page 404ing. Fixed with a two-phase catalogue-scan-then-fetch-by-handle approach; verified end-to-end in-browser (real product page renders, real Add-to-Basket click lands in `/basket`)
- [x] Removed Shopify's built-in "Availability" and "Price" facet groups from the catalogue adapter — Availability contradicted the site's "Available to order" messaging and CLAUDE.md rule 10; Price rendered as a broken checkbox (this app already has Price ↑/↓ sort)
- [x] Built `FacetLayout` (mobile "Filters & Sort" button → full-screen sheet, static sidebar at `lg`+) matching PRD §5.3's breakpoint table exactly; used by both `/category/:slug` and `/search`. Corrected `Dialog`'s sheet breakpoint from `sm` to `lg` to match
- [x] Category page header redesigned using the existing `Banner variant="compact"` component (Design System §7 "category top" banner, never used in production before this)
- [x] `pnpm typecheck`/`lint`/`test` (44 files / 324 passed, 1 skipped)/`build` all pass; client bundle re-swept, clean

## Phase 9 — Bulk ordering, quotes, reorder completion

- [x] **Reorder found already fully shipped** — `reorderIntoBasket` (Phase 2/7 forward-looking work), the `reorder` server function, and working "Reorder" buttons on both `/account` and `/account/orders` all pre-existed. No new work needed; verified by reading, not assumed.
- [x] Added `sku` column to `quoteLines` (migration `0002_pale_mercury.sql`) — the catalogue adapter has no by-variant-id lookup, so a quote line needed the same fix `orderRequestLines` already had.
- [x] New `CatalogueAdapter.getProductsBySku(skus)` batch-lookup method (single paginated catalogue scan, both adapters) — bulk order's up to 500 rows and quote requests both use it instead of calling `getProduct` in a loop. Promoted `variantId` onto `ProductSummary` itself (was previously `ProductDetail`-only) so the batch method can return it.
- [x] **Bulk order** (`/bulk-order`): hand-rolled CSV/paste parser (`server/bulk-order/csv.ts`) — header auto-detection, duplicate-SKU merging, malformed-row reasons, a hard 500-row cap returning one whole-file error rather than a silent truncation; `previewBulkOrder`/`addBulkOrderLinesToBasket` (`server/bulk-order/bulk-order.ts`) reusing the existing `addLine` so price/availability is never re-derived; downloadable CSV template (`public/bulk-order-template.csv`); "Download unmatched rows" export sanitized against CSV/formula injection (`sanitizeCsvCell`). Verified end-to-end against the live catalogue in-browser: a real SKU matched with its real title/price, an unknown SKU and a malformed row both correctly flagged, and the matched line landed in the real basket.
- [x] **Quotes** (`/quote`, `/quote/:id`, `/staff/quotes`, `/staff/quote/:id`): request form (guest or buyer), NCC-admin-only per-line pricing/issue action, explicit customer "Accept Quote" converting to a real order re-entering standard review (guest → `awaiting_ncc_review`, buyer → `awaiting_company_approval` — never skipping either), lazy quote expiry (no cron job — checked wherever a quote's status matters), guest customer-link minting. Reused the exact same view/submit/staff-queue/pricing patterns Phase 7/8 established for orders. Verified end-to-end in-browser against live data: guest request → NCC admin priced and issued it → guest accepted it → real order created with the quoted price carried through, confirmed on the resulting order's own status page.
- [x] **Real routing bug found and fixed**: `routes/quote.tsx` (flat file) became an implicit parent layout for `routes/quote/$id.tsx` once the `quote/` directory existed as a sibling — TanStack Router nested `QuoteIdRoute` under `QuoteRoute` in the generated tree, so the detail page's content never rendered (only its `<title>` did, since the parent had no `<Outlet/>`). Fixed by moving it to `routes/quote/index.tsx`, matching the convention `routes/account/index.tsx` already established. Found by manually following a real guest quote link, not by the test suite.
- [x] `pnpm typecheck`/`lint`/`test` (50 files / 371 passed, 1 skipped)/`build` all pass; client bundle re-swept, clean

## Phase 10 — Returns and support cases (merged with Phase 11 into one session, at the user's request)

- [x] New `attachments` table (BLOB storage, polymorphic owner) — content-type sniffed from magic bytes, never trusted from the client; served only as an authorized data URL that re-runs the owning return/ticket's own real access check, never a public path. Migration `0003_sad_reavers.sql`.
- [x] **Returns** (`/returns`, `/returns/:id`, `/account/returns`, `/staff/returns`, `/staff/return/:id`): request form reachable only from a real confirmed order (guest token or buyer session), eligible-line/quantity picker enforcing confirmed-quantity-minus-already-returned limits, reason from PRD's defined list, optional note/photo. Staff flow: `requested → under_review → approved/rejected → refunded/replacement_sent`, resolution choice on approval, manual "mark refunded/replacement sent" confirmation independent of the (real, contract-tested, empirically-confirmed-empty) Shopify sync attempt. Verified end-to-end in-browser against a real confirmed order: full status chain from request through refunded, including the real Shopify sync failure logged exactly as designed.
- [x] **Support** (`/support`, `/support/:id`, `/staff/support`, `/staff/support/:id`): ticket form (category, optional verified order/return reference, message, optional attachment) for guests and buyers; message thread with NCC replies, internal notes (excluded from the customer view **at the query layer**, not just the UI — verified with a dedicated test), resolve/escalate; a customer reply to a `resolved` ticket implicitly reopens it. Verified end-to-end in-browser: guest ticket → NCC admin reply → guest saw the reply and could respond.
- [x] `pnpm typecheck`/`lint`/`test` (59 files / 435 passed, 1 skipped)/`build` all pass; client bundle re-swept, clean

## Phase 11 — Staff accounts, team management, sales-rep scoping (merged with Phase 10, see above)

- [x] **`/staff/team`** (NCC-admin-only, redirects any other role away): add a staff account (name/email/username/role/initial password/employee ID), case-normalized email/username, duplicate email/username/employee-ID rejected, employee-ID format validated, a sales rep starts `pending_id_verification` (real ADR-007 activation on first login, unchanged from Phase 8) while an ncc_admin starts `active` immediately. Deactivate/reactivate. **Role change (downgrade/upgrade)** added specifically to make the runbook's own named test scenario real — see DECISIONS.md. Assign/unassign a sales rep's company book.
- [x] **`/staff/accounts`** (read-only in this pass, scoped like every other staff queue — sales rep sees only their book): each company's buyer users, spend limits, and assigned sales rep. Contract/tier pricing administration is correctly absent — ADR-005 already resolved this build to uniform pricing. Staff-initiated company *creation* is a recorded gap, not built (see DECISIONS.md ADR-036).
- [x] Every staff mutation confirmed NCC-admin-only via a real `ForbiddenError` test (sales rep and buyer actors both denied) — direct URL access and server-action authorization both covered, not just UI-hidden buttons.
- [x] Verified in-browser against the real seeded fixture accounts: `/staff/team` and `/staff/accounts` both render live data with working controls; confirmed neither new index/id route pair repeats the Phase 9 routing bug by checking the generated route tree directly.

## Phase 12 — SEO, AEO, accessibility, performance, security hardening

**Security-only slice done now, ahead of Phase 14 staging — the user explicitly chose to defer SEO/AEO/accessibility/performance/dependency-audit to a later full pass. See `docs/quality-audit.md` and DECISIONS.md ADR-037.**

- [x] Authorization matrix, tenant isolation/IDOR, sessions/CSRF, injection, XSS, upload validation, and password hashing all reviewed against real code and existing tests — found already sound, evidence cited in `docs/quality-audit.md`.
- [x] **Real gap fixed:** 12 inline route-level server functions used an unvalidated TypeScript-typed passthrough instead of a real Zod schema at the `.validator()` RPC boundary — including a customer support-ticket reply with no message/attachment size cap. All 12 now validate for real.
- [x] **Real gap fixed:** no rate limiting existed anywhere for this app's own endpoints. Added an in-memory limiter (`server/shared/rate-limit.ts`) on staff sign-in, the site-access gate, and every guest-writable submission (order/quote/return/support-ticket/support-reply).
- [x] `pnpm typecheck`/`lint`/`test` (60 files / 441 passed, 1 skipped)/`build` all pass; client bundle re-swept, clean.
- [ ] SEO/AEO (structured data, canonical URLs, robots/sitemap, Q&A content) — deferred.
- [ ] Accessibility (automated WCAG, keyboard-only, focus/contrast/reduced-motion, responsive breakpoints) — deferred.
- [ ] Performance (bundle analysis, image loading, cache review, measured budgets) — deferred.
- [ ] Dependency/configuration audit — deferred.

## Phase 13 — Real catalogue, assets, content readiness

- [ ] Shopify catalogue completeness (pricing, images) — live-store data gap, not a code defect (see DECISIONS.md 2026-09-13 note)
- [ ] Remaining copy/content readiness from the Phase 13 runbook prompt

## Phase 14 — Staging, end-to-end acceptance, launch preparation

**Hosted-deploy prep slice (2026-09-17) — not the full Phase 14 UAT/runbook pass.** User asked to prepare a live production setup with all real products. See ADR-038.

- [x] Nitro Vite plugin so TanStack Start can deploy to Vercel
- [x] Hosted-deploy env guards: live catalogue, live admin adapter, hosted `DATABASE_URL` (not local SQLite, not fixture inventory)
- [x] `/dev/*` routes 404 in production; Devtools gated on `import.meta.env.DEV`
- [x] First-admin CLI `pnpm db:bootstrap-admin` (empty staff table only; never an HTTP endpoint)
- [x] `.env.example` hosted/Vercel checklist (names only)
- [ ] Turso database created and migrated (`pnpm db:migrate` against `DATABASE_URL`) — user action
- [ ] Vercel project (Root Directory `ncc-supply`) + env vars set — user action
- [ ] `SITE_ACCESS_PASSWORD` set on the first deploy until authorized launch
- [ ] Full UAT matrix / `docs/UAT-CHECKLIST.md` / deployment + rollback runbooks — remaining Phase 14
- [ ] Production domain/DNS — gated launch prompt only; current NCC website stays untouched
