# NCC Supply — Implementation Plan

Status: Phase 0 complete (this document). No application code exists yet.

## 1. Architecture summary

- **Frontend/delivery:** Headless TanStack Start application (PRD §7.3 — already decided, not open). No Shopify theme is built.
- **Commerce system of record (Shopify):** catalogue (products/collections/images/uniform list pricing/variants via Storefront API), confirm-then-invoice flow (Draft Orders + `draftOrderInvoiceSend`), native self-serve returns (requires Shopify's *new*, plain customer accounts — no B2B link).
- **Application backend (custom):** companies, buyers, locations, spend limits (**revised 2026-09-12, DECISIONS.md ADR-006** — no Shopify B2B "Companies" object; only needed for contract pricing, which this build doesn't have), the two-stage approval workflow (company-admin pre-approval + NCC-admin review/approve), NCC staff accounts (email-or-username sign-in, sales-rep ID-verification gate with email-login activation — ADR-007), quotes, support/complaint tickets. Row-level security: a company reads only its own data; a sales rep only assigned companies'.
- **Pricing:** uniform standard list pricing for every buyer, guest or signed-in — no contract/tier pricing anywhere (DECISIONS.md ADR-005).
- **Buyer identity (PRD §7.4):** guest = app-owned token link, never touches Shopify accounts. Company buyer = Shopify's own passwordless customer-account flow — the app does not build its own buyer auth.
- **Search (PRD §7.5):** Shopify Search & Discovery (free, native) is the day-one default; third-party search (Algolia/Klevu/Boost) is a later upgrade path, not a Phase-0-blocking decision.

## 2. Route inventory (from PRD §3)

Public: `/`, `/categories`, `/category/:slug`, `/search`, `/product/:sku`, `/how-to-order`, `/contact`.
Ordering (no payment): `/basket`, `/bulk-order`, `/order-submitted`, `/order/:id?token=`.
Payment gate: `/checkout/:id?token=` — reachable only when order status is `confirmed`.
Quotes: `/quote`, `/quote/:id?token=`.
Returns: `/returns`, `/returns/:id?token=`, `/account/returns`.
Support: `/support`, `/support/:id?token=`.
Auth/account: `/auth`, `/register`, `/account`, `/account/orders`, `/account/users`, `/account/pricing`.
Staff (internal, never linked from public nav/footer): `/staff/orders`, `/staff/order/:id`, `/staff/quotes`, `/staff/accounts`, `/staff/returns`, `/staff/support`, `/staff/team` (NCC admin only).

Full role × route matrix: `docs/route-permissions-matrix.md`.

## 3. Service and data boundaries

| Concern | Owner | Notes |
|---|---|---|
| Products, collections, images, prices, variants | Shopify (Storefront API) | Normalized into app view models in Phase 3; uniform list pricing, no buyer context needed |
| Companies, buyer contacts, locations | **App DB** (revised 2026-09-12) | No Shopify B2B object — see DECISIONS.md ADR-006 |
| Contract/tier pricing | **Not used** | Resolved 2026-09-12 — uniform pricing for all buyers, ADR-005 |
| Draft orders, invoicing, payment link | Shopify (`draftOrderInvoiceSend`, confirmed live mutation) | Created only after NCC-admin approval |
| Returns/refunds | Shopify native self-serve returns | Requires Shopify *new* customer accounts |
| Two-stage approval, audit log | App DB | Shopify has no native concept of this |
| NCC staff accounts, sales-rep scoping | App DB | Entirely outside Shopify Admin |
| Quotes | App DB → becomes Shopify Draft Order on acceptance | No native Shopify quote object |
| Support/complaint tickets | App DB | No native Shopify equivalent |
| Guest identity | App DB (token only) | Never touches Shopify accounts |

Full entity/status detail: `docs/domain-model.md`. Full typed-boundary shape: `docs/integration-contracts.md`.

## 4. Phase sequence

The 14-phase sequence and exact phase-start prompts already exist in `docs/NCC-Supply-Claude-Code-Phased-Prompt-Plan.md` §3–§19 and are adopted as-is (they are complete and well-specified; this plan does not redesign them). Summary:

| Phase | Scope | Exit criterion source |
|---|---|---|
| 0 | Discovery, architecture, project memory | This document + runbook §3 |
| 1 | App scaffold + design-system foundation | Runbook §4 |
| 2 | Domain model, persistence, service boundaries | Runbook §5 |
| 3 | Shopify connectivity + catalogue adapter | Runbook §6 |
| 4 | Public shell + homepage | Runbook §7 |
| 5 | Catalogue, search, product discovery | Runbook §8 |
| 6 | Basket + guest order-request vertical slice | Runbook §9 |
| 7 | Company accounts, buyer identity, company approval | Runbook §10 |
| 8 | NCC order console, draft order, confirmed checkout | Runbook §11 |
| 9 | Bulk ordering, quotes, reorder | Runbook §12 |
| 10 | Returns and support cases | Runbook §13 |
| 11 | Staff accounts, team management, sales-rep scoping | Runbook §14 |
| 12 | SEO/AEO, accessibility, performance, security hardening | Runbook §15 |
| 13 | Real catalogue, assets, content readiness | Runbook §16 |
| 14 | Staging, end-to-end acceptance, launch prep | Runbook §17 |

Production launch uses the separate gated prompt in runbook §18 — never bundled into Phase 14.

Rule: one phase per session. Before starting the next phase, open a fresh Claude Code session and paste runbook §20's continuation prompt, which re-reads this file set and verifies the last phase from evidence.

## 5. Test strategy (grows per phase)

- **Unit/contract:** Vitest, applied to service/data-adapter boundaries, status-transition logic, authorization helpers, validation schemas.
- **Component:** Testing Library, applied from Phase 1 onward to design-system primitives.
- **End-to-end/acceptance:** Playwright, introduced meaningfully from Phase 6 (first real user flow) and exercised fully in Phase 14's acceptance matrix.
- **Security-specific tests** (per phase, per CLAUDE.md rule 21): cross-tenant access denial, privilege escalation attempts, token enumeration/replay, idempotency of mutating actions.
- No phase is marked complete without the relevant subset run and evidence recorded in `TASKS.md`/`PHASE_HANDOFF.md` (CLAUDE.md rule 23).

## 6. Environments

- **Local:** fixture/mock Shopify adapter, local SQLite file via libSQL (`DATABASE_FILE` env var) — revised from the original Postgres default; see `DECISIONS.md` ADR-004 revision.
- **Shopify development store:** `nccwholesale.org` (Basic plan) — already holds the real 321-SKU / 12-collection catalogue populated earlier. Confirmed reachable for B2B Admin API resources (`companies` query succeeds) — consistent with dev-store access rules. Used for Phase 3+ read/contract testing.
- **Staging:** a separate Vercel deployment + Turso database (ADR-038) — never the production domain, never the current live NCC site. Password-gated via `SITE_ACCESS_PASSWORD` until the launch prompt.
- **Production:** not touched until the gated launch prompt (runbook §18) is explicitly approved with real credentials and a confirmed domain. Hosted deploys (`VERCEL=1`) require live Shopify catalogue + Admin adapters and a hosted `DATABASE_URL`.

## 7. Open items that can block later phases

**Resolved 2026-09-12** (see `DECISIONS.md`): Questions 2, 3, 7, and 8. Notably, **Shopify Basic plan is confirmed sufficient** — dropping the Shopify B2B "Companies" dependency (ADR-006) removes the only reason a higher plan tier might have been needed.

**Still open** (see `DECISIONS.md` → "Still awaiting business confirmation"): catalogue growth trajectory (Question 1, partial), ERP/PIM integration (Question 4), return window/policy (Question 5), support SLA (Question 6). None block Phase 1. Questions 5/6 should be resolved before Phase 10.
