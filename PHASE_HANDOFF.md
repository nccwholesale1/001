# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Last completed phase: Phase 0 — Discovery, architecture, project memory

**Completed scope:**
- Read PRD, Design System, and build runbook in full.
- Visually cross-checked the reference site (`gleam-grid-shop.lovable.app`) against the Design System doc — consistent, no conflicts found.
- Verified two Shopify platform claims against current documentation/live API rather than trusting the PRD's wording as-is:
  - `draftOrderInvoiceSend` confirmed as a real, current Admin GraphQL mutation.
  - B2B Admin API `companies` resource confirmed reachable against the current dev store (`nccwholesale.org`, Basic plan) — flagged as store-type-dependent, not proof for a production Basic-plan store (see `DECISIONS.md` Question 8).
- Created the full Phase 0 documentation package (see "Files changed" below).

**Files created:**
- `CLAUDE.md`
- `IMPLEMENTATION_PLAN.md`
- `TASKS.md`
- `DECISIONS.md`
- `PHASE_HANDOFF.md` (this file)
- `docs/domain-model.md`
- `docs/route-permissions-matrix.md`
- `docs/integration-contracts.md`
- `docs/NCC-Supply-PRD.md`, `docs/NCC-Supply-Design-System.md`, `docs/NCC-Supply-Claude-Code-Phased-Prompt-Plan.md` (source docs, copied in)

**Verification performed:**
- Manual read-through of all three source documents in full.
- Live read-only Shopify Admin GraphQL query (`companies(first: 1)`) against `nccwholesale.org` — succeeded, no plan-restriction error. Read-only; no mutation performed.
- Docs search against current Shopify developer documentation for B2B API access limits, price-list caps, and native-returns requirements.
- No code exists yet, so no lint/type-check/test/build run applies to this phase.

**Assumptions recorded (not business decisions):** see `DECISIONS.md` ADR-004 (package manager, DB, ORM, staff auth, file storage, email, test tooling).

**Update, 2026-09-12 (same phase, before Phase 1 started):** Business resolved four of the eight open questions:
- No contract/tier pricing anywhere — uniform list pricing for all buyers (ADR-005).
- Consequently, no Shopify B2B "Companies" object — companies/buyers/approval are entirely app-DB owned (ADR-006). This also **resolves the Question 8 plan-tier risk**: Shopify **Basic plan is confirmed sufficient**, since the only feature that risked needing Plus/dev-store-level Admin API access is no longer used.
- Sales-rep verification: admin creates the account with employee ID; activation triggers on the rep's first successful email login (ADR-007).
`DECISIONS.md`, `docs/domain-model.md`, and `docs/integration-contracts.md` were updated in place to reflect this — re-read them, not just this summary, before Phase 1.

**Unresolved blockers / risks carried forward:**
- PRD §13 Questions 1 (growth trajectory only), 4, 5, 6 — see `DECISIONS.md` → "Still awaiting business confirmation." None block Phase 1.
- No database, deployment target, or staff-auth provider has been installed or configured — those are Phase 1/2 work, currently only recommended defaults.

**Database migrations / environment variables:** none yet — no code exists.

---

## Next phase: Phase 1 — Application scaffold and design-system foundation

**Entry criteria (from `IMPLEMENTATION_PLAN.md` / runbook §4 exit gate for the *previous* phase, satisfied):**
- Both source documents read in full. ✅
- Shopify-owned and application-owned data clearly separated. ✅ (`IMPLEMENTATION_PLAN.md` §3, `docs/domain-model.md`)
- Status machines and approval boundaries explicit. ✅ (`docs/domain-model.md`)
- No application implementation begun. ✅
- Open questions remain visible, not silently guessed. ✅ (`DECISIONS.md`)

**Exact next-phase prompt** (paste into a **fresh** Claude Code session, per the one-phase-per-session rule):

```text
Read CLAUDE.md and all project planning/source documents first. Inspect git status. Implement only Phase 1 from IMPLEMENTATION_PLAN.md.

Create the production application scaffold for the PRD's adopted headless TanStack Start architecture using the agreed package manager and strict TypeScript. Add only dependencies justified by this phase.

Build the NCC design-system foundation exactly from docs/NCC-Supply-Design-System.md:
- Tailwind v4 CSS-first semantic tokens under @theme inline;
- light and dark token definitions, but do not add a public dark-mode control unless required;
- Inter loaded in the document head;
- named gradient, surface, mesh and rise-in utilities;
- radii, shadows, typography, spacing and reduced-motion behaviour;
- foundational accessible primitives for buttons, links, fields, badges, status chips, cards, dialogs/sheets and disclosures;
- shared max-width container and responsive layout primitives;
- Lucide icon wrapper with decorative/accessibility handling;
- application error boundary, not-found boundary and loading patterns.

Create Storybook or the agreed isolated component-preview/test surface only if Phase 0 selected it. Add representative states for every primitive, including focus, disabled, error and reduced-motion states.

Add automated checks for token use and the most important primitive behaviours. Components must not use hardcoded colour utilities or raw hex values outside the token stylesheet.

Run formatting, linting, type checks, component tests and a production build. Inspect at 375, 768, 1024 and 1440 px. Fix issues found.

Update TASKS.md, DECISIONS.md and PHASE_HANDOFF.md with evidence. Stop after Phase 1; do not build pages, Shopify integration or business workflows yet.
```

Note: Phase 0 did not select a component-preview tool (no code exists yet to select one against) — Phase 1 should make and record that call itself, consistent with "recommend a default, record the assumption."
