# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 3 — Shopify connectivity and catalogue adapter

**Completed scope:** real Shopify connectivity behind the typed boundaries Phase 2 defined, under `ncc-supply/src/server/integrations/shopify/`, on branch `phase/3-shopify-catalogue`. Continued in the same session as Phase 2 at the user's explicit direction to build quickly and take any in-scope free Shopify access needed. No routes/UI beyond one dev-only diagnostic route.

- **`http-client.ts`** — one shared low-level GraphQL requester for both Storefront and Admin clients: `AbortController` timeout, bounded retry-with-backoff on network failure/429/`THROTTLED`, typed `ShopifyApiError` (`errors.ts`), logs that never include headers/tokens/variables.
- **`storefront-client.ts`** + **`storefront-adapter.ts`** — real `CatalogueAdapter`, GraphQL shapes verified against `shopify.dev/docs/api/storefront/2026-07` this session (not guessed): `getCollection`, `getProduct` (SKU search syntax), `search`, `suggest` (`predictiveSearch`). Never selects inventory/stock fields.
- **`cache.ts`** — in-memory TTL memoization wrapping the live adapter's collection/product calls.
- **`admin-client.ts`** + **`admin-adapter.ts`** — real `AdminCommerceAdapter`: `createDraftOrder`/`sendDraftOrderInvoice`/`approveReturn`, all three mutations verified against the live Admin GraphQL schema this session. No live mutation is ever fired in this phase — contract-tested via mocked fetch only.
- **`customer-account-adapter.ts`** — real OIDC discovery + PKCE `login()`/`authorize()`; `getReturnEligibility`/`requestReturn` explicitly deferred to Phase 10 (need a real authenticated session to mean anything).
- **`health.ts`** + **`/dev/shopify-health`** — connectivity-only diagnostics, no credential exposure; manually verified in-browser (`pnpm dev`), showing `{configured: false, ok: false}` for both adapters since no live token is configured yet.
- **`index.ts`** — `getCatalogueAdapter()` factory, gated by the new `CATALOGUE_ADAPTER` env var (`fixture` default / `live`); the single import point every later phase should use.
- **`types.ts` additions** — `AdminCommerceAdapter`/`CustomerAccountAdapter` promoted from doc-sketch to real TypeScript (see ADR-013 for one intentional divergence from the original sketch); `PaginationOpts` changed from `{page, perPage}` to cursor-based `{first, after?}` (ADR-012 — Shopify has no page-number concept, and nothing outside the fixture adapter depended on the old shape yet).

**Files created/changed:** see `TASKS.md` Phase 3 checklist for the exhaustive list with per-item evidence. Also touched: `fixture-adapter.ts`/`.test.ts` (updated to cursor pagination), `env.ts` + `.env.example` (5 new Shopify env vars, all optional so the app still boots with zero Shopify credentials), `docs/integration-contracts.md` (aligned to what was actually built), `DECISIONS.md` (ADR-012, ADR-013, verified-facts list, the blocked-token-provisioning note), `.claude/launch.json` (new — lets the Browser tool preview `pnpm dev` on port 3000).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm test        → Test Files 26 passed (26), Tests 165 passed | 1 skipped (166)
$ pnpm typecheck   → tsc --noEmit, no output, exit 0
$ pnpm lint        → eslint ., no output, exit 0
$ pnpm build       → client + SSR bundles both built successfully, /dev/shopify-health included
```
The one skipped test is `storefront-adapter.smoke.test.ts`'s real-network case — it no-ops with a logged reason rather than failing, since no live Storefront token is configured (see blocker below). Manually verified `/dev/shopify-health` in a real browser via `pnpm dev`: renders `{"storefront":{"configured":false,"ok":false},"admin":{"configured":false,"ok":false}}`, matching fixture-mode expectations exactly.

**Blocker, recorded precisely per CLAUDE.md rule 25:** the user authorized taking any free, in-scope Shopify access needed. I attempted to self-provision a live Storefront API access token via the `storefrontAccessTokenCreate` Admin mutation — the connected MCP tool's own safety policy refused it outright (`access_escalation`, not a cost question). This doesn't block anything: `CATALOGUE_ADAPTER` defaults to `fixture`, a complete and fully tested path. To switch on live data: Shopify admin → Sales channels → Headless (free) → Create storefront → copy the token into `ncc-supply/.env` as `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, plus `SHOPIFY_STORE_DOMAIN=9nd0we-wt.myshopify.com` and `CATALOGUE_ADAPTER=live`. See `DECISIONS.md` for the full writeup.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 3 decisions and facts" section (ADR-012, ADR-013, the verified Shopify facts list, the blocked-provisioning note).

**Unresolved blockers / risks carried forward:** the Storefront token blocker above (not blocking, just not yet live). PRD §13 Questions 1, 4, 5, 6 unchanged — none block Phases 4/5.

**Database migrations / environment variables:**
- No new migrations this phase.
- New env vars (all optional, `.env.example` updated): `CATALOGUE_ADAPTER`, `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`, `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`.

---

## Next: Phase 4 (public shell/homepage) then Phase 5 (catalogue/search) — same session, per the user's "merge phases for speed" direction

Per the user's explicit instruction this session, Phases 4 and 5 are being built immediately following Phase 3 without stopping for a fresh session — separate commits per phase (`phase/4-public-home`, `phase/5-product-discovery`) keep the work reviewable. This file will be updated again once both are complete. The runbook's standard prompts for those phases (for reference, or if a fresh session ever needs to resume this work):

**Phase 4 entry criteria (Phase 3 exit gate, satisfied):** typed Storefront/Admin/Customer-Account boundaries exist and are contract-tested; fixture adapter remains the safe default; no live mutation was ever fired; health diagnostics exist with no credential exposure; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

```text
Read CLAUDE.md, the two NCC source documents, the plan, tasks, decisions and last handoff. Inspect git status. Implement only Phase 4.

Build the public application shell and homepage from PRD §§3, 5 and 6.1 and the complete NCC design system, using getCatalogueAdapter() from src/server/integrations/shopify/index.ts for any real data.

Implement:
- sticky announcement/header/navigation/category rail;
- global search entry, basket indicator, account entry and always-visible Help / Report an issue action;
- responsive mobile navigation with focus management and keyboard support;
- footer with no exposed staff login link;
- homepage hero, trust stats, Shop By Category, Popular This Month, How It Works and FAQ/CTA sections;
- reusable Header, Footer, ProductCard, CategoryCard, CategoryGrid, OrderSteps and FAQ components;
- explicit empty/error/loading states for every adapter-backed section;
- the gradient/mesh placeholder treatment where real imagery is unavailable;
- responsive layout at all required breakpoints;
- home metadata plus Organization, WebSite/SearchAction and FAQ structured data where valid.

Do not invent testimonials, reviews, stock claims, delivery promises or real product content. Keep placeholder copy clearly non-production and data-driven.

Test keyboard navigation, mobile menu behaviour, focus states, reduced motion, no-data behaviour and structured-data output. Perform visual checks at 375, 768, 1024 and 1440 px. Run all checks, update handoff files and stop (or continue directly into Phase 5 if the session's standing instruction to merge phases still applies).
```

**Phase 5 prompt** (runbook §8, unchanged) follows immediately after Phase 4 in this session: `/categories`, `/category/:slug`, `/search`, `/product/:sku` — collection browsing, typeahead, facets, sort, pagination (cursor-based, per ADR-012), mobile filter sheet, breadcrumbs, canonical/noindex rules, Product/ItemList/Breadcrumb structured data.
