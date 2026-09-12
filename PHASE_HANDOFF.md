# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 2 — Domain model, persistence, integration boundaries

**Completed scope:** the full custom-backend foundation under `ncc-supply/src/server/`, no routes or UI (none needed this phase — everything is testable directly via Vitest). Continued in the same session as Phase 1 at the user's explicit direction ("GO for next phase immediately here only"), on a new branch `phase/2-domain-backend`.

- **`db/schema.ts`** — 19 Drizzle tables for every app-owned entity in `docs/domain-model.md`: companies, company locations, buyer users, staff users, sales-rep assignments, staff sessions, baskets/basket lines, order requests/lines, quotes/lines, returns/lines, support tickets/messages, guest tokens, idempotency keys, audit events.
- **Database driver changed from the ADR-004 Postgres default to SQLite via `@libsql/client` + `drizzle-orm/libsql`** — this build machine has neither Postgres nor Docker, and `better-sqlite3` (the obvious alternative) needs a native compile step this machine has no Python/build tools for at all. See `DECISIONS.md` ADR-004 revision for the full chain of verification (each candidate was actually checked against the installed environment, not assumed).
- **`domain/status.ts`** — pure transition-guard functions for all five status machines (order request, quote, return, support ticket, buyer, staff), throwing `InvalidTransitionError` on an invalid move; `assertConfirmedQuantityAllowed` (rule 2/15) and `assertCanActivateOnFirstLogin` (ADR-007 — a sales rep needs an employee ID on file before first-login activation, an NCC admin doesn't) as separate guards alongside the transitions.
- **`auth/password.ts`** — scrypt (Node's built-in `node:crypto`) hash/verify, no native-binding dependency.
- **`auth/session.ts`** — opaque bearer session tokens for staff; only the SHA-256 hash is persisted (`staff_sessions.token_hash`), never the raw token (ADR-011 — this was originally a plain-id session table, caught and fixed before the first migration was generated).
- **`auth/authorization.ts`** — `Actor` discriminated union (guest/buyer/sales_rep/ncc_admin) and deny-by-default `canViewCompanyResource`/`canMutateCompanyResource`/`canManageStaffTeam`, matching `docs/route-permissions-matrix.md` exactly, including the "sales rep is read-only everywhere, even in an assigned company" rule.
- **`tokens/token-service.ts`** — guest resource tokens (order/quote/return/support), same hash-only pattern as staff sessions, via a shared `shared/opaque-token.ts` helper.
- **`idempotency/idempotency.ts`** — `withIdempotency(db, scope, key, run)`, backed by a unique `(scope, key)` DB constraint so a concurrent duplicate call replays the first result rather than double-running.
- **`audit/audit-log.ts`** — `recordAuditEvent` is the only exported function (no update/delete), enforcing append-only by API surface.
- **`validation/commands.ts`** — Zod schemas for submit-basket, company-approval-decision, NCC-approval, return-request, support-ticket-message. Every guest/buyer-facing schema is `.strict()`, so a client-supplied price/total field fails validation outright (the concrete enforcement of CLAUDE.md rule 9) rather than being silently ignored.
- **`integrations/shopify/types.ts`** + **`fixture-adapter.ts`** — `CatalogueAdapter` interface promoted from `docs/integration-contracts.md`, plus a fixture implementation with every SKU/title prefixed `[Fixture]`.
- **`env.ts`** + **`.env.example`** — Zod-validated env (`DATABASE_FILE`, `SESSION_SECRET`, `NODE_ENV`); refuses to boot in production with the built-in insecure dev secret.
- **`seed.ts`** — dev-only, refuses to run when `NODE_ENV=production`, every seeded name/email prefixed `[Fixture]`.

**Files created:** see `TASKS.md` Phase 2 checklist for the exhaustive list with per-item evidence. Also touched: `docs/integration-contracts.md` (aligned `TokenService`/`AuthorizationService` sketches to what was actually built), `IMPLEMENTATION_PLAN.md` (Postgres → SQLite in the environments section), `DECISIONS.md` (ADR-004 revision, ADR-011, plus notes on the staff-auth and authorization/validation design choices).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm test        → Test Files 19 passed (19), Tests 141 passed (141)
$ pnpm typecheck   → tsc --noEmit, no output, exit 0
$ pnpm lint        → eslint ., no output, exit 0
$ pnpm build       → client + SSR bundles both built successfully
```
Migration: `drizzle-kit generate` produced `src/server/db/migrations/0000_curious_calypso.sql`; applied it with `pnpm db:migrate` against a real throwaway file, confirmed all 19 tables present via a direct SQL query, then deleted the file. Seed script: ran `pnpm db:migrate` + `pnpm db:seed` against a second throwaway file, inspected the resulting rows directly (fixture company, two fixture buyers, an active fixture NCC admin, a `pending_id_verification` fixture sales rep), then deleted the file. Neither throwaway file was committed.

**Testing approach note:** mid-phase the user asked to keep tests minimal/essential going forward rather than exhaustive matrices — later modules in this phase (token-service, idempotency, validation, fixture adapter, audit-log) accordingly carry only the required security-property tests and one happy-path check each, not full edge-case coverage. Earlier modules (status transitions, password, session, authorization) were already written more thoroughly before that request landed; they weren't retroactively trimmed since they were already correct and passing.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 2 decisions and facts" section (ADR-004 revision, ADR-011, staff-auth/authorization/validation design notes).

**Unresolved blockers / risks carried forward:** unchanged — PRD §13 Questions 1 (growth trajectory), 4, 5, 6. None block Phase 3. Question 1 (target catalogue size) is the one to watch during Phase 3 itself, since the live store's actual 321 SKUs / 12 collections now become directly relevant to catalogue-adapter pagination/facet design.

**Database migrations / environment variables:**
- Migration: `src/server/db/migrations/0000_curious_calypso.sql` (generated, not yet applied to any persistent dev database — Phase 3+ will run `pnpm db:migrate` against whatever `DATABASE_FILE` the next session's `.env` points to).
- Env vars: `DATABASE_FILE`, `SESSION_SECRET`, `NODE_ENV` — all documented in `.env.example` with no values.

---

## Next phase: Phase 3 — Shopify connectivity and catalogue adapter

**Entry criteria (Phase 2 exit gate, satisfied):**
- Database schema/migrations exist and are verified applying cleanly. ✅
- Status/transition guards, authorization, tokens, idempotency, and validation all exist with passing tests naming the required security properties. ✅
- Typed `CatalogueAdapter` interface and a fixture implementation exist for Phase 3 to build against/alongside. ✅
- No routes or UI were built — scope stayed to the backend foundation only. ✅
- `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

**Exact next-phase prompt** (paste into a **fresh** Claude Code session, unless directed otherwise):

```text
Read CLAUDE.md, the two NCC source documents, the plan, tasks, decisions and last handoff. Inspect git status. Implement only Phase 3.

Build the real Shopify connectivity behind the typed boundaries Phase 2 already defined (src/server/integrations/shopify/types.ts, docs/integration-contracts.md) — do not change those interfaces without a documented reason.

Required work:
- a Storefront API client implementing CatalogueAdapter: products, variants, collections, images, prices, pagination, facets, search, typeahead, against the real nccwholesale.org dev store (Basic plan, 321 SKUs / 12 collections);
- the Customer Account API boundary sketch (login/authorize/return-eligibility) — implement to whatever depth is realistic without a real company-buyer flow to test yet (Phase 7 owns that flow);
- a server-only Admin API boundary (draft order create/update, invoice send, return approval) — never reachable from browser code (CLAUDE.md rule 8); do not perform a live mutation against nccwholesale.org without an explicit environment safety check first, and never in a way that could affect the real 321-SKU catalogue;
- pagination, rate-limit handling, bounded timeouts/retries, typed error mapping, and redacted logging for every outbound call;
- normalization from raw Shopify shapes into the CatalogueAdapter view models already defined;
- keep the fixture adapter selectable by environment variable, never mixed with the live adapter in the same running process;
- a caching/revalidation strategy appropriate for a wholesale catalogue (PRD §7.5);
- a health-diagnostics surface reporting adapter connectivity only, no credentials or raw API responses (CLAUDE.md rule 22).

Do not build the full UI. A minimal diagnostic route is acceptable only if it contains no secrets and is disabled in production.

Write contract tests against the fixture adapter (fast, no network) plus a read-only smoke test against the real dev store (never a mutation, never production). Keep new tests to what's actually required to prove correctness — the user asked mid-Phase-2 to favor minimal, essential test coverage over exhaustive matrices going forward.

Run lint, type-check, test and build. Update tracking documents with evidence and stop after Phase 3.
```
