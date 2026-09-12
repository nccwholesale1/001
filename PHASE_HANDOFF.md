# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 6 — Basket and guest order-request vertical slice

**Completed scope:** the guest-only path from PRD §§4, 6.5, 6.7 (runbook §9), on branch `phase/6-guest-orders`. Company-buyer basket/approval is Phase 7's job, not touched here.

- **`server/basket/session.ts`** — the persistent guest basket mechanism: TanStack Start's `useSession` (encrypted, httpOnly, sealed with `env.SESSION_SECRET`) holds only a pointer to a server-side basket row (ADR-017).
- **`server/basket/basket.ts`** — add/update/remove lines, each re-resolving real price/product via `getCatalogueAdapter()` — never a stored or client-supplied price. A line whose product has since become unavailable stays visible with a clear reason rather than being silently dropped.
- **`server/basket/submit-order-request.ts`** — the guest submission: re-resolves every price one more time at this exact moment, creates the order request directly at `awaiting_ncc_review` (guests skip company approval — rule 6), issues a guest token, records an audit event. Wrapped in `withIdempotency` keyed on the basket id, so a duplicate/retried submission always replays the exact same result rather than creating a second order — proven by a test asserting exactly one `order_requests` row after submitting twice.
- **`server/basket/server-functions.ts`** — the `createServerFn` layer every route/component calls; every mutation resolves the basket id from the session cookie itself, never from client input.
- **New routes:** `/basket` (editable line list, ex-VAT subtotal, contact fields, "Submit basket" — copy never says Pay/Checkout), `/order-submitted` (confirmation + the one-time private link), `/order/:id` (token-gated; a missing/wrong/expired/revoked token and a nonexistent id all render the identical "we couldn't find that order" state — verified in a real browser for all four cases, not just asserted).
- **`ProductCard`** and **`/product/:sku`** — the "Add to Basket" control is real now (was deliberately inert since Phase 4/5, since there was nothing to add to yet), with the design system's confirm-then-revert visual state.
- **ADR-018**: `submitBasketSchema` revised — basket id and lines are never client input anymore, only optional contact fields.
- **Schema gap fixes** (same pattern as ADR-012/014): `baskets.status`/`orderRequestId`, `basket_lines.sku`, `order_request_lines.sku` — none of these existed even though the domain model and the adapter's SKU-only lookup already required them. Migration `0001_clear_switch.sql`.

**Files created/changed:** see `TASKS.md` Phase 6 checklist for the exhaustive list with per-item evidence. Also touched: `validation/commands.ts` (new basket-line schemas, revised `submitBasketSchema`), `DECISIONS.md` (ADR-017, ADR-018, the schema-gap note, and a real process-gap finding below).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm test        → Test Files 33 passed (33), Tests 231 passed | 1 skipped (232)
$ pnpm typecheck   → tsc --noEmit, no output, exit 0
$ pnpm lint        → eslint ., no output, exit 0
$ pnpm build       → client + SSR bundles both built successfully
```
Also inspected the build output specifically for this phase: confirmed `createServerFn`'s server/client code-splitting works correctly even when a server function is called from a shared component (`ProductCard`, used on the homepage/category/search, not just from a route loader) — the client chunk stayed small while the server chunk carried the real `db`/adapter logic, with no `@libsql/client` leakage into the browser bundle.

Manual, via the Browser tool against `pnpm dev` with the real (migrated) dev database: added a real fixture product to the basket from its product page, confirmed it appeared on `/basket` with the correct live price, increased its quantity and watched the subtotal update, submitted, landed on `/order-submitted` with a real private link, followed it to a fully populated `/order/:id`, then confirmed a tampered token, a missing token, and a nonexistent order id all render the identical "we couldn't find that order" message. Confirmed that reloading `/basket` after a successful submission issues a fresh empty basket rather than resurfacing the completed one. Checked both 375px and desktop layouts.

**A real bug the manual verification caught:** the first add-to-basket attempt failed with a genuine SQL error — the migration had only ever been applied to throwaway test files in every prior phase, never to the actual `local.db` the running dev server uses. Fixed by running `pnpm db:migrate` against it directly. See `DECISIONS.md` for the full note; this is a real process gap worth remembering for future phases, not just a one-off fix.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 6 decisions and facts" (ADR-017, ADR-018, the schema-gap note, the dev-database migration finding).

**Unresolved blockers / risks carried forward:** the Phase 3 Storefront-token blocker is unchanged (fixture-mode by default, not blocking). PRD §13 Questions 1, 4, 5, 6 unchanged.

**Database migrations / environment variables:** new migration `src/server/db/migrations/0001_clear_switch.sql` (baskets status/orderRequestId, basket_lines.sku, order_request_lines.sku) — applied to the local dev database as part of this phase's own verification. No new environment variables.

---

## Next phase: Phase 7 — Company accounts, buyer identity, company approval

**Phase 7 entry criteria (Phase 6 exit gate, satisfied):** the full guest vertical slice works end-to-end against real data; every price is server-resolved; guest access is token-gated with no enumeration; duplicate submission is idempotent; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

```text
Read all context and the Phase 6 handoff. Inspect git status. Implement only Phase 7.

Implement company buyer identity and company-side approval according to PRD §§2, 4, 6.10–6.13 and 7.4.

Use Shopify's current customer-account flow for company buyers as decided in the architecture (src/server/integrations/shopify/customer-account-adapter.ts already exists from Phase 3 — real OIDC/PKCE construction, contract-tested, not yet live-tested since it needs a real HTTPS callback route, which this phase provides). Do not create a separate buyer password system. Implement server-side mapping from Shopify customer/company identity to the app-owned workflow records already defined in src/server/db/schema.ts (companies, buyer_users).

Build:
- /auth and /register buyer/invite paths as specified;
- /account shell and dashboard;
- /account/orders with buyer-own vs company-admin-all visibility (src/server/auth/authorization.ts's canViewCompanyResource/canMutateCompanyResource already implement this distinction — reuse them, don't re-derive);
- reorder action that creates a new basket (src/server/basket/basket.ts's addLine, reused);
- /account/users for invites, roles, spend limits and removal;
- /account/pricing as read-only server-resolved entitlement data (uniform list pricing only — ADR-005, no contract tiers to look up);
- buyer order submission into awaiting_company_approval (src/server/domain/status.ts's transitionOrderRequest already has this transition — guest submission in Phase 6 bypassed it entirely by creating straight at awaiting_ncc_review; a signed-in buyer's submission needs to actually start at awaiting_company_approval and use the guarded transition to advance);
- company-admin approve/reject actions and clear pending states;
- audit events for every approval, role, limit and user-state change (src/server/audit/audit-log.ts already exists).

Every company buyer order requires company-admin approval regardless of spend limit. Spend limits are informational context only. A company-admin approval advances the request to NCC review; it never confirms the order or unlocks payment.

Test cross-company isolation, buyer/admin visibility, removed-user behaviour, pending invites, replayed approval, unauthorized price access and all status transitions. Run all checks, update tracking documents and stop.
```
