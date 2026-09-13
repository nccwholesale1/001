# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 8 — NCC order console, Shopify draft order, confirmed checkout

**Completed scope:** the NCC-admin side of the two-stage workflow from PRD §§4, 6.7, 6.9, 7.1 (runbook §11), on branch `phase/8-ncc-order-console`. This is also the first phase with a real, working Shopify write credential in hand — used for real, not just contract-tested.

- **Staff authentication**, wired up for the first time: `server/auth/session.ts`/`password.ts` (built Phase 2, unused since) sit behind a new `/staff-login` route (email-or-username-in-one-field), session carried as a plain opaque bearer token in an httpOnly cookie (ADR-024 — deliberately not `useSession`-sealed, since a hash-verified opaque token is already unforgeable, unlike the buyer/basket pointer cookies). This also means **ADR-007's sales-rep first-login activation fires for real for the first time** — confirmed against the actual seeded dev database (`pnpm db:seed`'s fixture sales rep flipped `pending_id_verification` → `active` on real sign-in), not just a unit test.
- **`/staff/orders`** (queue) and **`/staff/order/:id`** (detail/approval) — reuse the existing `canViewCompanyResource` unchanged: an ncc_admin sees and mutates everything; a sales rep is read-only, sees only assigned companies, and never sees a guest order at all (`companyId: null` is never assignable). Detail screen: per-line confirmed-quantity input (0 allowed, never above requested — reuses `assertConfirmedQuantityAllowed`), delivery/VAT inputs, live recalculated total, internal notes, one atomic **Approve** (`server/orders/ncc-approval.ts::confirmOrder`, a single `db.transaction`), **Cancel** with a required reason, and a **copy-to-clipboard customer link** that mints a fresh guest token on demand (the raw token is never stored, rule 16, so it can't be re-derived any other way).
- **Real Shopify Draft Order creation** behind `getAdminCommerceAdapter()` (ADR-025 — same fixture/live split as the other two Shopify boundaries). **Reconciliation needs no new schema column** (ADR-026): confirmation is one DB transaction; the Shopify sync that follows is a separate, swallowed-on-failure, individually-idempotent step — a `confirmed` order with `shopifyDraftOrderId`/`invoiceUrl` still `null` **is** the explicit "needs Shopify sync" state, with a working **Retry Shopify sync** action.
- **`/checkout/:id`** — reuses `/order/:id`'s guest-token/buyer-session dual-access pattern (staff never reach checkout, per the matrix), redirects to the equivalent order-status view unless `confirmed`, and offers (never processes) invoice-link or cash-on-delivery (ADR-027). No shipping-address collection — flagged as a fact, not invented.
- **Audit events** for every approval and cancellation via the existing `recordAuditEvent`.

**A real, pre-existing security bug found and fixed:** `routes/dev/fixture-shopify-login.tsx`'s `beforeLoad` read `env` directly — since `beforeLoad` is isomorphic, this shipped the *entire* `env.ts` module, literal default values included, into the public client JS bundle. Concretely: **`SESSION_SECRET`'s and `SITE_ACCESS_PASSWORD`'s actual default values (`ncc-preview-2026`) were sitting in plain text in `dist/client/assets/*.js`**, completely defeating last session's password gate for anyone who opened devtools. This predated Phase 8 (shipped in Phase 7) and had gone unnoticed because prior per-phase bundle sweeps grepped for dependency names (`jose`, `libsql`), never for `env.ts` itself or literal default values. Fixed by moving the check into a `createServerFn`; re-swept the whole client bundle for every known secret value and dependency name afterward — clean. Full account in DECISIONS.md's "Security fix" section — **read this before trusting any future `beforeLoad`/`loader` that touches `env`.**

**A real Shopify credential arrived and got used for real this session:** the user pasted a token labelled "Storefront," which turned out on direct verification (401 vs 200 against the two real endpoints) to actually be an **Admin API** token. Wired in as `SHOPIFY_ADMIN_ACCESS_TOKEN` with `ADMIN_COMMERCE_ADAPTER=live` — the first phase to exercise a live Shopify write. Approving a real order produced a real, informative failure (`draftOrderCreate`: missing `write_draft_orders` scope) — the ADR-026 reconciliation design handled it exactly as intended on the very first real-world failure it ever hit (order stayed `confirmed`, sync state stayed visibly "incomplete," Retry reproduced the same clean failure, no crash, no double-write). `CATALOGUE_ADAPTER` is still `fixture` — this token doesn't help the Storefront/catalogue blocker, which is separate (see Phase 3's note).

**Two more real bugs found via manual testing against real leftover order data** (not fixture-invented): a guest order with no contact email at all (basket contact fields are optional) can never get a real Shopify invoice — recorded as a business-decision gap for a future phase, not fixed here. And `getGuestOrderLink` used `guestContactEmail` presence as its "is this a guest order" signal, which that exact same order proved wrong (a guest can have no email and still be a guest) — fixed to check `buyerUserId` instead, the only field that actually distinguishes the two cases; a new test locks in the specific case that was wrong.

**Files created/changed:** see `TASKS.md` Phase 8 checklist for the exhaustive list. New modules: `server/staff/{staff-session,login,server-functions,order-console-server-functions}.ts`, `server/orders/{ncc-approval,staff-queue}.ts`, `server/integrations/shopify/fixture-admin-adapter.ts`; new routes `staff-login.tsx`, `staff/orders.tsx`, `staff/order/$id.tsx`, `checkout/$id.tsx`. Also touched: `env.ts`/`.env.example` (`ADMIN_COMMERCE_ADAPTER`, and the empty-string-vs-undefined env parsing fix below), `integrations/shopify/index.ts` (`getAdminCommerceAdapter`), `orders/order-view.ts` (exposed `invoiceUrl`/`shopifyDraftOrderId`/`internalNotes`), `validation/commands.ts` (`cancelOrderSchema`, `internalNotes` on `nccApprovalSchema`), `routes/dev/fixture-shopify-login.tsx` (the security fix). `DECISIONS.md` (ADR-024 through ADR-027, the security-fix writeup, the two real-bug writeups).

**A small but real robustness fix along the way:** `.env` lines like `KEY=` (present, empty string) were failing Zod's `.min(1).optional()` validation instead of being treated as absent, crashing the server at startup with a confusing error the moment any optional Shopify var was mentioned-but-unset. Fixed with a shared `optionalString()` preprocessor in `env.ts` that treats `''` the same as missing.

**Verification performed (actual output, not inspection-only):**
```
$ pnpm typecheck  → tsc --noEmit, no output, exit 0
$ pnpm lint       → eslint ., no output, exit 0
$ pnpm test       → Test Files 43 passed (43), Tests 316 passed | 1 skipped (317)
$ pnpm build      → client + SSR bundles both built successfully
```
Client bundle re-swept post-build for every known secret literal (`ncc-preview-2026`, the `SESSION_SECRET` dev default, the real `shpat_...` token) and every server-only dependency name (`libsql`, `jose`, `scrypt`, `passwordHash`) — all clear, including the fields that were previously leaking.

Manual, via the Browser tool against `pnpm dev` with `pnpm db:seed` run against the real dev database: signed in as the seeded NCC admin at `/staff-login`; approved a real pending guest order (one with no contact email, a real leftover from earlier testing) and watched it correctly land on "Shopify sync incomplete" with a working Retry, confirmed "Copy customer link" produces a real, usable guest link even for that no-email order; approved a second, real company-buyer order and hit the real `write_draft_orders` scope error live against the actual dev store; followed a confirmed guest order's link to `/checkout/:id` and confirmed both payment options render correctly with the real breakdown; created a fresh guest order and confirmed `/checkout/:id` redirects it to the order-status page since it isn't confirmed yet; signed in as the seeded sales rep and confirmed the empty queue (no assignments), confirmed direct navigation to another company's order redirects cleanly to the queue instead of hitting the generic error boundary (a real UX bug found and fixed in this same pass), and confirmed the real database row shows the rep's status flipped to `active`.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 8 decisions and facts" (ADR-024 through ADR-027) plus the security-fix and two real-bug write-ups immediately above them.

**Update, 2026-09-13 — live Shopify Storefront connection established:** the user supplied two more real credentials after Phase 8's initial handoff was written. Verified the same way as every credential before it (direct HTTP checks against both real endpoints, never trusting the label): the "Public access token" (`[REDACTED-ROTATED-STOREFRONT-TOKEN]`) is a genuine, working Storefront token — wired in as `SHOPIFY_STOREFRONT_ACCESS_TOKEN` with `CATALOGUE_ADAPTER=live`, **resolving the Phase 3-onward Storefront blocker**. The "Private Access Token" (`[REDACTED-ROTATED-ADMIN-TOKEN]`) is, like the earlier one, actually another Admin token — not used. The site now serves the real catalogue end-to-end: 321+ real SKUs across all 12 real Shopify collections, confirmed live in the browser (homepage, category grid, category detail pages all render real data). This surfaced one real bug, found and fixed the same way prior real bugs were this phase — by manually browsing the live site, not just running tests: the homepage hero CTA hardcoded `/category/chargers`, but the real collection handle is `wall-chargers`; fixed by deriving the featured category dynamically from the loaded `collections` array (`src/routes/index.tsx`, commit `afceb7b`). Also noted, not fixed: every real product currently shows **£0.00** ex VAT — genuine incomplete Shopify data (prices not yet set on the live products), not a pricing-logic bug. Full writeup in `DECISIONS.md`'s "Live Shopify Storefront connection established" section.

**Update, 2026-09-13 — critical live-catalogue bugs found and fixed after user UI feedback:** browsing the live site surfaced that "Add to Basket" was silently failing for virtually every real product. Root cause: `getProduct(sku)` relied on Shopify's `products(query: "sku:X")` filter, which this store's search index doesn't honor (verified directly — it silently returns an unfiltered list instead of erroring), and separately double-selected the `variants` field with conflicting arguments (a hard GraphQL error, present since Phase 5, never caught because `CATALOGUE_ADAPTER` was `fixture` until this session). Fixed with a two-phase scan-then-fetch-by-handle approach that doesn't depend on the store's search configuration — verified end-to-end in-browser (real product page renders; a real Add-to-Basket click actually lands in `/basket`). Also removed Shopify's built-in "Availability" and "Price" filters from the facet sidebar (Availability contradicted the site's "Available to order" messaging and rule 10; Price rendered as a broken checkbox), and rebuilt the category/search listing's responsive shell (`FacetLayout`) to match PRD §5.3's breakpoint table — mobile now gets a "Filters & Sort" button opening a full-screen sheet instead of the entire filter list dumped above the product grid. Category page header now uses the `Banner` component per the Design System instead of plain stacked text. Full writeup in `DECISIONS.md`'s "Catalogue UI/data fixes after going live" section.

**Unresolved blockers / risks carried forward:**
- The connected Admin API token needs the `write_draft_orders` scope added (Shopify admin → Settings → Apps and sales channels → Develop apps → the app → Configuration → Admin API scopes → reinstall) before real Draft Order creation will actually succeed — currently fails cleanly and recoverably via the Retry flow.
- Real live products have incomplete data at the individual-SKU level (not per-collection): some show £0.00 ex VAT, some have no product image — genuine store data gaps, not code defects. Worth flagging to the business before Phase 9's bulk-order/quote tooling makes pricing more visible.
- A guest order with no contact email can never get a real Shopify invoice — needs a business decision (require email at guest checkout, or accept phone-follow-up for those orders) before Phase 9 or later.
- PRD §13 Questions 4, 5, 6 unchanged. `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` still unconfigured (Phase 7's blocker, unchanged). Question 1 (catalogue size) is now factually answered (321 SKUs / 12 collections, confirmed live) but "expected growth" remains open.

**Database migrations / environment variables:** no new migration — every column Phase 8 needed already existed from Phase 2's forward-looking schema (`orderRequests.{shopifyDraftOrderId,invoiceUrl,internalNotes,deliveryPence,vatPence,finalTotalPence,nccApprovedByStaffUserId,nccApprovedAt,cancelledReason}`). New environment variable: `ADMIN_COMMERCE_ADAPTER` (optional, default `fixture`). `.env` now has a real `SHOPIFY_ADMIN_ACCESS_TOKEN` and `SHOPIFY_STORE_DOMAIN` set locally (not committed — gitignored as always).

---

## Next phase: Phase 9 — Bulk ordering, quotes and reorder completion

**Phase 9 entry criteria (Phase 8 exit gate, satisfied):** the full NCC-approval → Shopify Draft Order → checkout flow works end-to-end against real data (fixture catalogue, live Admin API); staff authentication and authorization both hold under real testing; the reconciliation design has now proven itself against a genuine Shopify failure; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

```text
Read all context and the Phase 8 handoff. Inspect git status. Implement only Phase 9.

Build the high-speed wholesale tools from PRD §§4, 6.6, 6.8, 6.11 and 6.14:

Bulk order:
- /bulk-order CSV upload and SKU/quantity paste alternative;
- downloadable template;
- up to 500 rows as an implementation default;
- secure server parsing with file-size/type limits;
- matched/unmatched preview where every row receives an outcome and reason;
- add matched rows to basket without silently dropping failures.

Quotes:
- /quote request flow and token/account-based /quote/:id detail;
- requested, quoted, accepted and expired status flow;
- /staff/quotes queue and NCC-admin-only line pricing/issue action;
- explicit customer Accept Quote action;
- accepted quote becomes an order request entering normal NCC review and never skipping approval;
- quote does not imply confirmed availability or create payment obligation before acceptance.

Reorder:
- ensure reorder uses current catalogue identity and current entitled pricing;
- clearly report unavailable/discontinued/unmatched lines rather than silently omitting them.

Test hostile/malformed CSV, duplicate SKU rows, formula injection in exports, over-500 handling, unmatched rows, quote token isolation, quote expiry, repeated acceptance and unauthorized pricing. Run all checks, update records and stop.
```
