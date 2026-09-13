# NCC Supply — Decisions

## Operational note: temporary site-wide password gate (2026-09-13)

**What:** Every route except `/preview-access` now requires a shared password once per browser (`src/server/auth/site-access.ts`, `SITE_ACCESS_PASSWORD` env var, default `ncc-preview-2026` if unset — see `.env.example`). This is a pre-launch operational measure requested directly by the user ("keep it password protected for now"), not a PRD feature and not numbered as a phase ADR.
**Design:** A root-route `beforeLoad` (`src/routes/__root.tsx`) redirects to `/preview-access` unless a session cookie (`ncc_site_access`, 30-day, sealed with the existing `SESSION_SECRET`) already marks the browser as granted. The gate page itself renders with no Header/Footer (checked via `useRouterState` in `RootDocument`), so an ungated visitor sees nothing but the password prompt — confirmed in a real browser, not just asserted. Entirely separate from buyer sign-in (`buyers/buyer-session.ts`) and staff auth (`auth/session.ts`) — this is a single shared password, not a per-user credential.
**Remove before real launch:** delete `SITE_ACCESS_PASSWORD` from the environment (or remove the `beforeLoad` gate in `__root.tsx`) as part of the runbook §18 launch prompt — never left in place past explicit, authorized launch (CLAUDE.md: launch is never inferred from phase completion).

## Security fix (2026-09-13): the site-access password itself was leaking into the client JS bundle

**What happened:** `routes/dev/fixture-shopify-login.tsx`'s `beforeLoad` read `env.CUSTOMER_ACCOUNT_ADAPTER` directly (`if (env.CUSTOMER_ACCOUNT_ADAPTER !== 'fixture') throw notFound()`). `beforeLoad` is isomorphic — it also runs for client-side navigations — so referencing the server-only `env` module there at all pulls the *entire* module into the client bundle, Zod schema included. Since every field's default is a literal captured by `.default(x)`, this shipped the **literal default values** of `SESSION_SECRET` and, worse, **`SITE_ACCESS_PASSWORD` itself** (`ncc-preview-2026`) into `dist/client/assets/*.js` — completely defeating the password gate above, since anyone could read the password straight out of the public JS bundle without ever seeing the prompt.
**Found:** a routine post-build grep for server-only secrets/dependencies in the client bundle (the same check performed after every phase since Phase 6) — this phase was the first to specifically grep for `SITE_ACCESS_PASSWORD`'s literal value rather than just dependency names like `jose`/`libsql`, which is what caught it. Confirmed the leak predated Phase 8 (`SESSION_SECRET`'s default was already present) — this file shipped in Phase 7 and had gone unnoticed since.
**Fix:** moved the check into a `createServerFn` (`checkFixtureAdapterEnabled`), called from `beforeLoad` instead of reading `env` directly. Rebuilt and re-swept the client bundle for every known secret/default value and every server-only dependency name (`libsql`, `jose`, `scrypt`, `passwordHash`, the real Shopify tokens themselves) — all clear.
**Lesson for future phases:** never reference `env` (or anything that imports it) from a route's `beforeLoad`/`loader`/`component` body directly — always go through a `createServerFn` handler, even for a trivial boolean check. Add this specific grep (`SITE_ACCESS_PASSWORD`'s literal value, not just dependency names) to the standard per-phase client-bundle sweep going forward.

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
**Still unresolved as of Phase 7:** the same Headless channel setup would also supply `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID`, which Phase 7 needed for the real buyer sign-in adapter. This has not been confirmed done by the user, so `CUSTOMER_ACCOUNT_ADAPTER` also defaults to `fixture` (ADR-019) — a complete, working, tested default that made full manual verification of the buyer flow possible without it.

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

## Phase 6 decisions and facts (2026-09-12)

### ADR-017: Guest basket persistence via TanStack Start's `useSession`, not a hand-rolled cookie
**Decision:** The guest basket is identified by an encrypted, httpOnly session cookie (`@tanstack/react-start/server`'s `useSession`, sealed with the existing `env.SESSION_SECRET`) holding only the basket's own id — never contents. `getOrCreateBasketId()` (`src/server/basket/session.ts`) is the only place that touches it.
**Why:** `@tanstack/react-start/server` (backed by `@tanstack/start-server-core`, confirmed present in `node_modules` by reading its own `.d.ts` files, not assumed) ships a complete `getCookie`/`setCookie`/`useSession` surface — a proper sealed-session mechanism, not just raw cookie access. `env.SESSION_SECRET` (Phase 2) was validated from day one but never actually consumed by anything until now; using it here is exactly the use it was reserved for, not a new secret.
**Effect:** A submitted basket is never reused — once its `status` leaves `open`, the next visit gets a fresh basket rather than resurfacing a completed one as editable. This made the "already submitted" UI branch originally written into `/basket` provably unreachable; it was removed rather than left as dead code once the browser verification confirmed the design worked as intended.

### ADR-018: `submitBasketSchema` revised — basket id and lines are never client input
**Decision:** Phase 2's original guess for `submitBasketSchema` took `{ basketId, lines }` from the client. The real implementation reads the basket id from the session cookie and its lines from the database (each already price-validated when added — `src/server/basket/basket.ts`), so the schema now accepts only the optional contact fields.
**Why:** Once the basket is server-persisted, resubmitting the full line list at submit time is both redundant and a needlessly larger attack surface — a client could otherwise claim a `basketId` or line list inconsistent with what the guest's own session actually points to. Dropping both fields removes the possibility entirely rather than just validating it away.

### Schema gaps fixed before building on them (same pattern as ADR-012/014)
Three columns the Phase 2 schema was missing, discovered while implementing the real basket/order-submission flow, added via migration `0001_clear_switch.sql` (verified applying cleanly to a real file before use, same as every prior migration):
- `baskets.status` / `baskets.orderRequestId` — `docs/domain-model.md` already documented a Basket `open → submitted` status machine that the original table had no column for at all.
- `basket_lines.sku` and `order_request_lines.sku` — both tables only stored `shopifyVariantId`, but `CatalogueAdapter.getProduct()` looks up by SKU, not variant id, and has no by-variant-id alternative. Without a stored SKU, there was no way to re-resolve a line's current price/title at all.

### Manual verification caught a real bug: the running dev database was never migrated
Testing the add-to-basket flow in the Browser tool against `pnpm dev` initially failed with a real SQL error (`Failed query: insert into "baskets"...`) — the migration had only ever been verified against throwaway files in every prior phase, never applied to the actual `local.db` the dev server uses. Fixed by running `pnpm db:migrate` against it directly (safe: dev-only, no real content). Recorded because it's a genuine process gap worth carrying forward: "verify the migration applies" and "verify the running dev server's own database has it" are not the same check, and only the browser-based end-to-end test caught the second one.

## Phase 7 decisions and facts (2026-09-12)

### ADR-019: Fixture/live split for the Customer Account adapter, mirroring `CATALOGUE_ADAPTER`
**Decision:** New env var `CUSTOMER_ACCOUNT_ADAPTER=fixture|live` (default `fixture`), selecting between `fixture-customer-account-adapter.ts` (new) and the real `customer-account-adapter.ts` via `getCustomerAccountAdapter()` in `integrations/shopify/index.ts`. The fixture adapter's `login()` points at a dev-only route, `/dev/fixture-shopify-login`, which simulates Shopify's hosted login page: the developer types an email, a server function mints a self-signed JWT via `mintFixtureIdToken`, and the browser is redirected back to `/auth-callback?code=<jwt>&state=...` exactly like a real OAuth round trip.
**Why:** `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` is still unconfigured (same blocker as Phase 3's Storefront token — see below), so without this the entire buyer sign-in → callback → session → account → approval flow would be untestable end-to-end, violating CLAUDE.md rule 25 ("test the contract with fixtures" rather than skipping verification). The fixture adapter implements the identical `CustomerAccountAdapter` interface (including the new `verifyIdentity` method below) so the callback route's logic is genuinely exercised, not just unit-mocked.
**Effect:** Every Phase 7 manual verification (register a company, invite/accept, submit, approve, reorder, cross-tenant isolation) was done through this fixture in a real browser. The real adapter's OIDC/PKCE construction (Phase 3) is unchanged and remains the production path once the client id is configured.

### ADR-020: `CustomerAccountAdapter.verifyIdentity` — real JWKS signature verification, not just decoding
**Decision:** Added `verifyIdentity(idToken): Promise<{email, shopifyCustomerId}>` to the adapter interface. The real implementation (`customer-account-adapter.ts`) verifies the id_token's signature against Shopify's own JWKS (fetched from the OIDC discovery document's `jwks_uri`, via `jose`'s `createRemoteJWKSet` + `jwtVerify`), checking `aud`/`iss`, before trusting the `email`/`sub` claims. The fixture adapter does the same verify-then-decode with a locally-generated HMAC key, so both paths exercise identical logic.
**Why:** The id_token is the only place a Shopify customer's identity actually lives in this flow — the access token is opaque. Decoding it without verifying its signature would mean trusting an unauthenticated claim about who signed in (a direct violation of CLAUDE.md rule 9), even though in this flow the token itself arrives via a direct server-to-server exchange rather than client input.
**New dependency:** `jose` (no existing JWT/JWKS library in the repo).
**A real bug found while writing this:** jose's WebCrypto runtime (picked up under Vitest's jsdom environment) does an `instanceof Uint8Array` check against its own realm's constructor; a raw `Uint8Array` created via `TextEncoder` in the test/Node realm fails that check even though it's structurally identical — `Key for the HS256 algorithm must be... Received an instance of Uint8Array`. Fixed by importing the fixture's HMAC secret as a real `CryptoKey` once (`crypto.subtle.importKey`) instead of passing a raw byte array, which has no such realm ambiguity.

### ADR-021: Buyer session is a separate cookie from the guest basket session; OIDC round-trip state is its own short-lived session
**Decision:** `ncc_buyer` (`server/buyers/buyer-session.ts`) holds only `{buyerUserId}`, using the same `useSession` mechanism as Phase 6's `ncc_basket` cookie but entirely independent of it — signing in as a buyer never disturbs an in-progress guest basket pointer, and vice versa. A third, short-lived (10-minute) session, `ncc_oidc_pending`, holds `{state, nonce, codeVerifier, redirectUri}` during the redirect round-trip (server-held, so a request can never forge or replay a mismatched `state`) and is reused afterward to briefly hold a verified-but-unmatched identity (`{email, shopifyCustomerId}`) for `/register` to consume, so registration never has to redo the OIDC handshake.
**Effect:** `getOrCreateBasketId` (`server/basket/session.ts`) checks for a buyer session first; if present, it resolves (or creates) that buyer's own basket by `buyerUserId` directly — no cookie pointer needed, since the buyer's identity is already the anchor — and only falls through to the existing guest-cookie logic otherwise. Every existing call site (`ProductCard`, `/product/:sku`, `basket/server-functions.ts`) keeps working unchanged for both guest and buyer.

### ADR-022: Invite acceptance happens via `/auth`, not a separate step on `/register`
**Decision:** A company admin invites a buyer (`buyerUsers` row at status `invited`) from `/account/users`. That buyer accepts the invite simply by signing in at `/auth` with the same email — the callback logic (`completeBuyerLogin`, `server/buyers/oidc-flow.ts`) matches the verified email against `buyerUsers`, and an `invited` row transitions to `active` on that first successful sign-in (mirroring ADR-007's staff first-login activation), landing them straight on `/account`. `/register` is reached only when no `buyerUsers` row matches the verified email at all — its only job is first-time company creation.
**Why:** No email-delivery mechanism exists yet (same gap already noted in Phase 6's guest link), so there is no separate "invite link" to click. Since the identity check itself is the meaningful step, requiring a distinct "accept" click after it would be a redundant, unrequested extra step — PRD §2/§6.12 describe the effect (an invited buyer becomes active and can use the account) without mandating a distinct UI action for it.

### ADR-023: A signed-in buyer's order request is created at `awaiting_company_approval`; company approval is what exercises the guarded transition
**Decision:** `submitBasket` (`server/basket/submit-order-request.ts`) now branches on the basket's `buyerUserId`: a guest basket is unchanged (creates directly at `awaiting_ncc_review`, issues a guest token); a buyer basket creates the order request directly at `awaiting_company_approval` (a creation value, exactly like the guest path's own direct creation — no transition needed to reach an initial state) and issues no token, since the buyer reaches it via `/account/orders`, session-gated. The company-admin approve/reject action (new `server/orders/company-approval.ts::decideCompanyApproval`) is what actually calls the existing `transitionOrderRequest(current, {type: 'company_approve'|'company_reject'})` guard from `domain/status.ts` — unlike Phase 6's guest path, which never calls it at all.
**Replay safety:** A second approve/reject attempt on an already-decided order throws `InvalidTransitionError` (the guard's existing behavior) rather than double-applying — no extra idempotency wrapper was added, since there's no side effect beyond status/timestamp/audit-event to double-write, and the guard already makes a second attempt a clean no-op-with-error rather than a silent double-approval.

### A real pre-existing type-safety bug found and fixed: `isCompanyAdmin`'s type predicate always narrowed to `never`
**What happened:** `authorization.ts`'s `isCompanyAdmin` (written in Phase 2, unused by any caller until this phase) was typed as `actor is Extract<Actor, { kind: 'buyer'; role: 'company_admin' }>`. `Extract` keeps a union member only if it's *assignable* to the target shape — the `buyer` variant's `role: BuyerRole` (`'buyer' | 'company_admin'`) is a wider type than the literal `'company_admin'` and so is never assignable to it, making the whole `Extract` evaluate to `never`. The runtime logic (`actor.kind === 'buyer' && actor.role === 'company_admin'`) was always correct; only the *type* callers got back after the guard was wrong, and nothing had exercised it until `server/buyers/companies.ts` did.
**Fix:** Changed the predicate to `Extract<Actor, { kind: 'buyer' }> & { role: 'company_admin' }` — extract the variant by its discriminant only, then intersect to narrow the `role` field, which TypeScript resolves correctly.
**Why this matters going forward:** any future `Extract<Union, { discriminant: X; otherField: NarrowerLiteral }>` pattern in this codebase should use the same extract-then-intersect form rather than putting the narrowing literal directly inside `Extract`'s pattern object.

## Phase 8 decisions and facts (2026-09-13)

### ADR-024: `/staff-login`, a plain opaque-token cookie, no unified `/auth` yet
**Decision:** Staff sign-in is a separate route, `/staff-login`, not folded into the buyer-facing `/auth` — that unification is explicitly Phase 11's scope (runbook §14, "Staff accounts, team management"). The session itself is the Phase 2-built `server/auth/session.ts` bearer token (`createSession`/`verifySession`, random + hash-verified) carried in a **plain** httpOnly cookie (`ncc_staff_session`, via `getCookie`/`setCookie`) — unlike the buyer/basket session cookies, which use `useSession`'s sealed-encryption layer to protect a bare, non-self-verifying id (a `buyerUserId` a client could otherwise forge). A hash-verified opaque token doesn't need that extra layer; it's already an unforgeable bearer credential by construction.
**Also delivers ADR-007 for real:** the sales-rep first-login activation rule (written in Phase 2, never exercised) now actually fires — confirmed against the real seeded dev database, not just a unit test: `pnpm db:seed`'s fixture sales rep flipped from `pending_id_verification` to `active` on its first real sign-in through `/staff-login`.

### ADR-025: Admin adapter gets the same fixture/live split as the other two Shopify boundaries
**Decision:** `ADMIN_COMMERCE_ADAPTER=fixture|live` (default `fixture`), `getAdminCommerceAdapter()` in `integrations/shopify/index.ts`, new `fixture-admin-adapter.ts`. Same reasoning as ADR-019 (Customer Account) and the original Storefront split: keeps the whole NCC-approval → Shopify → checkout flow demonstrable without live credentials.
**This phase is the first with a real Shopify write credential in hand** (see the blocker note below) — `ADMIN_COMMERCE_ADAPTER=live` was actually exercised against the real dev store during this phase's manual verification, not just contract-tested.

### ADR-026: Confirmation is one DB transaction; Shopify sync is a separate, retryable step — no new schema column
**Decision:** `confirmOrder` (`server/orders/ncc-approval.ts`) validates every line via the existing `assertConfirmedQuantityAllowed`, then writes confirmed quantities + delivery/VAT/total + `status: 'confirmed'` in a single `db.transaction`. Only *after* that commits does it attempt `createDraftOrder` + `sendDraftOrderInvoice` (`syncToShopify`) — wrapped in its own try/catch, failure logged and swallowed, never thrown back to the caller. `shopifyDraftOrderId`/`invoiceUrl` staying `null` on an otherwise-`confirmed` order **is** the explicit, recoverable "needs Shopify sync" state (no new status enum value, no new column) — the staff console shows a **Retry Shopify sync** action, and both the create and invoice-send steps are individually idempotent (`syncToShopify` checks each field before attempting its step).
**Proven against a real Shopify failure, not a simulated one** — see the blocker note below.

### ADR-027: `/checkout/:id` reuses the guest/buyer dual-access pattern; no shipping-address collection
**Decision:** `/checkout/:id` accepts either a guest `?token=` (verified via the existing `verifyGuestToken`) or a signed-in buyer's own session (`getOrderRequestViewForActor`) — staff never reach checkout at all, per the route-permissions matrix. The loader itself redirects to the equivalent order-status view (`/order/:id?token=` for a guest, `/account/orders` for a buyer) whenever the order isn't `confirmed` yet — confirmed in a real browser both ways (a token-bearing guest redirected correctly; a still-pending order never rendered payment options). Two payment options are *offered*, never processed by this app: a real link to Shopify's own hosted `invoiceUrl` once set, and a plain acknowledgment for cash on delivery — no new schema field records which was "chosen," since the PRD asks the screen to present both, not persist a selection.
**Shipping address stays uncollected** — `ConfirmedOrderRequest.shippingAddress` (Phase 3) is optional and left omitted; nothing in the basket/submission flow ever collects one, and PRD's "delivery" throughout means the *charge* NCC confirms, not a captured postal address. Not inventing a form for this; flagging it as a fact for a future phase if the business wants one.

### Blocker: the Admin API token provided this session lacks `write_draft_orders`
**What happened:** The user pasted a real Shopify token labelled "Storefront" — verified (via a direct HTTP check against both endpoints) that it's actually an **Admin API** token (`shpat_` prefix): 401 against the Storefront endpoint, 200 with real shop data against the Admin endpoint. Wired it in as `SHOPIFY_ADMIN_ACCESS_TOKEN` with `ADMIN_COMMERCE_ADAPTER=live` instead — a genuine, if accidental, unblock for this phase's real deliverable (Shopify Draft Order creation) that the Storefront-token blocker (Phase 3 onward) never provided.
**Real failure observed:** approving a real order and letting it sync produced an actual Shopify GraphQL error, logged in full: `"Access denied for draftOrderCreate field. Required access: write_draft_orders access scope or write_quick_sale access scope."` The custom app behind this token doesn't have the Draft Orders scope granted.
**Effect, and why this is good news, not just a blocker:** `confirmOrder`'s reconciliation design (ADR-026) handled this exactly as designed on the very first real-world failure it hit — the order stayed genuinely `confirmed`, `shopifyDraftOrderId`/`invoiceUrl` stayed `null`, and the staff console showed "Shopify sync incomplete" with a working Retry action (confirmed retrying reproduces the same clean failure, no crash, no double-write). To actually get a real draft order, the user needs to add the `write_draft_orders` scope to that custom app in Shopify admin (Settings → Apps and sales channels → Develop apps → the app → Configuration → Admin API scopes) and reinstall it. `CATALOGUE_ADAPTER` is still `fixture` — this token only ever unblocks the Admin side, not the Storefront/catalogue side, which is a separate credential (see the Phase 3 blocker note).

### A real gap discovered via manual testing: a guest with no contact email can never get a real Shopify invoice
**What happened:** `submitBasketSchema`'s contact fields are optional (rule: no payment/detail collection required at basket time), so a guest can submit with neither email nor name. Confirmed against a real such order in the dev database (leftover from earlier session testing): approving it correctly reached the "Shopify sync incomplete" state, but for a different, permanent reason than the scope issue above — `resolveOrderEmail` has no email to give Shopify at all, and retrying can never succeed for this specific order no matter what the token's scopes are.
**Not fixed this phase** (would mean making a basket-submission field required, which is Phase 6 territory and a business-rule change, not this phase's scope) — recorded as a fact for a future phase/business decision: either require an email for guest checkout, or decide NCC will always follow up by phone for a guest who omits one before a Draft Order can be created.

### A real bug found and fixed: `getGuestOrderLink` used the wrong signal for "is this a guest order"
**What happened:** Originally checked `guestContactEmail` presence to decide whether to mint a link, on the assumption "no email = not a guest." The order above proved that assumption wrong — a guest can have no email and still be a guest. The staff console was telling an admin "this order has no guest link, it belongs to a signed-in company buyer" about an order that was, in fact, a guest order.
**Fix:** check `buyerUserId` instead (`null` = guest, always, regardless of what contact details were given) — the only field that actually distinguishes the two cases. Caught by hands-on manual testing against a real leftover order with this exact shape, not by unit tests (which had only exercised the "has email" and "is a buyer order" cases, both of which happened to agree with the wrong signal) — a new test locks in the specific case that was wrong.

## Live Shopify Storefront connection established, 2026-09-13

**What happened:** the user supplied two more real Shopify credentials this session, labelled "Public access token" (`[REDACTED-ROTATED-STOREFRONT-TOKEN]`, no `shpat_` prefix) and "Private Access Token" (`[REDACTED-ROTATED-ADMIN-TOKEN]`). Verified both empirically the same way as every prior credential this project has received — direct HTTP calls against both the real Storefront and Admin GraphQL endpoints, never trusting the label or the prefix:
- The "Public access token" returned 200 with real shop data against the **Storefront** endpoint — a genuine, working Storefront API token, the first this project has had. Wired in as `SHOPIFY_STOREFRONT_ACCESS_TOKEN` with `CATALOGUE_ADAPTER=live`.
- The "Private Access Token" returned 200 against the **Admin** endpoint (401 against Storefront) — it's a second Admin API token, not a second Storefront credential. This is the same pattern as the earlier `[REDACTED-ROTATED-ADMIN-TOKEN]` mislabeling (see ADR-025's blocker note above). Not used; `SHOPIFY_ADMIN_ACCESS_TOKEN` stays on the original Admin token already wired in.

**Effect:** `CATALOGUE_ADAPTER=live` now serves the real Shopify catalogue end-to-end — 321+ real SKUs across all 12 real collections (iPad Digitizers, Chargers, Charging Cables, Power Banks, Car Holders, Car Chargers, Screen Protectors, Wireless Chargers, Screens, Batteries, Headphones & Earphones, Repair Parts), confirmed live in the browser on the homepage, category grid, and category detail pages. This resolves the Phase 3-onward Storefront-token blocker referenced throughout `DECISIONS.md`/`PHASE_HANDOFF.md`.

**A real bug found and fixed as a direct result of going live:** the homepage hero CTA hardcoded `/category/chargers` (a fixture-era slug guess). The real Shopify collection handle for that category is `wall-chargers` — navigating the hardcoded link produced "0 lines · No products found" in the browser. Fixed in `src/routes/index.tsx` (commit `afceb7b`) by deriving the featured category dynamically from the real loaded `collections` array (first collection with `lineCount > 0`) instead of hardcoding any slug. Verified fixed in-browser: the CTA now reads "Shop iPad Digitizers" and correctly links to `/category/ipad-digitizers`, which renders 10 real results.

**A real data-completeness gap noted, not a code bug:** every real product observed so far (e.g. the full iPad Digitizers collection) displays **£0.00** ex VAT. This is genuine live Shopify data — the store's products don't yet have prices set — not a pricing-logic defect in the adapter or `ProductCard`. Flagging for the user; no code change made, since inventing a price would violate rule 9 (never trust/fabricate pricing) and rule 20 (adapter must reflect real data, not paper over gaps).

**Unchanged:** `ADMIN_COMMERCE_ADAPTER` stays `live` on the original Admin token, which still lacks `write_draft_orders` (ADR-025/026's blocker, unresolved — needs the scope added and the app reinstalled before real Draft Order creation succeeds). `CUSTOMER_ACCOUNT_ADAPTER` stays `fixture` (Phase 7's separate, still-unconfigured `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` blocker, unrelated to either token above).

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
