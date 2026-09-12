# NCC Supply — Project Operating Rules

**Product:** NCC Supply — a headless B2B trade storefront for mobile/device accessories and repair parts (chargers, cables, screens, batteries, power banks, audio, iPad digitizers, screen protectors, repair parts). Guest-first ordering with no payment at basket time; NCC reviews and confirms every order before checkout is reachable.

**Source of truth, read every session, in this order:**

1. `CLAUDE.md` (this file)
2. `docs/NCC-Supply-PRD.md` — product source of truth
3. `docs/NCC-Supply-Design-System.md` — visual source of truth
4. `IMPLEMENTATION_PLAN.md`
5. `TASKS.md`
6. `DECISIONS.md`
7. `PHASE_HANDOFF.md` (if present from a prior session)

`docs/NCC-Supply-Claude-Code-Phased-Prompt-Plan.md` is the build runbook — the phase prompts, exit gates, and operating rhythm below are sourced from it. It is a working reference, not re-read as product spec every session, but its per-phase prompts are what get pasted to start each new phase.

The reference site `https://gleam-grid-shop.lovable.app/` is a visual grounding aid confirmed to match the Design System doc. It is not a source of business rules, content, or data model — those come only from the PRD.

---

## Permanent operating rules

1. At the start of every session, read `CLAUDE.md`, `docs/NCC-Supply-PRD.md`, `docs/NCC-Supply-Design-System.md`, `IMPLEMENTATION_PLAN.md`, `TASKS.md`, and `DECISIONS.md` before editing code.
2. Treat the PRD as the product source of truth and the design-system document as the visual source of truth. Do not substitute patterns from tutorials, starter templates, demo stores, or other websites.
3. Implement only the requested phase. Do not quietly begin later phases.
4. Inspect existing code and `git status` before modifying anything. Preserve unrelated work.
5. Keep the current live NCC website untouched. Build and deploy a separate headless application.
6. Use strict TypeScript. Avoid `any`, ignored errors, placeholder production logic, and duplicated business rules.
7. Use Shopify for the responsibilities assigned to it in PRD §7.1 and the custom backend only for the responsibilities in §7.2.
8. Keep Shopify and backend access behind typed server-side service/data-adapter boundaries. Never expose Admin API credentials or privileged operations to browser code.
9. Resolve contract pricing and authorization server-side. Never trust company, role, price, totals, approval status, or entitlement values supplied by the client.
10. Never show live stock quantities, scarcity messaging, ratings, reviews, testimonials, or promised delivery dates.
11. Use "Available to order." Basket submission is not checkout and must never collect payment details.
12. No checkout route or payment link may be usable until an NCC admin has approved the order and it is `confirmed`.
13. Every company buyer order requires company-admin approval before NCC review, regardless of amount. Guest orders skip only the company approval step, not NCC approval.
14. NCC approval is one atomic action that confirms allowed quantities, delivery, VAT, final total, and order status.
15. Quantities may be reduced or removed during NCC review, never silently increased. Customer quantity inputs accept any positive integer.
16. Guest order, quote, return, and support status links must use strong, unguessable, expiring or revocable tokens stored securely. Prevent enumeration and cross-tenant access.
17. Apply least-privilege authorization to every server action and loader. A company can access only its data; a sales representative can access only assigned companies; only NCC admins can approve or mutate protected staff data.
18. Use semantic design tokens only. Do not hardcode colours in components. Follow the supplied Tailwind v4 CSS-first system.
19. Build mobile-first and meet WCAG 2.2 AA. Respect reduced motion.
20. Product and collection content must come through the data adapter. Demo fixtures must be clearly marked as development-only and must never appear as real inventory.
21. Validate all external inputs on the server. Protect mutations against replay, CSRF where applicable, privilege escalation, unsafe file upload, injection, and accidental duplicate submission.
22. Never print, commit, or expose secrets. Maintain `.env.example` with names and explanations only.
23. A phase is not complete until its acceptance criteria are demonstrated by relevant type checks, linting, automated tests, build output, and manual/visual checks.
24. After each phase, update `TASKS.md`, `DECISIONS.md`, and `PHASE_HANDOFF.md`. Record commands run, proof of verification, remaining risks, and the exact next-phase prompt.
25. Do not claim something works without evidence. If an integration cannot be tested because credentials or business answers are unavailable, keep it behind an adapter, test the contract with fixtures, and record the precise blocker.

---

## Session rhythm

- One phase per Claude Code session. Use Plan Mode for phases with real architectural decisions (Phase 0 always; others as needed).
- Before each commit: present a diff summary and verification evidence.
- Keep secrets, generated build output, and local environment files out of Git.
- Branch naming: `phase/0-planning`, `phase/1-foundation`, `phase/2-domain-backend`, `phase/3-shopify-catalogue`, `phase/4-public-home`, `phase/5-product-discovery`, `phase/6-guest-orders`, `phase/7-company-accounts`, `phase/8-admin-confirmation`, `phase/9-bulk-quotes`, `phase/10-returns-support`, `phase/11-staff-team`, `phase/12-quality-hardening`, `phase/13-real-content`, `phase/14-release-readiness`.
- Production launch requires the separate launch prompt in the runbook (§18) and explicit human authorization — never inferred from phase completion.
