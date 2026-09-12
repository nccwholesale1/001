# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 7 — Company accounts, buyer identity, company approval

**Completed scope:** company buyer identity and the company-side approval step from PRD §§2, 4, 6.10–6.13, 7.4 (runbook §10), on branch `phase/7-company-accounts`. NCC-side staff auth (`server/auth/session.ts`/`password.ts`, built in Phase 2) is unused by any route until Phase 11 — out of this phase's scope by design.

- **Buyer identity is Shopify's own OIDC/PKCE Customer Account flow (ADR-003)** — no app-owned password system. `server/integrations/shopify/customer-account-adapter.ts` (built Phase 3, never live-tested) finally gets its real HTTPS callback route, `/auth-callback`. Added `verifyIdentity(idToken)` to the adapter contract: real JWKS signature verification against Shopify's discovery document (via `jose`, a new dependency), checking `aud`/`iss` before trusting the `email`/`sub` claims — the actual authentication boundary, not just token exchange.
- **`CUSTOMER_ACCOUNT_ADAPTER=fixture|live`** (default `fixture`), mirroring `CATALOGUE_ADAPTER` — `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` is still unconfigured (same blocker as Phase 3's Storefront token, still unconfirmed by the user). The fixture adapter (`fixture-customer-account-adapter.ts`) drives a dev-only simulated Shopify login page (`/dev/fixture-shopify-login`) using a self-signed JWT, so the entire sign-in → callback → session → account → approval flow was genuinely exercised end-to-end in a real browser, not just unit-mocked (ADR-019).
- **`/auth`** (buyer sign-in entry) and **`/register`** (first-time company creation for a verified identity with no matching `buyerUsers` row). Invite acceptance happens via `/auth` itself — an admin-created `invited` row activates on that buyer's first successful sign-in (mirrors ADR-007's staff activation pattern) — there is no separate "accept invite" step (ADR-022).
- **Buyer session** (`ncc_buyer` cookie, `server/buyers/buyer-session.ts`) is entirely separate from the guest basket session (`ncc_basket`) — signing in never disturbs an in-progress guest basket. A short-lived `ncc_oidc_pending` session carries OIDC round-trip state and, briefly, a verified-but-unmatched identity for `/register` (ADR-021).
- **`/account`** shell (sidebar layout + guard), dashboard, **`/account/orders`** (buyer-own vs. company-admin-all, reusing the existing `canViewCompanyResource` unchanged), **`/account/users`** (admin-only invite/edit-role-and-spend-limit/remove), **`/account/pricing`** (plain statement of uniform list pricing — ADR-005 already resolved there's no tier table to show).
- **Reorder** (`server/orders/order-view.ts::reorderIntoBasket`) duplicates a past order's lines — confirmed quantity if NCC already set one, else requested — into a fresh basket via the existing `addLine`, no bespoke copy path.
- **Basket ownership unified with minimal diff**: `getOrCreateBasketId` (`server/basket/session.ts`) now checks for a buyer session first (resolving/creating that buyer's own basket by identity, no cookie pointer needed) before falling through to the unchanged guest-cookie logic — every existing basket call site (`ProductCard`, `/product/:sku`, `basket/server-functions.ts`) works unchanged for both guest and buyer.
- **Buyer order submission** (`server/basket/submit-order-request.ts`) creates the order request directly at `awaiting_company_approval` — unlike a guest, who still skips straight to `awaiting_ncc_review` (rule 6). **`server/orders/company-approval.ts::decideCompanyApproval`** is what actually exercises the existing guarded `transitionOrderRequest('company_approve'|'company_reject')` — a replayed decision on an already-decided order fails cleanly via the existing `InvalidTransitionError`, with no new idempotency wrapper needed (ADR-023).
- **Audit events** for company registration, buyer invite/activation/role/spend-limit/removal, and every company approval/rejection — all via the existing `recordAuditEvent`.
- **Header** shows the signed-in company name + role, with sign-out — extends the existing root-loader pattern alongside the category loader.
- **A real pre-existing bug found and fixed**: `authorization.ts`'s `isCompanyAdmin` type predicate always narrowed to `never` (an `Extract<Union, {discriminant, narrowerLiteral}>` gotcha) — written in Phase 2, never exercised by any caller until this phase's code was the first to actually use it. Fixed to extract-then-intersect. See DECISIONS.md ADR notes for the full explanation.

**Files created/changed:** see `TASKS.md` Phase 7 checklist for the exhaustive list. New modules: `server/buyers/{buyer-session,oidc-flow,companies,server-functions}.ts`, `server/orders/{order-view,company-approval,server-functions}.ts`, `server/integrations/shopify/fixture-customer-account-adapter.ts`; new routes `auth.tsx`, `auth-callback.tsx`, `register.tsx`, `dev/fixture-shopify-login.tsx`, `account/{route,index,orders,users,pricing}.tsx`; new components `OrderRequestDetail.tsx` (extracted from `/order/$id` for reuse), `BuyerUserTable.tsx`. Also touched: `validation/commands.ts` (new schemas), `env.ts`/`.env.example` (`CUSTOMER_ACCOUNT_ADAPTER`), `integrations/shopify/{types,index,customer-account-adapter}.ts`, `basket/{session,submit-order-request}.ts`, `auth/authorization.ts` (the `isCompanyAdmin` fix + a shared `ForbiddenError`), `components/ui/Header.tsx`, `routes/__root.tsx`, `routes/order/$id.tsx`, `routes/basket.tsx`. `DECISIONS.md` (ADR-019 through ADR-023 plus the type-bug note).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm typecheck  → tsc --noEmit, no output, exit 0
$ pnpm lint       → eslint ., no output, exit 0
$ pnpm test       → Test Files 39 passed (39), Tests 291 passed | 1 skipped (292)
$ pnpm build      → client + SSR bundles both built successfully
```
Also re-checked the client bundle specifically for this phase: grepped `dist/client/assets/*.js` for `libsql`/`node:crypto`/`jose`/`jwtVerify`/`createRemoteJWKSet` — none present, confirming the new JWKS-verification code and the db client stayed server-only despite being reachable from routes now guarded by session logic.

Manual, via the Browser tool against `pnpm dev` (fixture adapter, the default): registered a new company ("Acme Repairs") end-to-end through the simulated Shopify login → `/register` → landed on `/account` with the sidebar/role/company name all correct; invited a second buyer ("Bob Buyer") from `/account/users` and confirmed his row showed "Pending invite"; signed in as Bob via the fixture login and confirmed his `invited` row activated and he landed straight on `/account` as "Buyer" (no Users link, no admin-only dashboard card); added a fixture product to his basket and submitted it, confirming buyer-mode copy ("sends this to your company admin") and no contact fields; confirmed the order showed `awaiting_company_approval` on `/account/orders` for both Bob's own view and Jane's (the admin's) all-orders view with "· Bob Buyer" attribution; approved it as Jane and confirmed it flipped to `awaiting_ncc_review`; re-expanded the row afterward and confirmed no stale Approve/Reject controls remained (see the real bug found below); reordered it into a fresh basket confirmed by quantity/SKU; registered a second company ("Beta Supplies") and confirmed its admin saw zero orders and zero users from Acme — real cross-tenant isolation, not just asserted in tests.

**A real bug the manual verification caught:** after approving/rejecting an order, the row's cached detail was cleared but the "which row is expanded" state wasn't reset alongside it — the next click on that row (still logically "expanded" with no detail to show) silently collapsed it instead of re-expanding with fresh data. Fixed in `routes/account/orders.tsx` by resetting `expandedId` in the same place `detailById` is cleared, so a decided row visibly collapses and a subsequent click re-fetches current detail.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 7 decisions and facts" (ADR-019 through ADR-023, the `jose`/jsdom `CryptoKey` realm bug, the `isCompanyAdmin` type-narrowing bug).

**Unresolved blockers / risks carried forward:** the Phase 3 Storefront-token blocker is unchanged. `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` is also still unconfigured — the same manual Shopify-admin Headless-channel step would supply both tokens; neither is confirmed done by the user. Both adapters default to `fixture`/complete, tested defaults in the meantime. PRD §13 Questions 1, 4, 5, 6 unchanged.

**Database migrations / environment variables:** no new migration — every column Phase 7 needed (`companies`, `buyerUsers.{role,status,spendLimit,shopifyCustomerId}`, `baskets.buyerUserId`, `orderRequests.{buyerUserId,companyApprovedByBuyerUserId,companyApprovedAt}`, `auditEvents.actorType` including `'buyer'`) already existed from Phase 2's forward-looking schema. New environment variable: `CUSTOMER_ACCOUNT_ADAPTER` (optional, default `fixture`). New dependency: `jose`.

---

## Next phase: Phase 8 — NCC order console, Shopify draft order and confirmed checkout

**Phase 8 entry criteria (Phase 7 exit gate, satisfied):** company buyer identity, registration, invites, and the company-approval step all work end-to-end against real data (fixture Shopify adapter); every order still reaches `awaiting_ncc_review` before any question of confirmation; cross-company and buyer-vs-admin isolation both hold; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

```text
Read all context and the Phase 7 handoff. Inspect git status. Implement only Phase 8.

Build the NCC order review and confirmation workflow from PRD §§4, 6.7, 6.9 and 7.1.

Implement:
- protected /staff/orders and /staff/order/:id routes;
- staff authentication boundary needed for NCC admins;
- queue states that distinguish awaiting review from confirmed;
- per-line confirmed quantities, allowing zero and preventing increases above requested quantity;
- delivery and VAT inputs, server-side recalculated final totals, internal notes and invoice-link field;
- one atomic NCC-admin Approve action that validates and records quantities, delivery, VAT, total and status together;
- Cancel with required reason and audit record;
- Shopify Draft Order creation/update only after successful NCC approval;
- secure invoice/payment link handling using the current supported Shopify flow;
- /checkout/:id guard that redirects to order view unless status is confirmed;
- confirmed customer order view showing original versus confirmed lines, removals, delivery, VAT and final total;
- cash-on-delivery and invoice-payment options only when confirmed.

Design external mutations for idempotency and partial-failure recovery. Never leave the app confirmed while Shopify creation failed without an explicit recoverable reconciliation state. Never expose Admin API access to the client.

Use a development Shopify store only. Place every live mutation behind an explicit environment safety check. Test unauthorized access, quantity increase attempts, double approval, Shopify timeout/failure, reconciliation, unconfirmed checkout access and final-total integrity. Run all checks, update records and stop.
```
