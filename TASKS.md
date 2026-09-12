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

- [ ] TanStack Start project scaffold, strict TypeScript, agreed package manager
- [ ] Tailwind v4 CSS-first tokens under `@theme inline` (light + dark values, no public dark-mode toggle unless required)
- [ ] Inter loaded via `<link>` in document head
- [ ] Named utilities: `surface-card`, `hero-gradient`, `sky-gradient`, `text-gradient`, `grid-mesh`, `rise-in`
- [ ] Accessible primitives: buttons, links, fields, badges, status chips, cards, dialogs/sheets, disclosures
- [ ] Shared container + responsive layout primitives
- [ ] Lucide icon wrapper (decorative/accessible variants)
- [ ] App error boundary, not-found boundary, loading patterns
- [ ] Component-preview surface (if selected) with focus/disabled/error/reduced-motion states
- [ ] Automated token-usage + primitive-behaviour checks
- [ ] Lint, type-check, test, production build all pass
- [ ] Visual check at 375/768/1024/1440px

## Phase 2 — Domain model, persistence, integration boundaries

- [ ] Database schema/migrations for app-owned concepts only (PRD §7.2)
- [ ] Order/quote/return/support status enums + transition guards
- [ ] Immutable audit-event records
- [ ] Tenant/role authorization helpers (deny-by-default)
- [ ] Guest-token generation/hashing/expiry/revocation
- [ ] Idempotency support for order submission + Shopify mutations
- [ ] Validation schemas for all domain commands
- [ ] Typed Shopify Storefront/Customer/Admin service interfaces
- [ ] Mock/fixture adapters for local dev + contract tests
- [ ] Environment validation + `.env.example`
- [ ] Dev-only seed data, unmistakably marked
- [ ] Security tests: cross-company denial, sales-rep scope, buyer-vs-admin, invalid transitions, token enumeration, duplicate-submission idempotency, no client-trusted totals/pricing

## Phase 3 — Shopify connectivity and catalogue adapter

- [ ] Storefront API client: products, variants, collections, images, prices, metafields/metaobjects, pagination
- [ ] Customer Account API boundary (for later company-buyer sign-in)
- [ ] Server-only Admin API boundary (for later draft-order/invoice/refund ops)
- [ ] Pagination, rate-limit handling, timeouts, retries, error mapping, redacted logs
- [ ] Catalogue normalization into app Product/Collection view models
- [ ] Fixture adapter selectable by environment, never mixed with production
- [ ] Caching/revalidation strategy for a wholesale catalogue
- [ ] Health diagnostics with no credential exposure
- [ ] Contract tests + read-only smoke test against dev store (never production)

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
