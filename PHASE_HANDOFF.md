# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 9 — Bulk ordering, quotes, reorder completion

**Completed scope:** PRD §§4, 6.6, 6.8, 6.11, 6.14 (runbook's own Phase 9 prompt), on branch `phase/9-bulk-quotes`. **Reorder was found already fully shipped** before this phase started — `reorderIntoBasket`, the `reorder` server function, and working "Reorder" buttons on `/account` and `/account/orders` all pre-existed from Phase 2/7's forward-looking work (confirmed by reading, not assumed). This phase's real remaining scope was two verticals: bulk order and quotes.

- **Bulk order** (`/bulk-order`): hand-rolled CSV/paste parser (`server/bulk-order/csv.ts`) — header auto-detection, duplicate-SKU merging by summing quantity, a specific reason per malformed row, a hard 500-row cap returning one whole-file error rather than silently truncating. `previewBulkOrder`/`addBulkOrderLinesToBasket` (`server/bulk-order/bulk-order.ts`) reuse the existing `addLine`, so price/availability re-resolution is never re-derived. Downloadable template at `public/bulk-order-template.csv`; a "Download unmatched rows" export on the preview screen is sanitized against CSV/formula injection (`sanitizeCsvCell`, ADR-029).
- **New adapter capability**: `CatalogueAdapter.getProductsBySku(skus)` (ADR-028) — a single paginated catalogue scan resolving many SKUs at once, used by both bulk order (up to 500 rows) and quote requests (up to 100 lines) instead of calling `getProduct` in a loop, which would have meant hundreds of separate scans. `variantId` was promoted from `ProductDetail` onto `ProductSummary` itself so the batch method can return it.
- **Quotes** (`/quote`, `/quote/:id`, `/staff/quotes`, `/staff/quote/:id`): request form (guest or signed-in buyer, ADR-030 — a standalone line list, not the shopping basket), NCC-admin-only per-line pricing/issue action (mirrors `confirmOrder`'s gate), lazy expiry with no cron job (ADR-031 — checked wherever a quote's status matters, persisted the moment it's observed), and an explicit customer "Accept Quote" action that converts the quote into a real order re-entering the standard review pipeline unchanged (ADR-032 — guest → `awaiting_ncc_review`, buyer → `awaiting_company_approval`, never skipping either; Phase 8's confirm/Shopify-sync flow needed zero changes). Added a `sku` column to `quoteLines` (migration `0002_pale_mercury.sql`) — the same gap Phase 8 would have hit, since the catalogue adapter has no by-variant-id lookup.
- Every server module (`quote-view.ts`, `submit-quote-request.ts`, `staff-quote-queue.ts`, `quote-pricing.ts`) mirrors its order-side equivalent from Phase 7/8 line-for-line — same authorization functions (`canViewCompanyResource`/`isNccAdmin`), same guest-token mechanism, same `db.transaction` atomicity pattern.

**A real routing bug found and fixed:** `routes/quote.tsx` (a flat file) silently became an implicit parent layout for `routes/quote/$id.tsx` once the `quote/` directory existed as a sibling — TanStack Router's generated route tree nested `QuoteIdRoute` under `QuoteRoute`. Since the parent had no `<Outlet/>`, a real guest quote link showed the *correct browser tab title* (title generation runs per matched route independently) but the *wrong page content* (still the parent's request form) — a confusing silent mismatch, not a crash. Found by manually following a real guest quote link end-to-end, not by the test suite (route-tree nesting isn't something a server-side unit test exercises). Fixed by moving the file to `routes/quote/index.tsx`, the same convention this codebase already used for the identical `account.tsx`-vs-`account/*.tsx` shape. Verified fixed by rebuilding, checking the regenerated route tree, and re-running the full flow in-browser.

**Files created/changed:** see `TASKS.md` Phase 9 checklist. New modules: `server/bulk-order/{csv,bulk-order,server-functions}.ts`, `server/quotes/{quote-view,submit-quote-request,staff-quote-queue,quote-pricing,server-functions,staff-quote-server-functions}.ts`; new routes `bulk-order.tsx`, `quote/index.tsx`, `quote/$id.tsx`, `quote-submitted.tsx`, `staff/quotes.tsx`, `staff/quote/$id.tsx`; new component `components/ui/QuoteDetail.tsx`; new static asset `public/bulk-order-template.csv`. Also touched: `db/schema.ts` (`quoteLines.sku` + migration), `integrations/shopify/types.ts`/`storefront-adapter.ts`/`fixture-adapter.ts`/`index.ts` (`getProductsBySku`, `variantId` promoted onto `ProductSummary`), `validation/commands.ts` (`bulkOrderCsvSchema`, `addBulkOrderLinesSchema`, `quoteRequestSchema`, `issueQuoteSchema`, `acceptQuoteSchema`), `components/ui/Header.tsx` (nav links). `DECISIONS.md` (ADR-028 through ADR-032, the routing-bug writeup).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm typecheck  → tsc --noEmit, no output, exit 0
$ pnpm lint       → eslint ., no output, exit 0
$ pnpm test       → Test Files 50 passed (50), Tests 371 passed | 1 skipped (372)
$ pnpm build      → client + SSR bundles both built successfully
```
Client bundle re-swept post-build for every known secret literal — clean.

Manual, via the Browser tool against `pnpm dev` with the live Shopify catalogue connected: bulk-ordered a CSV mixing a real SKU, an unknown SKU, and a malformed row — preview correctly showed one matched line with real title/price (Charger - C20 20W USB-A+C, £2.00), both bad rows flagged with specific reasons ("Expected two columns...", "Unknown SKU — not found in the catalogue"), and the matched line landed in the real `/basket`. Requested a quote as a guest for a real SKU (B1190001); the private link correctly showed "Requested" status. Signed in as the seeded NCC admin (`fixture.ncc-admin`) at `/staff-login`, found the quote in `/staff/quotes`, priced it at £1.75/unit and issued it — status moved to "Quoted" with an expiry date shown. As the guest, followed the same link again: now showed "Quoted... valid until [date]" with an "Accept quote" action. Accepted it — redirected to a real "Order Submitted" confirmation with a fresh guest order link; followed that link and confirmed the resulting order at `/order/:id` shows "Awaiting NCC Review" with the exact quoted price (£1.75) carried through. Confirmed on the staff side that the quote's own status now reads "Accepted".

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 9 decisions and facts" (ADR-028 through ADR-032) plus the routing-bug write-up immediately after.

**Unresolved blockers / risks carried forward (unchanged from Phase 8, still open):**
- The connected Admin API token still needs the `write_draft_orders` scope added before real Draft Order creation succeeds — fails cleanly and recoverably via the existing Retry flow either way (unaffected by this phase — a quote-accepted order goes through the exact same Phase 8 pipeline).
- Real live products still have incomplete data at the individual-SKU level: some show £0.00 ex VAT, some have no product image — genuine store data gaps, not code defects.
- A guest order with no contact email can never get a real Shopify invoice — a guest-originated quote has the same exposure once accepted, since `acceptQuote` copies the quote's own (possibly absent) contact fields straight onto the new order. Still needs the same business decision as before (require email at guest checkout/quote, or accept phone-follow-up).
- No `/account/quotes` list page was built — PRD's own Phase 9 prompt asks for "`/quote` request flow and token/account-based `/quote/:id` detail," not a listing page, and `listQuotesForActor` (built, tested, unused by any route) is ready whenever one is wanted. A signed-in buyer currently reaches their own quote only via the link shown right after submitting it.
- PRD §13 Questions 4, 5, 6 unchanged. `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` still unconfigured (Phase 7's blocker, unchanged).

**Database migrations / environment variables:** one new migration (`0002_pale_mercury.sql`, adds `quote_lines.sku`). No new environment variables.

---

## Next phase: Phase 10 — Returns and support cases

**Phase 10 entry criteria (Phase 9 exit gate, satisfied):** bulk order and quotes both work end-to-end against live Shopify data; an accepted quote correctly re-enters the exact same NCC-review/Shopify-sync pipeline Phase 8 built, unchanged; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

```text
Read all context and the Phase 9 handoff. Inspect git status. Implement only Phase 10.

Build returns and support as first-class trackable workflows from PRD §§4 and 6.16–6.21.

Returns:
- /returns reachable with confirmed-order context, never as an unbound return;
- eligible line and quantity picker, reason, optional note/photo;
- /returns/:id token/account status timeline;
- /account/returns history;
- /staff/returns queue and approve/reject/refund/replacement actions;
- current Shopify native return/refund integration where applicable.

Support:
- /support ticket form for guests and accounts;
- category, optional order/return reference, message and optional attachment;
- /support/:id private status timeline and reply thread;
- /staff/support queue, replies, internal notes, statuses and escalation action.

Use the same case-view component family for return and support status. Validate attachments by content, size and type; store them privately; scan or quarantine according to the selected infrastructure; serve through authorized expiring access. Never rely on email as the only status record.

Where return policies or support SLAs remain unanswered in PRD §13, implement configuration points and safe neutral states rather than inventing business policy.

Test order/line eligibility, return quantity limits, cross-tenant and token isolation, attachment attacks, staff authorization, timeline announcements for assistive technology, invalid transitions and Shopify refund failure recovery. Run all checks, update records and stop.
```
