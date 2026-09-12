# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 4 — Public shell and homepage

**Completed scope:** the public application shell (Header/Footer) and the real homepage from PRD §§3, 5, 6.1, on branch `phase/4-public-home`. Continued in the same session as Phase 3, per the user's standing "build quickly, merge phases" direction.

- **`components/ui/Header.tsx`** — sticky, announcement strip, logo, primary nav, icon row (search/help/basket/account — Help always visible, never hidden behind the mobile menu), a real category rail sourced from `listCollections()` via a root-route loader, and a mobile hamburger menu with Escape-to-close + focus-return, all plain anchors (no typed route yet exists for most destinations — intentional, documented in-file).
- **`components/ui/Footer.tsx`** — `bg-ink`/`text-ink-foreground`, 4-column link grid, no staff-facing link anywhere.
- **`components/ui/ProductCard.tsx`**, **`CategoryCard.tsx`**, **`CategoryGrid.tsx`** (searchable/filterable), **`OrderSteps.tsx`**, **`FAQ.tsx`** — all new, all consuming real `CatalogueAdapter` types, not invented shapes.
- **`routes/index.tsx`** — the real homepage: hero (reusing Phase 1's `Banner`), four trust stats, Shop By Category, Popular This Month (explicitly documented as a real-data sample, not a fabricated popularity ranking — no such analytics source exists), How It Works, FAQ + CTA banner, Organization/WebSite-SearchAction/FAQPage structured data. A server function (`getHomeData`) fetches everything through `getCatalogueAdapter()` with explicit try/catch → distinct error state, never a crash.
- **`routes/__root.tsx`** — now renders `<Header>`/`<Footer>` around every route via a root-level loader for the category rail.
- **ADR-014**: added `CatalogueAdapter.listCollections()` — a real gap in the Phase 2/3 interface (there was no way to list all collections at all) discovered while building this phase, not scope creep. Implemented for both fixture and live adapters; the Storefront API's `Collection` type turned out to have no product-count field at all (verified against the real docs, not assumed) so the live implementation counts real products directly.

**Files created/changed:** see `TASKS.md` Phase 4 checklist for the exhaustive list with per-item evidence. Also touched: `types.ts`/`fixture-adapter.ts`/`storefront-adapter.ts`/`index.ts` (the `listCollections` addition), `DECISIONS.md` (ADR-014 + a manual-verification note about a dev-only tooling artifact).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm test        → Test Files 29 passed (29), Tests 197 passed | 1 skipped (198)
$ pnpm typecheck   → tsc --noEmit, no output, exit 0
$ pnpm lint        → eslint ., no output, exit 0
$ pnpm build       → client + SSR bundles both built successfully
```
Manual: ran `pnpm dev` via the Browser tool, confirmed real fixture data end-to-end (category rail shows Chargers/Screen Protectors with correct "1 LINE" counts, Popular This Month shows the real fixture charger at £12.99, all 6 FAQ items render) at 375×812, 1024×900, and 1440×900. Confirmed keyboard Tab order reaches the mobile-menu toggle correctly and `document.activeElement` matched the "Open menu" button. Confirmed the homepage's JSON-LD (`Organization`/`WebSite`/`FAQPage`) via `document.querySelectorAll('script[type="application/ld+json"]')` in the live page — content matched exactly.

One caveat: the dev-only TanStack Devtools trigger visually overlapped the hamburger button in the mobile-viewport preview, blocking a couple of mouse-click checks — confirmed as a dev-only artifact (production build log shows devtools code is stripped entirely), so the toggle/Escape/focus-return behavior was verified via keyboard + `Header.test.tsx` instead. See `DECISIONS.md` for the full note.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 4 decisions and facts" (ADR-014, the devtools-overlay note).

**Unresolved blockers / risks carried forward:** the Phase 3 Storefront-token blocker is unchanged (still fixture-mode by default, not blocking). PRD §13 Questions 1, 4, 5, 6 unchanged — none block Phase 5.

**Database migrations / environment variables:** none new this phase.

---

## Next: Phase 5 (catalogue/search/discovery) — same session, continuing per the user's merge-phases direction

**Phase 5 entry criteria (Phase 4 exit gate, satisfied):** public shell renders on every route; homepage is real, data-driven, no fake content; keyboard/focus/reduced-motion behavior confirmed; structured data confirmed correct; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

```text
Read CLAUDE.md, the two NCC source documents, the plan, tasks, decisions and last handoff. Inspect git status. Implement only Phase 5.

Build the catalogue discovery routes and reusable search/filter system from PRD §§3, 6.2–6.4, 7.5 and 9, using getCatalogueAdapter() from src/server/integrations/shopify/index.ts:
- /categories — full catalogue index, using the same listCollections() data as the homepage's Shop By Category;
- /category/:slug — collection listing with facet filters, sort, cursor-based pagination (ADR-012 — no page numbers);
- /search — server-backed full-catalogue search with the same facet/sort/pagination machinery, typeahead suggestions (suggest());
- /product/:sku — product detail, gallery, specs, quantity input (no add-to-basket wiring yet — Phase 6's job, keep it visually inert like the homepage's ProductCard).

Implement brand/category/compatibility/grade facets, shareable URL state, result counts, applied-filter chips, clear-all, mobile full-screen filter sheet, breadcrumbs, and correct empty states without fake products. "Available to order" only — never stock counts or delivery promises; no contract-pricing UI (ADR-005 — uniform pricing for everyone).

Add canonical tags for filtered pages, noindex for empty-result facet combinations, and Product/ItemList/BreadcrumbList structured data.

Test URL round-tripping, filtering, sorting, pagination boundaries (cursor-based), empty/error states, typeahead keyboard behaviour, and mobile filter-sheet focus trapping. Visually verify all four breakpoints. Run all checks, update tracking documents and stop — or continue directly into Phase 6 only if explicitly told to; Phase 6 (basket/guest order-request) is a larger, security-sensitive vertical slice worth a fresh check-in first.
```
