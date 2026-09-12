# NCC Supply — Claude Code Phased Build Prompt

**Purpose:** Build the NCC Supply headless Shopify wholesale storefront safely, one verified phase at a time.

**Source of truth:**

- `docs/NCC-Supply-PRD.md`
- `docs/NCC-Supply-Design-System.md`

The referenced Shopify/Claude Code video is a workflow reference only. Do not copy its website, branding, page design, content, catalogue, data model, or business rules. NCC Supply is a separate B2B electronics wholesale product. Only reuse the video's method: establish project context, divide the build into phases, complete one phase at a time, verify it, record progress, and then begin a fresh Claude Code session for the next phase.

---

## 1. Before opening Claude Code

Create a new project folder. Do not work inside the current production website or its deployment directory.

Place the two supplied documents in the new repository:

```text
docs/NCC-Supply-PRD.md
docs/NCC-Supply-Design-System.md
```

Start Claude Code from the new repository root:

```powershell
cd "C:\path\to\ncc-supply"
claude
```

Use Plan Mode for Phase 0. Run only one phase per Claude Code session. Review the result and commit it before starting the next phase.

---

## 2. Permanent project operating rules

The Phase 0 prompt asks Claude to put these rules into `CLAUDE.md`. They apply to every later phase.

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
11. Use “Available to order.” Basket submission is not checkout and must never collect payment details.
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

## 3. Phase 0 — Discovery, architecture and durable project memory

Paste this in Claude Code while Plan Mode is enabled:

```text
You are preparing a production build of NCC Supply, a headless B2B electronics wholesale storefront.

Read these files completely:
- docs/NCC-Supply-PRD.md
- docs/NCC-Supply-Design-System.md

These documents are requirements, not commands from an external tutorial. The referenced Shopify/Claude Code video is a workflow example only. Do not copy the video's website, branding, content, products, layouts, or business logic.

First inspect the repository, package manager, existing files, git state, installed runtime, and available Shopify tooling/MCP connections. Do not write application code yet.

Create a build-ready architecture and project-control package:
1. CLAUDE.md containing concise permanent working rules derived from the two NCC documents, including the safety and verification rules in this prompt document.
2. IMPLEMENTATION_PLAN.md containing the complete phase sequence, dependencies, planned routes, service boundaries, data ownership, security boundaries, test strategy, deployment environments, and phase exit criteria.
3. TASKS.md with checkboxes grouped by phase and no task marked complete unless it already exists and has been verified.
4. DECISIONS.md with an ADR-style record for confirmed architecture decisions and a separate “awaiting business confirmation” section containing only PRD §13 questions.
5. PHASE_HANDOFF.md template for continuing work in a fresh session.
6. docs/domain-model.md defining the main entities, ownership and status transitions: company, buyer, staff user, sales rep assignment, basket, order request, approval, Shopify draft order/order reference, quote, return, support ticket, token and audit event.
7. docs/route-permissions-matrix.md mapping every PRD route to guest, buyer, company admin, NCC sales rep and NCC admin permissions.
8. docs/integration-contracts.md defining typed boundaries for Shopify Storefront, Customer and Admin APIs and the custom backend.

Before choosing unspecified infrastructure, identify decisions the PRD does not settle, especially database, ORM, deployment provider, staff-auth provider, file storage, email delivery and test tooling. Recommend a minimal production-suitable default for each, explain the trade-off, and record assumptions separately from confirmed decisions. Do not pretend the PRD's open questions are answered.

Verify current Shopify capabilities and API constraints against official Shopify documentation before locking implementation details. If MCP documentation tools are available, use them for current API facts. Never put secrets into project files.

Finish by showing:
- the architecture summary;
- exact files created or changed;
- unresolved decisions that can block later phases;
- risks or contradictions found in the requirements;
- the proposed Phase 1 entry criteria.

Stop after documentation and planning. Do not scaffold or implement the application in this phase.
```

### Phase 0 exit gate

- Both source documents have been read in full.
- All routes and roles appear in the permissions matrix.
- Shopify-owned and application-owned data are clearly separated.
- Status machines and approval boundaries are explicit.
- No application implementation has begun.
- Open questions remain visible and are not silently guessed.

---

## 4. Phase 1 — Application scaffold and design-system foundation

Start a fresh Claude Code session and paste:

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

### Phase 1 exit gate

- The application runs locally and builds successfully.
- Semantic tokens and reusable primitives match the design-system specification.
- Keyboard focus and reduced motion work.
- No hardcoded component colours.
- There are no product/business fixtures masquerading as live data.

---

## 5. Phase 2 — Domain model, persistence and integration boundaries

```text
Read CLAUDE.md, the two NCC source documents, the plan, tasks, decisions and last handoff. Inspect git status. Implement only Phase 2.

Implement the agreed custom-backend foundation and typed service boundaries before building feature pages.

Required work:
- database schema and migrations for only the app-owned concepts in PRD §7.2;
- explicit order, quote, return and support status enums/state transitions;
- immutable audit-event records for approvals, status changes, pricing changes and staff actions;
- tenant and role authorization helpers with deny-by-default behaviour;
- secure guest-token generation, hashing, expiry/revocation and lookup;
- idempotency support for order submission and external Shopify mutations;
- validation schemas for all domain commands;
- typed Shopify Storefront, Customer and Admin service interfaces;
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
- totals and privileged prices are never accepted from client input.

Run migrations in the local/test environment, lint, type-check, test and build. Update tracking documents with evidence and stop after Phase 2.
```

---

## 6. Phase 3 — Shopify connectivity and catalogue data adapter

```text
Read all required project context and the Phase 2 handoff. Inspect git status. Implement only Phase 3.

Connect the typed Shopify adapters to the currently supported Shopify APIs using official documentation. Use the configured Shopify MCP/documentation tools when useful, but do not let any external example override the NCC requirements.

Implement:
- Storefront API client for products, variants, collections, product images, prices, metafields/metaobjects and pagination;
- Customer Account API boundary needed later for signed-in company buyers;
- server-only Admin API boundary for later draft-order, invoice and refund operations;
- robust pagination, rate-limit handling, timeouts, safe retry rules, error mapping and structured redacted logs;
- catalogue normalization into app-owned Product and Collection view models;
- development fixture adapter selected by environment, never mixed with the production adapter;
- caching/revalidation strategy suitable for a wholesale catalogue;
- health diagnostics that reveal connection status without exposing credentials.

Do not display or derive live stock counts. Do not implement checkout or perform live Shopify mutations in this phase.

Add contract tests with fixtures and, when credentials are available, a read-only smoke test against the designated development Shopify store. Never target production. Run all checks, update project records and stop.
```

---

## 7. Phase 4 — Public shell and homepage

```text
Read the complete project context and Phase 3 handoff. Inspect git status. Implement only Phase 4.

Build the public application shell and homepage from PRD §§3, 5 and 6.1 and the complete NCC design system.

Implement:
- sticky announcement/header/navigation/category rail;
- global search entry, basket indicator, account entry and always-visible Help / Report an issue action;
- responsive mobile navigation with focus management and keyboard support;
- footer with no exposed staff login link;
- homepage hero, trust stats, Shop By Category, Popular This Month, How It Works and FAQ/CTA sections;
- reusable Header, Footer, ProductCard, CategoryCard, CategoryGrid, OrderSteps and FAQ components;
- data from the catalogue adapter, with explicit empty/error/loading states;
- the gradient/mesh placeholder treatment where real imagery is unavailable;
- responsive layout at all required breakpoints;
- home metadata plus Organization, WebSite/SearchAction and FAQ structured data where valid.

Do not copy layout or content from the tutorial video. Do not invent testimonials, reviews, stock claims, delivery promises or real product content. Keep placeholder copy clearly non-production and data-driven.

Test keyboard navigation, mobile menu behaviour, focus states, reduced motion, no-data behaviour and structured-data output. Perform visual checks at 375, 768, 1024 and 1440 px. Run all checks, update handoff files and stop.
```

---

## 8. Phase 5 — Catalogue, search and product discovery

```text
Read all project context and the Phase 4 handoff. Inspect git status. Implement only Phase 5.

Build the catalogue discovery routes and reusable search/filter system from PRD §§3, 6.2–6.4, 7.5 and 9:
- /categories;
- /category/:slug;
- /search;
- /product/:sku.

Implement collection browsing, typeahead suggestions, server-backed full-catalogue search, brand/category/compatibility/grade/price facets, shareable URL state, sorting, result counts, applied chips, clear-all, pagination, mobile full-screen filter sheet, breadcrumbs, product gallery/specifications and quantity/add-to-basket control.

All product strings and pricing must come through the data adapter. Signed-in contract pricing is server-resolved; if identity is not ready, retain the typed seam and show only public list price. Use “Available to order,” never stock counts or delivery promises.

Add correct empty states without fake products. Implement canonical handling for filtered pages, noindex for empty combinations, Product/ItemList/Breadcrumb structured data and unique route metadata.

Test URL round-tripping, filtering, sorting, pagination boundaries, empty/error states, typeahead keyboard behaviour and mobile sheet focus trapping. Run all checks, visually verify all breakpoints, update tracking documents and stop.
```

---

## 9. Phase 6 — Basket and guest order-request vertical slice

```text
Read all context and the Phase 5 handoff. Inspect git status. Implement only Phase 6.

Build a complete guest basket-to-order-request vertical slice from PRD §§4, 6.5 and 6.7, stopping before real payment.

Implement:
- add/update/remove basket lines;
- persistent guest basket using the agreed safe approach;
- any-positive-integer quantity validation with no MOQ or maximum business limit;
- server-side product/price lookup and total calculation;
- ex-VAT subtotal plus clear copy that delivery and VAT are confirmed later;
- contact details and accessible validation;
- idempotent “Submit basket” action whose copy never says Pay or Checkout;
- an app-owned submitted order request in `awaiting_ncc_review` state;
- a secure guest status URL and /order-submitted confirmation;
- token-gated /order/:id status/detail view;
- original-versus-confirmed quantity model, even though approval comes later;
- noindex/security headers appropriate to private routes.

Do not create a payable Shopify order, capture card data, send a payment link or expose checkout. Do not accept prices/totals/status from browser state.

Test tampered prices, invalid quantities, repeated submit, token failure, ID enumeration, expired/revoked token, basket restoration, and responsive/keyboard behaviour. Run all checks, update tracking documents and stop.
```

---

## 10. Phase 7 — Company accounts, buyer identity and company approval

```text
Read all context and the Phase 6 handoff. Inspect git status. Implement only Phase 7.

Implement company buyer identity and company-side approval according to PRD §§2, 4, 6.10–6.13 and 7.4.

Use Shopify's current customer-account flow for company buyers as decided in the architecture. Do not create a separate buyer password system. Implement server-side mapping from Shopify customer/company identity to app-owned workflow records.

Build:
- /auth and /register buyer/invite paths as specified;
- /account shell and dashboard;
- /account/orders with buyer-own vs company-admin-all visibility;
- reorder action that creates a new basket;
- /account/users for invites, roles, spend limits and removal;
- /account/pricing as read-only server-resolved entitlement data;
- buyer order submission into `awaiting_company_approval`;
- company-admin approve/reject actions and clear pending states;
- audit events for every approval, role, limit and user-state change.

Every company buyer order requires company-admin approval regardless of spend limit. Spend limits are informational context only. A company-admin approval advances the request to NCC review; it never confirms the order or unlocks payment.

Test cross-company isolation, buyer/admin visibility, removed-user behaviour, pending invites, replayed approval, unauthorized price access and all status transitions. Run all checks, update tracking documents and stop.
```

---

## 11. Phase 8 — NCC order console, Shopify draft order and confirmed checkout

```text
Read all context and the Phase 7 handoff. Inspect git status. Implement only Phase 8.

Build the NCC order review and confirmation workflow from PRD §§4, 6.7, 6.9 and 7.1.

Implement:
- protected /staff/orders and /staff/order/:id routes;
- staff authentication boundary needed for NCC admins;
- queue states that distinguish awaiting review from confirmed;
- per-line confirmed quantities, allowing zero and preventing increases above requested quantity;
- delivery and VAT inputs, server-side recalculated final totals, internal notes and invoice-link field;
- one atomic NCC-admin Approve action that validates and records quantities, delivery, VAT, total and status together;
- Cancel with required reason and audit record;
- Shopify Draft Order creation/update only after successful NCC approval;
- secure invoice/payment link handling using the current supported Shopify flow;
- /checkout/:id guard that redirects to order view unless status is confirmed;
- confirmed customer order view showing original versus confirmed lines, removals, delivery, VAT and final total;
- cash-on-delivery and invoice-payment options only when confirmed.

Design external mutations for idempotency and partial-failure recovery. Never leave the app confirmed while Shopify creation failed without an explicit recoverable reconciliation state. Never expose Admin API access to the client.

Use a development Shopify store only. Place every live mutation behind an explicit environment safety check. Test unauthorized access, quantity increase attempts, double approval, Shopify timeout/failure, reconciliation, unconfirmed checkout access and final-total integrity. Run all checks, update records and stop.
```

---

## 12. Phase 9 — Bulk ordering, quotes and reorder completion

```text
Read all context and the Phase 8 handoff. Inspect git status. Implement only Phase 9.

Build the high-speed wholesale tools from PRD §§4, 6.6, 6.8, 6.11 and 6.14:

Bulk order:
- /bulk-order CSV upload and SKU/quantity paste alternative;
- downloadable template;
- up to 500 rows as an implementation default;
- secure server parsing with file-size/type limits;
- matched/unmatched preview where every row receives an outcome and reason;
- add matched rows to basket without silently dropping failures.

Quotes:
- /quote request flow and token/account-based /quote/:id detail;
- requested, quoted, accepted and expired status flow;
- /staff/quotes queue and NCC-admin-only line pricing/issue action;
- explicit customer Accept Quote action;
- accepted quote becomes an order request entering normal NCC review and never skipping approval;
- quote does not imply confirmed availability or create payment obligation before acceptance.

Reorder:
- ensure reorder uses current catalogue identity and current entitled pricing;
- clearly report unavailable/discontinued/unmatched lines rather than silently omitting them.

Test hostile/malformed CSV, duplicate SKU rows, formula injection in exports, over-500 handling, unmatched rows, quote token isolation, quote expiry, repeated acceptance and unauthorized pricing. Run all checks, update records and stop.
```

---

## 13. Phase 10 — Returns and support cases

```text
Read all context and the Phase 9 handoff. Inspect git status. Implement only Phase 10.

Build returns and support as first-class trackable workflows from PRD §§4 and 6.16–6.21.

Returns:
- /returns reachable with confirmed-order context, never as an unbound return;
- eligible line and quantity picker, reason, optional note/photo;
- /returns/:id token/account status timeline;
- /account/returns history;
- /staff/returns queue and approve/reject/refund/replacement actions;
- current Shopify native return/refund integration where applicable.

Support:
- /support ticket form for guests and accounts;
- category, optional order/return reference, message and optional attachment;
- /support/:id private status timeline and reply thread;
- /staff/support queue, replies, internal notes, statuses and escalation action.

Use the same case-view component family for return and support status. Validate attachments by content, size and type; store them privately; scan or quarantine according to the selected infrastructure; serve through authorized expiring access. Never rely on email as the only status record.

Where return policies or support SLAs remain unanswered in PRD §13, implement configuration points and safe neutral states rather than inventing business policy.

Test order/line eligibility, return quantity limits, cross-tenant and token isolation, attachment attacks, staff authorization, timeline announcements for assistive technology, invalid transitions and Shopify refund failure recovery. Run all checks, update records and stop.
```

---

## 14. Phase 11 — Staff accounts, team management and sales-rep scoping

```text
Read all context and the Phase 10 handoff. Inspect git status. Implement only Phase 11.

Complete internal staff capabilities from PRD §§2, 6.15, 6.22 and 7.2:
- NCC staff sign-in using one identifier field accepting email or username;
- /staff/accounts company management and contract-pricing administration;
- /staff/team restricted to NCC admins;
- create, activate, deactivate and role-manage NCC admin/sales-rep accounts;
- require unique valid employee ID before a sales-rep account can activate;
- assign/reassign sales representatives to company accounts;
- read-only sales-rep views for assigned companies' orders, quotes and returns;
- deny sales reps approval, quote pricing, spend-limit edits and unassigned-company access;
- complete audit history for staff and assignment changes.

Company buyer sign-in remains email-only. Do not expose any staff route or link in public navigation/footer.

Test email/username ambiguity, case normalization, duplicate username/ID, activation without ID, role downgrade, deactivated sessions, horizontal privilege escalation, direct URL access and server-action authorization. Run all checks, update records and stop.
```

---

## 15. Phase 12 — SEO, AEO, accessibility, performance and security hardening

```text
Read all context and the Phase 11 handoff. Inspect git status. Implement only Phase 12.

Audit and harden the entire application against PRD §§9–11 and every acceptance criterion.

SEO/AEO:
- unique titles/descriptions, canonical URLs, Open Graph/Twitter metadata;
- Organization, FAQPage, ItemList, Product and BreadcrumbList structured data where valid;
- one H1 and semantic headings;
- canonical filtered URLs and noindex empty-result facets;
- noindex basket, checkout, account, private token, quote and staff routes;
- robots and sitemap rules that include only legitimate public routes;
- question-and-answer content covering the required NCC ordering topics without inventing policy.

Accessibility:
- automated WCAG checks plus keyboard-only review;
- focus order, focus trapping/restoration, labels, live regions and status timelines;
- contrast verification and non-colour status communication;
- responsive checks at 375, 768, 1024 and 1440 px;
- reduced-motion verification.

Performance:
- route and bundle analysis;
- image dimensions/formats/loading to prevent layout shift;
- server/data cache review;
- realistic catalogue pagination/search checks;
- agreed performance budgets measured in a production build.

Security:
- route/action authorization matrix test coverage;
- tenant isolation and IDOR review;
- token, session, CSRF, XSS, injection, upload and secret-exposure review;
- rate limiting and abuse handling for public submissions/search;
- dependency and configuration audit;
- redacted observability and safe error messages.

Produce docs/quality-audit.md containing evidence and remaining exceptions. Fix findings in scope, run the complete test suite and production build, update project records and stop.
```

---

## 16. Phase 13 — Real catalogue, assets and content readiness

```text
Read all context and the Phase 12 handoff. Inspect git status. Implement only Phase 13.

Prepare the staging application for real NCC data without changing the production storefront.

Use the designated development/staging Shopify store. Import or connect real products, variants, collections, images and metafields only from NCC-approved sources. Configure the ten launch collections from the PRD and any additional confirmed collections. Do not invent products, SKUs, pricing, policy or stock.

Replace visual placeholders only with supplied/approved NCC assets. Preserve the design-system image treatment and accessible alt text. Verify logo variants, responsive crops, image dimensions and performance.

Create a content-readiness report listing every remaining placeholder, missing image, missing policy answer, unconfigured price list and failed data mapping. Do not hide missing data with fabricated content.

Run catalogue sampling across small/large collections, unusual titles, missing images, multiple variants, price formats and empty facets. Re-run metadata, structured-data, accessibility, performance and production-build checks. Update records and stop.
```

---

## 17. Phase 14 — Staging, end-to-end acceptance and launch preparation

```text
Read all context and the Phase 13 handoff. Inspect git status. Implement only Phase 14.

Prepare a separate staging deployment. Do not alter, replace, redirect or deploy over the current live NCC website.

Build an end-to-end acceptance matrix covering every PRD acceptance criterion and all primary roles:
- guest buyer;
- company buyer;
- company admin;
- NCC sales representative;
- NCC admin.

Exercise complete journeys:
- browse/search/product/basket;
- guest submission to NCC confirmation to allowed checkout;
- company buyer submission to company approval to NCC confirmation;
- bulk order and unmatched rows;
- quote request, issue, acceptance and normal approval;
- reorder;
- return request and resolution;
- support ticket and replies;
- staff/team permissions and sales-rep account scoping.

Test failure and recovery paths, email/link behaviour, duplicate actions, Shopify outage/retry, expired tokens, removed users and cancelled orders. Confirm observability, backups, migration and rollback procedures. Confirm secrets and environment separation.

Create:
- docs/UAT-CHECKLIST.md;
- docs/DEPLOYMENT-RUNBOOK.md;
- docs/ROLLBACK-RUNBOOK.md;
- docs/RELEASE-READINESS.md;

Do not launch production. Finish with a go/no-go report that lists blocking, non-blocking and business-owned items, plus the exact production-launch steps requiring human authorization. Update all tracking documents and stop.
```

---

## 18. Production launch prompt — use only after UAT approval

Do not paste this until the business has approved staging, answered launch-blocking questions, supplied production credentials through secure environment settings, and confirmed the deployment target.

```text
Read the complete project context, deployment/rollback runbooks and release-readiness report. Inspect git status and confirm the approved release commit.

Before making any production change, show me:
1. the exact target environment and domain;
2. the exact release commit/tag;
3. database migration and rollback steps;
4. Shopify production connection checks;
5. current-site impact and cutover plan;
6. monitoring and smoke-test plan;
7. every action that requires my confirmation.

Do not deploy, migrate production data, alter DNS, change Shopify configuration or replace the current site until I explicitly approve the exact action. After approval, execute only the approved runbook, verify every critical journey, and roll back on a defined critical failure rather than improvising.
```

---

## 19. Standard phase-completion prompt

If Claude stops after implementation but before proving completion, paste:

```text
Do not start the next phase. Re-read this phase's exit criteria and verify the work you just completed.

Run the relevant formatter, lint, strict type check, automated tests and production build. Perform the required responsive, keyboard, accessibility, security and integration checks for this phase. Fix failures and rerun them.

Then update TASKS.md, DECISIONS.md and PHASE_HANDOFF.md with:
- completed scope;
- files changed;
- verification commands and actual results;
- manual checks performed;
- assumptions and unresolved blockers;
- known risks or deferred work;
- database migrations and environment-variable changes;
- the exact next-phase prompt.

Show the evidence and stop. Do not claim completion based only on code inspection.
```

---

## 20. Standard fresh-session continuation prompt

Use this at the beginning of any new Claude Code session:

```text
Continue the NCC Supply build from the repository's recorded state.

Before editing anything:
1. read CLAUDE.md;
2. read docs/NCC-Supply-PRD.md and docs/NCC-Supply-Design-System.md;
3. read IMPLEMENTATION_PLAN.md, TASKS.md, DECISIONS.md and PHASE_HANDOFF.md;
4. inspect git status and recent commits;
5. verify the last completed phase from evidence rather than assuming it is complete.

Summarize the current state, identify the next incomplete phase and state its exit criteria. Implement only that phase after confirming there is no blocking contradiction or missing business decision. Complete its tests and handoff documentation, then stop.
```

---

## 21. Recommended Git rhythm

Keep each phase reviewable:

```text
phase/0-planning
phase/1-foundation
phase/2-domain-backend
phase/3-shopify-catalogue
phase/4-public-home
phase/5-product-discovery
phase/6-guest-orders
phase/7-company-accounts
phase/8-admin-confirmation
phase/9-bulk-quotes
phase/10-returns-support
phase/11-staff-team
phase/12-quality-hardening
phase/13-real-content
phase/14-release-readiness
```

Before each commit, ask Claude to present the diff summary and verification evidence. Keep secrets, generated build output and local environment files out of Git.

---

## 22. Decisions NCC must supply during the build

Claude must not invent answers to these PRD questions:

1. Launch catalogue size and expected growth.
2. Number of companies requiring distinct contract pricing.
3. Contract pricing model.
4. ERP, PIM or accounting integrations.
5. Return window and resolution policy.
6. Support SLA and escalation rules.
7. Whether employee-ID format/uniqueness is sufficient for sales-rep verification.
8. Shopify plan tier and the currently available plan-specific capabilities.

Phase 0 may also surface implementation decisions not fixed by the PRD, such as hosting, database, ORM, staff authentication, private file storage and email delivery. Record these separately so technical assumptions are never mistaken for NCC business decisions.

