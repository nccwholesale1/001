# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 5 — Catalogue, search and product discovery

**Completed scope:** the four catalogue-discovery routes from PRD §§3, 6.2–6.4, on branch `phase/5-product-discovery`. Continued in the same session as Phases 3–4, per the user's standing "build quickly, merge phases" direction — this was the last phase in that batch; Phase 6 (basket/guest order-request) is a bigger, security-sensitive vertical slice, so this session stops here to check in rather than silently continuing, per the plan agreed at the start of Phase 3.

- **`routes/categories.tsx`** — full catalogue index, real `listCollections()` data, ItemList structured data.
- **`routes/category/$slug.tsx`** — collection listing: breadcrumb, real line count + "all available to order" header, facet sidebar, sort, cursor-based pagination, product grid, honest empty state, canonical always pointing to the unfiltered URL, `noindex` on zero results, BreadcrumbList + ItemList structured data.
- **`routes/search.tsx`** — full-catalogue search with the same facet/sort/pagination machinery, real `totalCount` from Shopify (not the current page length), typeahead, same SEO treatment as collections.
- **`routes/product/$sku.tsx`** — gallery, specs, real price, inert quantity/Add-to-basket control (Phase 6's job to wire up for real), `notFound()` for an unknown SKU, `Product` structured data with `PreOrder` availability.
- **New shared components:** `FacetSidebar`, `Pagination`, `Breadcrumbs`, `SearchBar` (typeahead with full keyboard support).
- **ADR-015/016:** facet/sort/pagination state lives entirely in plain, crawlable URL query params (no client JS required for filtering to work); pagination is Previous/Next rather than numbered, and the facet sidebar stacks inline on mobile rather than behind a "Filters" sheet — both documented, deliberate simplifications given the catalogue's current size, not oversights.
- Added real `lineCount`/`totalCount` to `CollectionResult`/`SearchResult` — computed via an aliased GraphQL field (collections, which have no native count) or Shopify's actual `totalCount` field (search, which does) — never fabricated.

**Files created/changed:** see `TASKS.md` Phase 5 checklist for the exhaustive list with per-item evidence. Also touched: `types.ts`/`fixture-adapter.ts`/`storefront-adapter.ts` (`lineCount`/`totalCount`), `DECISIONS.md` (ADR-015, ADR-016, two verification notes).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm test        → Test Files 30 passed (30), Tests 214 passed | 1 skipped (215)
$ pnpm typecheck   → tsc --noEmit, no output, exit 0
$ pnpm lint        → eslint ., no output, exit 0
$ pnpm build       → client + SSR bundles both built successfully
```
Manual, via the Browser tool against `pnpm dev` with real fixture data: `/categories` (real line counts), `/category/chargers` (sort links change the URL and re-render without error, facet sidebar correctly shows "No filters available" honestly rather than fabricating any), `/search?q=fixture` (2 real results, correct `totalCount`), `/search?q=<nonsense>` (confirmed `noindex` meta tag present), `/product/FIXTURE-CHG-001` (real data + correct `Product` JSON-LD, confirmed via `document.querySelector`), `/product/NOT-A-REAL-SKU` (confirmed the app's NotFound boundary renders), canonical tag on a filtered category URL confirmed pointing back to the bare `/category/chargers`, mobile (375px) layout confirmed usable end-to-end.

One interaction (`SearchBar`'s Enter-to-navigate-to-highlighted-suggestion) couldn't be confirmed via the Browser tool's synthetic keyboard event — traced to that tool sending a non-standard `KeyboardEvent` (`event.key === "Unidentified"` instead of `"Enter"`), confirmed via a temporary debug marker showing all application state was correct at the moment of the keypress. Verified instead with a real `@testing-library/user-event` test, which dispatches a spec-correct event and passes. See `DECISIONS.md` for the full note.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 5 decisions and facts" (ADR-015, ADR-016, the two verification notes).

**Unresolved blockers / risks carried forward:** the Phase 3 Storefront-token blocker is unchanged (still fixture-mode by default). PRD §13 Questions 1, 4, 5, 6 unchanged. Question 1 (catalogue growth) is the one to watch if it ever makes ADR-016's pagination/facet-sheet simplifications feel cramped.

**Database migrations / environment variables:** none new this phase.

---

## Next phase: Phase 6 — Basket and guest order-request vertical slice

This is a genuinely bigger, security-sensitive vertical slice (real mutations, idempotency, token-gated guest access, server-side price trust) rather than UI composition over an existing adapter — per the plan agreed at the start of Phase 3, the session stops here for a check-in rather than continuing automatically.

**Phase 6 entry criteria (Phase 5 exit gate, satisfied):** all four discovery routes are real and data-driven; facet/sort/pagination state is shareable and crawlable; structured data and canonical/noindex rules are correct; empty states never fabricate products; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

**Exact next-phase prompt** (runbook §9, unchanged — paste when ready to proceed, fresh session or continuing this one):

```text
Read all context and the Phase 5 handoff. Inspect git status. Implement only Phase 6.

Build a complete guest basket-to-order-request vertical slice from PRD §§4, 6.5 and 6.7, stopping before real payment.

Implement:
- add/update/remove basket lines;
- persistent guest basket using the agreed safe approach;
- any-positive-integer quantity validation with no MOQ or maximum business limit;
- server-side product/price lookup and total calculation (never trust a client-supplied price — CLAUDE.md rule 9, and the .strict() Zod schemas already in src/server/validation/commands.ts);
- ex-VAT subtotal plus clear copy that delivery and VAT are confirmed later;
- contact details and accessible validation;
- idempotent "Submit basket" action (src/server/idempotency/idempotency.ts already exists) whose copy never says Pay or Checkout;
- an app-owned submitted order request in awaiting_ncc_review state (src/server/domain/status.ts's transitionOrderRequest already exists);
- a secure guest status URL (src/server/tokens/token-service.ts already exists) and /order-submitted confirmation;
- token-gated /order/:id status/detail view;
- original-versus-confirmed quantity model, even though approval comes later;
- noindex/security headers appropriate to private routes.

Do not create a payable Shopify order, capture card data, send a payment link or expose checkout. Do not accept prices/totals/status from browser state.

Test tampered prices, invalid quantities, repeated submit, token failure, ID enumeration, expired/revoked token, basket restoration, and responsive/keyboard behaviour. Run all checks, update tracking documents and stop.
```
