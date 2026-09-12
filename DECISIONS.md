# NCC Supply — Decisions

## Confirmed decisions (ADR-style)

### ADR-001: Headless TanStack Start, no Shopify theme
**Decision:** The frontend is a headless TanStack Start application. A native Shopify theme deployment is not built now and isn't precluded later if requested.
**Source:** PRD §7.3 — stated as adopted, not open.
**Status:** Confirmed, not revisitable within this build without a new PRD version.

### ADR-002: Shopify/backend split of responsibility (revised 2026-09-12)
**Decision:** Shopify owns catalogue, the confirm-then-invoice flow (Draft Orders + `draftOrderInvoiceSend`), and native self-serve returns. The custom application backend owns companies, buyers, locations, spend limits, the two-stage approval workflow, NCC staff accounts, quotes, and support/complaint tickets.
**Source:** PRD §7.1 / §7.2, **amended by business decision 2026-09-12** (see ADR-005/006 below) — this supersedes PRD §7.1's original assumption that Shopify's native B2B "Companies" object is the system of record for companies/buyers/locations. That assumption is dropped because it was only load-bearing for contract/tier pricing, which this build does not need.
**Status:** Confirmed as revised. Verified during Phase 0 that `draftOrderInvoiceSend` is a real, current Admin GraphQL mutation, so the confirm-then-invoice mechanism this decision depends on is sound as specified.

### ADR-003: Buyer identity split (revised 2026-09-12)
**Decision:** Guest identity is entirely app-owned (token-gated link) and never touches Shopify accounts. A company buyer who wants Shopify-native self-service (native returns) signs in with Shopify's own passwordless **new customer accounts** flow — a plain customer account, not a B2B company-linked one, since there is no B2B object anymore (ADR-002/006). Company/buyer grouping, roles, and spend limits live entirely in the app DB and are correlated to the Shopify customer by email/ID. The application does not build its own buyer password system — only NCC-internal staff auth is custom.
**Source:** PRD §7.4, amended per ADR-002/006.
**Status:** Confirmed as revised.

### ADR-005: Uniform pricing, no contract tiers
**Decision:** All buyers — guest or company — see the same list pricing already loaded on the products (the 195 priced / 121 pending-price SKUs from the earlier catalogue work). There is no company- or buyer-specific contract/tier pricing anywhere on this site.
**Source:** Business decision, 2026-09-12. Resolves PRD Open Questions 2 and 3.
**Effect:** No Shopify price lists are created or needed. `/account/pricing` (PRD §6.13) becomes a simple read-only display of standard list pricing — not a differentiated-tier lookup. Removes the 3-price-list-cap concern entirely.

### ADR-006: No Shopify B2B "Companies" object
**Decision:** Companies, buyer users, and company-admin approval are modeled entirely in the app database (already the plan for approval/status in `docs/domain-model.md`). Shopify is not asked to hold a B2B "Companies" record at all.
**Source:** Direct consequence of ADR-005 — the only reason PRD §7.1 reached for Shopify B2B was contract pricing and native reorder/returns convenience. With no contract pricing, and returns/reorder already planned as app-level flows (PRD §6.11, §6.16), there's nothing left that needs the B2B object.
**Effect:** Resolves the Phase-0 risk under Open Question 8 below — Admin API access to B2B-specific resources (which Shopify restricts to dev stores/Plus Partners/affiliates) is no longer something this build depends on at all.

### ADR-007: Sales-rep account verification mechanism
**Decision:** An NCC admin creates a sales-rep account manually, including the required employee ID (PRD §6.22's existing gate — format/uniqueness check, no third-party KYC, unchanged). "Verification" beyond that ID check is satisfied by the sales rep's first successful sign-in via their email — proving they control that inbox is the activation trigger, not a separate identity-check step or document upload.
**Source:** Business decision, 2026-09-12. Resolves PRD Open Question 7.
**Implementation note for Phase 11:** this means the sales-rep account's `pending_id_verification` → `active` transition (see `docs/domain-model.md`) fires on first successful authenticated login, not on a separate admin action after creation.

### ADR-004: Recommended technical defaults (implementation-level, not business decisions)
The PRD deliberately leaves several implementation choices open. Per the build runbook's own instruction, these get a recommended default now rather than blocking Phase 0 — but they are assumptions, not confirmed business decisions, and should be revisited if a stated reason emerges:

| Item | Default | Why |
|---|---|---|
| Package manager | pnpm | Fast, disk-efficient, standard in the TanStack ecosystem |
| Database | ~~Postgres~~ **SQLite via libSQL** (revised Phase 2, 2026-09-12 — see note below) | Works on every likely host; strong fit for the relational approval/audit model in §7.2 |
| ORM | Drizzle | Typed, lightweight, integrates cleanly with TanStack Start server functions |
| Deployment target | Not yet chosen (Vercel or a Node-friendly host) | No cost/ops implication until nearer Phase 14 — deliberately deferred, not defaulted |
| Staff auth | Hand-rolled scrypt password + opaque session token (revised Phase 2 — see note below) | Internal tool only; company buyers already use Shopify's flow (ADR-003) |
| File storage | S3-compatible (e.g. Cloudflare R2) | Private objects, expiring authorized access, needed for return/support attachments |
| Email delivery | Resend | Transactional guest-token links and staff notifications |
| Test tooling | Vitest + Testing Library (unit/component), Playwright (E2E) | Matches TanStack Start's usual toolchain; Playwright suits the multi-role acceptance matrix in Phase 14 |

---

## Phase 1 decisions and facts (2026-09-12)

### ADR-008: Light mode only, no automatic OS dark-mode switching
**Decision:** Both light and dark tokens are defined in `src/styles.css` (per the design system's own §2 "Dark" spec and the Phase 1 prompt's instruction to define both), but only light tokens render, unconditionally. There is no `@media (prefers-color-scheme: dark)` auto-switch and no `.dark` class is ever set by any code in this codebase.
**Why this needed a fix mid-phase:** My first pass *did* auto-apply dark tokens when the visitor's OS/browser preferred dark, reasoning that "define both, don't add a public toggle" implied respecting system preference automatically. The user caught this immediately when their own dark-mode OS setting made the site render dark. The design system's actual stated principle (§1: "Light, tech-forward, high clarity... white and near-white surfaces... **no dark hero**") means light is the product's actual look, not a default awaiting a toggle. Corrected: dark tokens stay defined and ready (so a future manual toggle, if ever requested, has tokens to switch to) but nothing activates them today. `color-scheme: light` is also set explicitly so browser-native chrome (scrollbars, form controls) doesn't follow the OS preference either.
**Also fixed in the same pass:** `--gradient-surface` and `--gradient-hero` were hardcoded to light-only OKLCH literals, so — before this fix — if dark mode ever *had* activated, card titles would have rendered near-invisible (light text on a gradient that stayed light-coloured). Now derived from `var(--card)`/`var(--background)`/`var(--sky-soft)`/`var(--accent)` so they'd track the active theme correctly if dark mode is ever turned on later. Found via the required visual breakpoint check, not by inspection.

### ADR-009: No Storybook — dev-only in-app preview route
**Decision:** `/dev/components` (noindex) renders every primitive in every state for human visual review. No Storybook or similar tool was added.
**Why:** The Phase 1 prompt only asks for a preview surface "if Phase 0 selected it" (it didn't) and instructs adding "only dependencies justified by this phase." Storybook is a materially heavier addition than a single dev-only route, which TanStack Start's own file-based routing already provides for free. Automated behavioural assertions (focus, disabled state, aria attributes) live in Vitest/Testing Library component tests instead, per-primitive.

### Facts recorded from the actual scaffold (not pre-guessed in Phase 0)
- Scaffolding tool: `npx @tanstack/cli create` (current, verified against official docs — not an older `create-tsrouter-app` invocation).
- The default scaffold did **not** include a test stack or linting despite general TanStack docs suggesting it might — Vitest, Testing Library, ESLint (flat config, with `eslint-plugin-jsx-a11y` for accessibility linting), and Prettier were all added explicitly in Phase 1, matching the ADR-004 recommendation.
- Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-slot`) was added for the Dialog/Sheet primitive specifically — hand-rolling accessible focus-trap/restore behaviour correctly is exactly the kind of thing a battle-tested primitive is worth a small dependency for; no other Radix packages were added (Disclosure uses native `<details>/<summary>` per the design doc, no library needed).
- `class-variance-authority`, `clsx`, `tailwind-merge` added as small, standard variant/class-composition utilities used across every primitive.
- pnpm itself was not installed on the build machine and had to be installed globally first (`npm install -g pnpm`).

### ADR-010: Banner uses gradient only, no grid-mesh; separate BannerCarousel added
**Decision:** The design system's original "Product banner" spec (§7) called for `hero-gradient` + a `grid-mesh` overlay at 40% opacity. Per explicit business direction 2026-09-12, the `Banner` primitive's background is gradient-only — no mesh overlay. `grid-mesh` remains a defined, available utility for other decorative use (demonstrated on its own in `/dev/components`); it's just not part of the banner treatment.

A separate `BannerCarousel` component was also added, reusing `Banner` internally for each slide so the visual language stays identical between a single static banner and a rotating one ("keep the same UI"). Per the request, **whether anything actually uses the carousel (vs. a single Banner) is an explicit open design decision for a later phase** — most likely Phase 4 when the real homepage is built. Both components exist, are tested, and are visible in `/dev/components`, but neither is wired into any real page yet (there is no real page yet to wire it into).

**Carousel implementation notes:** hand-rolled rather than a library dependency (e.g. embla) — the requirement (fixed slide set, prev/next, dot nav, optional autoplay, keyboard arrows) didn't justify a new dependency. Accessible per the WAI-ARIA APG carousel pattern: `role="region"` + `aria-roledescription="carousel"`, each slide `aria-roledescription="slide"`, a visually-hidden live region announcing slide position, autoplay pauses on hover/focus and is skipped entirely under `prefers-reduced-motion`. jsdom has no `window.matchMedia` implementation at all, which the reduced-motion check depends on — a minimal stub was added to `vitest.setup.ts` (defaults to "no preference") rather than working around it per-test.

## Phase 2 decisions and facts (2026-09-12)

### ADR-004 revision: Database moved from Postgres to SQLite via libSQL
**Decision:** The app database is SQLite, accessed through `@libsql/client` + `drizzle-orm/libsql`, a single local file (`DATABASE_FILE` env var).
**Why:** ADR-004's original Postgres default assumed a locally runnable Postgres or Docker; this build machine has neither. The dependency chain was checked in order, not assumed: `better-sqlite3` (the obvious Drizzle-native choice) requires a native compile step and this machine has no Python/build tools at all, so that path is not just blocked by policy but physically impossible here; Node's built-in `node:sqlite` works standalone but Drizzle's current stable release (0.45.x on npm's `latest` tag) has no `node-sqlite` export — that binding only exists on Drizzle's pre-1.0 beta/rc tags, not something to pin a foundational dependency to. `@libsql/client` ships prebuilt native bindings (no compile step) and is present in Drizzle's stable exports, and works identically as a local file via a `file:` URL — no server or hosted account required for dev, with a real path to a hosted libSQL/Turso instance later if ever needed.
**Effect:** No behavior change to the schema or domain logic — Drizzle's SQLite dialect is used either way. Revisit at Phase 14 (deployment) only if a concrete hosting reason favors Postgres; nothing in the current design depends on a Postgres-specific feature.
**Verified:** `drizzle-kit generate` produced a clean migration; `pnpm db:migrate` applied it to a real file and all 19 tables were confirmed present via a direct query before the test artifact was deleted.

### ADR-011: Staff sessions and guest tokens both store only a hashed bearer credential
**Decision:** `staff_sessions` stores `token_hash` (SHA-256 of a random 32-byte token), not the raw token itself as its primary key — the same non-enumerable, hash-only pattern already planned for `guest_tokens` (CLAUDE.md rule 16). A shared helper (`src/server/shared/opaque-token.ts`) generates and hashes tokens for both.
**Why:** The initial schema draft gave `staff_sessions` a plain random `id` used directly as the bearer credential — functionally fine, but inconsistent with the guest-token design and one degree less defensive (a leaked row would be directly replayable, not just a lookup key). Caught and fixed before the first migration was generated, so no data migration was needed.
**Effect:** `verifySession`/`invalidateSession` (`src/server/auth/session.ts`) and `verifyGuestToken`/`revokeGuestToken` (`src/server/tokens/token-service.ts`) all look sessions/tokens up by hash only; the raw value is returned to the caller exactly once, at issuance.

### Staff auth: hand-rolled scrypt + opaque sessions, no auth library
**Decision:** `src/server/auth/password.ts` (Node's built-in `node:crypto` scrypt, self-describing `scrypt:<salt>:<hash>` stored format) and `src/server/auth/session.ts` (opaque bearer token, hash stored, 12-hour TTL) replace the ADR-004 placeholder of "e.g. Lucia/Auth.js."
**Why:** Lucia's own maintainers discontinued it as a library in favor of copy-paste reference code; given that, and that the actual requirement (password hash + a sessions table) is small and fully unit-testable, owning it directly avoids both a dependency with an uncertain future and another native-binding risk on this machine.

### Authorization model
**Decision:** `src/server/auth/authorization.ts` defines `Actor` as a discriminated union (`guest | buyer | sales_rep | ncc_admin`, where `buyer` carries its own `role: 'buyer' | 'company_admin'`) with deny-by-default `canViewCompanyResource`/`canMutateCompanyResource` functions, matching `docs/route-permissions-matrix.md` exactly: a plain buyer sees only their own resources, a company admin sees their whole company, a sales rep is read-only even within an assigned company, and a guest is never granted access this way at all — guest access is entirely mediated by `token-service.ts` instead, never by actor identity.
**Source:** `docs/route-permissions-matrix.md`, CLAUDE.md rule 17.

### Domain validation: `.strict()` Zod schemas as the rule-9 enforcement mechanism
**Decision:** Every guest/buyer-facing command schema in `src/server/validation/commands.ts` (submit basket, return request, support message) uses Zod's `.strict()` mode, so a client-supplied field the server doesn't expect (`unitPricePence`, `status`, etc.) fails validation outright rather than being silently dropped or trusted. The one schema that does carry price/total fields, `nccApprovalSchema`, is authorized separately by actor identity (`ncc_admin` only), not by anything in the schema itself.
**Source:** CLAUDE.md rule 9.

## Phase 3 decisions and facts (2026-09-12)

### ADR-012: Cursor-based pagination on `CatalogueAdapter`, not page/perPage
**Decision:** `PaginationOpts` changed from `{ page, perPage }` (Phase 2's original guess) to `{ first, after? }`, matching Shopify's own GraphQL connection model. `CollectionResult`/`SearchResult` now carry `pageInfo: { hasNextPage, endCursor }` instead of a `totalCount`.
**Why:** Building the real Storefront adapter this phase confirmed the Storefront API has no random-access "page number" concept at all — only cursors. Changing this now, before Phase 5 builds real pagination UI on top of it, avoids baking in a wrong abstraction that Phase 5 would have had to work around. Nothing outside the fixture adapter and its tests depended on the old shape yet, so this was a clean, low-risk fix (same principle as ADR-004's database pivot: verify the real API before committing to an interface shape).
**Effect:** `fixture-adapter.ts` and its tests updated to the same cursor model on a plain in-memory array (a stringified index as the cursor) so fixture and live behave identically from the caller's perspective.

### ADR-013: `AdminCommerceAdapter.approveReturn` drops the `resolution` parameter from the original doc sketch
**Decision:** `docs/integration-contracts.md`'s original sketch had `approveReturn(returnId, resolution: 'refund' | 'replacement')`. The real implementation takes only `returnId` — resolution is deferred entirely to Phase 10.
**Why:** The real Shopify mutation, `returnApproveRequest` (verified against the live Admin GraphQL schema this session, requires `write_returns` scope), only approves a return and creates a reverse fulfillment order — it doesn't accept a refund/replacement choice at all. That choice is a separate, later mutation Phase 10 will implement alongside the real returns workflow. Building a wider interface now than the underlying API actually supports would have meant faking part of the contract.

### Shopify facts verified live this session (not assumed)
- Real Admin GraphQL connection confirmed against the live dev store: `nccwholesale.org`, Basic plan, GBP, UK.
- The store's actual API domain is **`9nd0we-wt.myshopify.com`** — distinct from the custom storefront domain (`nccwholesale.org`) shown in the admin UI. Every Shopify API call (Storefront, Admin, OIDC discovery) targets the `.myshopify.com` domain via the new `SHOPIFY_STORE_DOMAIN` env var.
- Current latest-stable Shopify API version as of 2026-09-12 is **`2026-07`** (`SHOPIFY_API_VERSION` default; `2026-10` is still a release candidate).
- Storefront API SKU lookup uses search syntax (`products(query: "sku:VALUE")`), confirmed via `shopify.dev/docs/api/storefront/2026-07`; there is no dedicated by-SKU root query.
- Admin mutations verified real and current: `draftOrderCreate`, `draftOrderInvoiceSend` (already confirmed live in Phase 0), `returnApproveRequest`.
- Customer Account API is a full OIDC/OAuth2+PKCE flow, discovered per-shop at `https://{domain}/.well-known/openid-configuration` — confirmed via `shopify.dev/docs/api/customer/2026-07`. Requires an HTTPS (never localhost) redirect URI, so it is not live-testable before Phase 7 has a real callback route.

### Blocked: self-provisioning a live Storefront API access token
**What happened:** The user authorized taking any in-scope, free Shopify access needed for the build ("any access you require from Shopify won't be denied in scope... unless it costs money"). Acting on that, I attempted `storefrontAccessTokenCreate` (free, in-scope) directly against the connected Admin GraphQL MCP tool to provision a real Storefront token without needing to interrupt the user.
**Result:** The connector's own safety policy refused the mutation outright — `"Storefront access token management is not permitted via AI tools"` (category `access_escalation`). This is a hard boundary on the tool itself, not a cost question, and not something further authorization from the user can lift.
**Effect:** The live Storefront adapter is fully built and contract-tested, but running the read-only smoke test against real data needs one 2-minute manual step from the user: Shopify admin → Sales channels → Headless (free) → Create storefront → copy the token into `ncc-supply/.env` as `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (plus `SHOPIFY_STORE_DOMAIN=9nd0we-wt.myshopify.com`, `CATALOGUE_ADAPTER=live`). Until then, `CATALOGUE_ADAPTER` defaults to `fixture`, which is a complete, working, tested default — nothing in Phases 3–5 is blocked on this. Recorded per CLAUDE.md rule 25 rather than claimed as done.

## Phase 4 decisions and facts (2026-09-12)

### ADR-014: `CatalogueAdapter.listCollections()` added — a genuine interface gap, not scope creep
**Decision:** Added `listCollections(): Promise<CollectionSummary[]>` to `CatalogueAdapter`, implemented for both the fixture and live (Storefront) adapters and wrapped in the same `withCache` layer as `getCollection`/`getProduct`.
**Why:** Neither the original `docs/integration-contracts.md` sketch nor the Phase 2/3 implementation had any way to list all collections — every method took a specific `slug` or `query`. Building the homepage's "Shop By Category" section (and `/categories`, Phase 5's very next task) surfaced that this was simply missing, not a deliberate omission. The Storefront API's `Collection` type also turned out to have **no product-count field at all** (verified against `shopify.dev/docs/api/storefront/2026-07/objects/Collection` — confirmed by fetching the full field list, not assumed); the real implementation counts real products via `products(first: 250) { edges }`, capped at a value that comfortably covers the entire 321-SKU catalogue.
**Effect:** `fixture-adapter.ts` derives its collection list from the fixture products themselves (so line counts are always real, never fabricated); `storefront-adapter.ts`'s `listCollectionsLive()` does the real Storefront query. Both are exercised by name-matching contract tests.

### Manual verification note: dev-only TanStack Devtools overlay
While visually checking the homepage in the Browser tool at a mobile viewport, the TanStack Devtools floating trigger rendered on top of the Header's hamburger-menu button, intercepting a couple of mouse-click checks. This is a dev-only artifact — the production build log confirms `[@tanstack/devtools-vite] Removed devtools code from: /src/routes/__root.tsx` — so it has no bearing on production behavior. The mobile-menu toggle/Escape/focus-return behavior was instead verified via keyboard navigation (`Tab` to the button, confirmed via `document.activeElement`) and via `Header.test.tsx`'s jsdom tests, which don't have devtools mounted at all.

## Phase 5 decisions and facts (2026-09-12)

### ADR-015: Facet/sort/pagination state lives entirely in plain URL query params, not client-side router state
**Decision:** `/category/:slug` and `/search` read/write filters, sort, and pagination as plain query-string params (`?sort=`, `?filters=Attr:Val,Attr:Val2`, `?after=`), rendered as ordinary `<a href>` links — no client-side `Link`/`navigate` calls, no JS required for any of it to work.
**Why:** PRD §6.3 explicitly requires this state to be "shareable and crawlable." Plain hrefs are the most direct way to guarantee that — a crawler or a pasted URL works identically to a real click, with zero dependency on hydration succeeding. `filters` is deliberately one comma-joined string, not a repeated `?filter=a&filter=b` param or an array — TanStack Router's default search serializer's handling of arrays wasn't verified, so a single unambiguous string sidesteps the question entirely rather than risking a subtly-wrong round-trip.
**Effect:** Facet checkboxes, sort tabs, and Previous/Next are all real links (`FacetSidebar.tsx`, `Pagination.tsx`), not controlled form inputs.

### ADR-016: Previous/Next pagination (not numbered), and facet sidebar stacks inline on mobile rather than a "Filters" sheet
**Decision:** Two intentional simplifications from the design system's literal spec, given the current catalogue's modest size (321 SKUs) and the session's "move quickly" direction:
1. **Pagination is Previous/Next**, not numbered. Shopify's Storefront connections are forward-cursor-only with no total page count (ADR-012) — a numbered control would have to either lie about page counts or walk every prior page just to render page numbers. "Previous" links back to the unpaginated first page (not a true bidirectional cursor walk) — a reasonable simplification at this catalogue size.
2. **The facet sidebar always renders inline** above the product grid on mobile, rather than being hidden behind a "Filters" button that opens a full-screen sheet. It's fully usable (confirmed at 375px width), just not the more polished collapsed-by-default pattern.
Both are documented, deliberate scope reductions, not oversights — revisit if/when the catalogue grows enough that either limitation becomes a real usability problem.

### Real counts added where Shopify's API actually provides them
`CollectionResult.lineCount` (via an aliased second `products` field in the same GraphQL request — `allProducts: products(first: 250) { edges { node { id } } }` — so it costs one request, not two) and `SearchResult.totalCount` (the Storefront API's `search` query has a real `totalCount` field, confirmed via `shopify.dev/docs/api/storefront/2026-07/connections/SearchResultItemConnection` — unlike `Collection.products`, which has none). Both are real computed/returned values, never fabricated.

### Manual verification note: browser-automation tool sends a non-standard `Enter` key event
While testing `SearchBar`'s typeahead keyboard navigation in the Browser tool, `ArrowDown` correctly updated `aria-selected`, but the automated "Return" keypress didn't trigger the Enter-to-navigate handler. Added a temporary debug marker and confirmed the tool's synthetic key event reports `event.key === "Unidentified"` rather than `"Enter"` — a limitation of that specific automation tool, not an app bug (all application state — `activeIndex`, the anchor ref — was exactly correct at the moment of the keypress). Verified the actual behavior instead with a proper Testing-Library `userEvent.keyboard('{Enter}')` test (`SearchBar.test.tsx`), which dispatches a spec-correct `KeyboardEvent` and passes.

## Resolved by business decision, 2026-09-12

2. **Number of companies needing distinct contract pricing.** ✅ Resolved: **none** — uniform list pricing for everyone (ADR-005). The price-list cap is now irrelevant.
3. **Contract/tier pricing model.** ✅ Resolved: **not used** — see ADR-005.
7. **Sales-rep ID-verification depth.** ✅ Resolved: employee ID on file (unchanged format/uniqueness check) plus first-successful-email-login as the activation trigger — see ADR-007.
8. **Shopify plan tier.** ✅ Resolved: **Basic is sufficient.** This was the session's top risk (see prior version of this section, preserved in git history) — third-party Admin API access to B2B-specific resources is documented as restricted to dev stores/Plus Partners/affiliates. ADR-006 removes the dependency on those resources entirely (no Shopify B2B "Companies" object), so the restriction no longer applies. **Recommendation: stay on the current Basic plan** unless a future, currently-unplanned requirement (e.g. deposits/partial payments, Shopify Functions checkout customization, a dedicated B2B storefront) comes up — none of those are in scope per PRD §7.1/§12.

## Still awaiting business confirmation

**None of these are answered here — Claude must not invent answers to them (CLAUDE.md rule, runbook §22).** Each already has an adopted default stated elsewhere in the PRD, so the build is not blocked while they're outstanding, but they should be resolved before the phase that depends on them (noted below).

1. **Target catalogue size and expected growth.**
   *Partial factual update from Phase 0*: the live Shopify store (`nccwholesale.org`) currently holds **321 SKUs across 12 collections**. This answers "current size" but not "expected growth," which is still open. Feeds §7.5 (whether native search stays sufficient).
   *Blocks:* nothing before Phase 5; matters more from Phase 5 onward.

4. **ERP, PIM, or accounting integration(s), if any.** Default is none; §7.6 assumes Shopify's own fields and the app database are sufficient until told otherwise.
   *Blocks:* nothing in Phases 0–13 as specified; would only add scope if answered "yes."

5. **Return window and refund-vs-replacement policy per reason.** Needed to configure Shopify's native return rules and the return-reason list (§6.16).
   *Blocks:* Phase 10.

6. **Support SLA targets and escalation rules.** Needed to configure the support queue's escalation action (§6.21); no default assumed.
   *Blocks:* Phase 10.
