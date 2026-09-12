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
| Database | Postgres | Works on every likely host; strong fit for the relational approval/audit model in §7.2 |
| ORM | Drizzle | Typed, lightweight, integrates cleanly with TanStack Start server functions |
| Deployment target | Not yet chosen (Vercel or a Node-friendly host) | No cost/ops implication until nearer Phase 14 — deliberately deferred, not defaulted |
| Staff auth | Credentials-based session (e.g. Lucia/Auth.js, credentials provider) | Internal tool only; company buyers already use Shopify's flow (ADR-003) |
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
