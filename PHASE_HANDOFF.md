# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 1 — Application scaffold and design-system foundation

**Completed scope:**
- Scaffolded the TanStack Start app into `ncc-supply/` via `npx @tanstack/cli create` (pnpm, no add-ons, no nested git — tracked by this repo's own git).
- Wired Tailwind v4 (`@tailwindcss/vite`) per current official docs, verified live during planning.
- Replaced the scaffold's generic placeholder theme/content entirely (`ThemeToggle.tsx`, `Header.tsx`, `Footer.tsx`, `about.tsx` demo route, and the "sea/lagoon" placeholder CSS all removed) with the real NCC design-system tokens in `src/styles.css`.
- Built 9 accessible primitives in `src/components/ui/`: Button, Link (router + external), Field/TextareaField, Badge, StatusChip, Card, Disclosure, Dialog (Radix-based), Icon, plus Layout (Container/Section/ResponsiveGrid).
- Built app-level boundaries in `src/components/app-boundaries/`: ErrorBoundary, NotFound, Pending — wired into `src/routes/__root.tsx`.
- Built the dev-only `/dev/components` preview route (noindex) showing every primitive/state.
- Added the tooling the default scaffold didn't include: Vitest + Testing Library (`vitest.config.ts`, separate from the main Vite config to avoid the SSR plugin), ESLint flat config with `eslint-plugin-jsx-a11y`, Prettier.
- **Two real bugs found and fixed during the required visual breakpoint check** (not caught by lint/typecheck/tests, since they were CSS token wiring issues): see DECISIONS.md ADR-008. Summary: (1) the site was auto-switching to dark mode from OS preference, which the user flagged immediately and which also contradicts the design system's own "light... no dark hero" principle — fixed to render light unconditionally; (2) as part of the same fix, `--gradient-surface`/`--gradient-hero` were found to be hardcoded light-only literals that would have made card titles unreadable had dark mode ever activated — now derived from theme tokens instead.

**Files created/changed:** see `TASKS.md` Phase 1 checklist for the full list; headline additions are `ncc-supply/src/styles.css`, `ncc-supply/src/components/ui/*`, `ncc-supply/src/components/app-boundaries/*`, `ncc-supply/src/routes/__root.tsx`, `ncc-supply/src/routes/index.tsx`, `ncc-supply/src/routes/dev/components.tsx`, `ncc-supply/vitest.config.ts`, `ncc-supply/vitest.setup.ts`, `ncc-supply/eslint.config.js`, `ncc-supply/.prettierrc.json`.

**Verification performed (actual output, not inspection-only):**
```
$ pnpm typecheck   → tsc --noEmit, no output, exit 0
$ pnpm lint        → eslint ., no output, exit 0
$ pnpm test        → Test Files 6 passed (6), Tests 47 passed (47)
$ pnpm build       → client + SSR bundles both built successfully
```
Manual: `pnpm dev` run, checked via the Browser tool at 375×812, 768×1024, 1024×800, and 1440×900 on both `/` and `/dev/components`; keyboard Tab reached every interactive element with a visible focus ring; Dialog opened on click, trapped focus, closed on Escape, and returned focus to its trigger; Disclosure open/closed and chevron rotation confirmed visually (native `<details>` Enter/Space-to-toggle is a browser guarantee jsdom doesn't simulate, noted in the test file rather than skipped silently).

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 1 decisions and facts" section (ADR-008, ADR-009, and the scaffold-tooling facts).

**Unresolved blockers / risks carried forward:** unchanged from Phase 0 — PRD §13 Questions 1 (growth trajectory), 4, 5, 6. None block Phase 2.

**Database migrations / environment variables:** none yet — Phase 2's job.

---

## Next phase: Phase 2 — Domain model, persistence, integration boundaries

**Entry criteria (Phase 1 exit gate, satisfied):**
- The application runs locally and builds successfully. ✅
- Semantic tokens and reusable primitives match the design-system specification. ✅ (and one real drift was caught and corrected, not just assumed correct)
- Keyboard focus and reduced motion work. ✅
- No hardcoded component colours. ✅ (enforced by an automated test, not just a manual claim)
- There are no product/business fixtures masquerading as live data. ✅ (index route is explicitly a placeholder, dev-marked)

**Exact next-phase prompt** (paste into a **fresh** Claude Code session):

```text
Read CLAUDE.md, the two NCC source documents, the plan, tasks, decisions and last handoff. Inspect git status. Implement only Phase 2.

Implement the agreed custom-backend foundation and typed service boundaries before building feature pages.

Required work:
- database schema and migrations for only the app-owned concepts in PRD §7.2 (as revised by DECISIONS.md ADR-006 — companies/buyers/locations are now app-owned too, not Shopify B2B);
- explicit order, quote, return and support status enums/state transitions (per docs/domain-model.md);
- immutable audit-event records for approvals, status changes, pricing changes and staff actions;
- tenant and role authorization helpers with deny-by-default behaviour;
- secure guest-token generation, hashing, expiry/revocation and lookup;
- idempotency support for order submission and external Shopify mutations;
- validation schemas for all domain commands;
- typed Shopify Storefront, Customer and Admin service interfaces (per docs/integration-contracts.md, as revised — no B2B-specific Admin API surface needed);
- mock/fixture adapters for local development and contract tests;
- environment validation and .env.example without values;
- seed data that is unmistakably development-only.

Do not build the full UI. A minimal diagnostic route is acceptable only if it contains no secrets and is disabled in production.

Write tests proving:
- cross-company access is denied;
- sales reps cannot escape assigned-company scope;
- company buyers cannot perform admin actions;
- only NCC admins can approve orders or mutate protected staff records;
- invalid status transitions fail;
- tokens cannot be enumerated and raw tokens are not stored;
- duplicate submissions are idempotent;
- totals and privileged prices are never accepted from client input;
- a sales-rep account cannot activate before an employee ID is on file, and activates automatically on first successful email sign-in (ADR-007).

Run migrations in the local/test environment, lint, type-check, test and build. Update tracking documents with evidence and stop after Phase 2.
```
