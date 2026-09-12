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
## Phase 5 — Catalogue, search and product discovery
## Phase 6 — Basket and guest order-request vertical slice
## Phase 7 — Company accounts, buyer identity, company approval
## Phase 8 — NCC order console, Shopify draft order, confirmed checkout
## Phase 9 — Bulk ordering, quotes, reorder completion
## Phase 10 — Returns and support cases
## Phase 11 — Staff accounts, team management, sales-rep scoping
## Phase 12 — SEO, AEO, accessibility, performance, security hardening
## Phase 13 — Real catalogue, assets, content readiness
## Phase 14 — Staging, end-to-end acceptance, launch preparation

(Task lists for Phases 4–14 will be expanded from the runbook's per-phase prompts as each phase starts, so the checklist reflects what was actually agreed at that point rather than being drafted speculatively far in advance.)
