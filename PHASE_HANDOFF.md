# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Most recent work: Phase 12, security-only slice (not the full phase)

**Scope decision (user's explicit choice, 2026-09-13):** ahead of standing up a staging deployment, the user chose to run only the security-relevant half of Phase 12 now — authorization, tenant isolation, injection/XSS, uploads, secrets, rate limiting — deferring SEO/AEO, accessibility, performance, and a dependency audit to a later full Phase 12 pass. See `docs/quality-audit.md` for the complete writeup and DECISIONS.md ADR-037.

**Two real gaps found and fixed** (not just reviewed):
1. 12 inline server functions defined inside route files (`support/$id.tsx`, `returns/$id.tsx`, `returns/index.tsx`, `quote/$id.tsx` ×2, `checkout/$id.tsx`, `order/$id.tsx`, `category/$slug.tsx`, `search.tsx` ×2, `product/$sku.tsx`) validated their `.validator()` RPC boundary with a bare TypeScript-typed passthrough — no runtime validation at all, directly callable regardless of what the app's own UI happens to send. The worst instance: a customer's support-ticket reply had no length/size cap, even though the exact schema needed (`supportTicketMessageSchema`) already existed in `validation/commands.ts` and was simply never wired up. All 12 now validate for real.
2. No rate limiting existed anywhere for this app's own endpoints. Added `server/shared/rate-limit.ts` (in-memory, fixed-window, its own test suite) on staff sign-in (by IP and by identifier independently), the site-access gate, and every guest-writable submission (order/quote/return/support-ticket/support-reply). Recorded limitation: in-process only, doesn't survive a restart or coordinate across multiple instances — fine for a single-instance deployment, not a substitute for a shared store if this scales out.

Everything else audited (authorization matrix, tenant isolation, sessions/CSRF, injection, XSS, upload validation, password hashing) was reviewed against real code and existing tests and found already sound — cited as evidence in `docs/quality-audit.md`, not re-derived from scratch.

**Verification:** `pnpm typecheck`/`lint`/`test` (60 files, 441 passed/1 skipped)/`build` all clean; client bundle re-swept, clean.

**Not done in this slice (deferred, tracked in TASKS.md):** SEO/AEO, accessibility, performance budgets, dependency/configuration audit.

**Hosting recommendation given (Phase 14, not yet started):** Vercel (app) + Turso (database) — see `docs/quality-audit.md`'s final section for reasoning. Account creation is the user's own action; not yet done.

---

## Last completed full phase: Phase 10 + 11 (merged) — Returns, support, staff accounts, team management

**Completed scope:** PRD §§4, 6.15-6.22, 2, 7.2, on branch `phase/10-returns-support`. Merged into one session at the user's explicit request to move faster. As with Phase 9, most schema/domain groundwork (`returns`, `supportTickets`, `transitionReturn`, `transitionStaff`, `AdminCommerceAdapter.approveReturn`) already existed from Phase 2/3's forward-looking work — this pass wired it all up for real against the live store.

- **Attachments** (ADR-033, new): a `attachments` table (BLOB, polymorphic owner) backs the "optional photo/attachment" requirement on both returns and support messages — no file infrastructure existed before this. Content type is sniffed from real magic bytes, never trusted from the client; a renamed-malicious-file attack is rejected (verified with a test). Served only as a data URL that re-runs the owning resource's own real authorization check first — never a public path.
- **Returns** (`/returns`, `/returns/:id`, `/account/returns`, `/staff/returns`, `/staff/return/:id`): always reached with real confirmed-order context (never cold-start); eligibility enforced against confirmed quantity minus anything already claimed by a non-rejected return; full staff decision flow (`requested → under_review → approved/rejected → refunded/replacement_sent`) with a resolution choice on approval and a manual outcome-confirmation step. The Shopify `approveReturn` sync is attempted for real and — confirmed empirically against the live store, not just reasoned about (ADR-034) — fails cleanly every time, since an app-originated return has no corresponding Shopify Return object to approve; the app's own state stays authoritative regardless, exactly like Phase 8's Draft Order reconciliation.
- **Support** (`/support`, `/support/:id`, `/staff/support`, `/staff/support/:id`): message-thread ticket system, category + optional *verified* order/return reference (a guest must supply that resource's own token; a buyer's ownership is checked the normal way), internal notes excluded from the customer view at the query layer (not just hidden in the UI — a real security boundary, tested directly), resolve/escalate, and a reply to a resolved ticket implicitly reopens it.
- **`/staff/team`** (NCC-admin-only): add/deactivate/reactivate staff accounts, case-normalized email/username, duplicate email/username/employee-ID all rejected, employee-ID format validated, sales-rep-vs-ncc_admin activation asymmetry preserved from ADR-007. **Role change** was added specifically because the runbook's own required test list names "role downgrade" as a scenario — the initial build only had creation, so this closes that gap for real rather than leaving it aspirational.
- **`/staff/accounts`** (read-only, same company-scoping as every other staff queue): buyer users, spend limits, assigned sales rep per company. Contract/tier pricing administration is correctly absent (ADR-005 already resolved this build to uniform pricing). Staff-initiated *creation* of a brand-new company is a recorded gap, not built — every company today comes from a buyer's own verified Shopify sign-in, and a staff-initiated cold-start company would need an identity-linking design this session had no grounds to invent (ADR-036).

**A real routing-bug regression check, not just a fix:** having found the flat-file-vs-directory nesting bug in Phase 9 (`routes/quote.tsx`), every new index/detail route pair this phase (`/returns` + `/returns/:id`, `/support` + `/support/:id`) was built directly as `index.tsx` + `$id.tsx` inside its own directory from the start, and the generated route tree was checked directly to confirm neither `ReturnsIdRoute` nor `SupportIdRoute` nested under its own index route before relying on either in the browser.

**Files created/changed:** see `TASKS.md` Phase 10+11 checklist. New modules: `server/attachments/{attachments,server-functions}.ts`, `server/returns/{return-view,submit-return-request,staff-return-queue,return-processing,server-functions,staff-return-server-functions}.ts`, `server/support/{support-view,submit-support-ticket,staff-support-queue,support-processing,server-functions,staff-support-server-functions}.ts`, `server/staff/{team-management,team-server-functions,company-directory,company-directory-server-functions}.ts`; new routes `returns/{index,$id}.tsx`, `support/{index,$id}.tsx`, `staff/{returns,team,accounts}.tsx`, `staff/return/$id.tsx`, `staff/support/{index,$id}.tsx`; new components `ReturnDetail.tsx`, `SupportTicketDetail.tsx`, `StaffNav.tsx`; new lib `lib/file-to-base64.ts`. Also touched: `db/schema.ts` (`attachments` table, migration `0003_sad_reavers.sql`), `validation/commands.ts` (return/support/staff-team schemas, upgraded `returnRequestSchema.reason` to a real enum), `routes/order/$id.tsx` and `routes/account/orders.tsx` (added "Request a return" entry points, per PRD's "never a cold-start form"). `DECISIONS.md` (ADR-033 through ADR-036, the role-downgrade-gap writeup).

**Verification performed (actual output, not inspection-only):**
```
$ pnpm typecheck  → tsc --noEmit, no output, exit 0
$ pnpm lint       → eslint ., no output, exit 0
$ pnpm test       → Test Files 59 passed (59), Tests 435 passed | 1 skipped (436)
$ pnpm build      → client + SSR bundles both built successfully
```
Client bundle re-swept post-build for every known secret literal — clean.

Manual, via the Browser tool against `pnpm dev` with the live Shopify catalogue and the seeded fixture accounts: submitted a support ticket as a guest, replied as the seeded NCC admin (status moved `open → awaiting_customer` correctly, real staff name shown), confirmed the guest's own token-gated view showed the reply and a working reply box (and not the internal-note toggle). Added a real product to basket, submitted and approved a fresh guest order to get a genuinely `confirmed` order, requested a return against it as that guest (`/returns` correctly showed the real order lines with quantities), staff started review → approved with a refund resolution → marked refunded — watched the whole status chain update correctly on both the staff and customer sides, and confirmed in the server logs that the real Shopify `returnApproveRequest` attempt failed exactly as ADR-034 predicted (invalid global id), with the app's own `approved`/`refunded` state completely unaffected. Confirmed `/staff/team` (add-account form, real seeded `fixture.ncc-admin`/`fixture.sales-rep` rows, working company-assignment picker) and `/staff/accounts` (real seeded companies/buyers/spend-limits) both render correctly.

**Assumptions and facts recorded:** see `DECISIONS.md` "Phase 10 + 11 decisions and facts" (ADR-033 through ADR-036) plus the role-downgrade writeup immediately after.

**Unresolved blockers / risks carried forward:**
- The connected Admin API token still needs the `write_draft_orders` scope for real Draft Order creation (Phase 8's original blocker, unaffected by this phase).
- **New:** the real Shopify `returnApproveRequest` mutation can never succeed for an app-originated return, confirmed empirically this session (ADR-034). Since the failure is proven rather than merely possible, `decideReturn` no longer attempts it at all — that guaranteed-failing call was removed as dead weight, not left in as "best-effort." The app's own status stays the system of record; the underlying question is now purely a business/architecture one, not a code gap: does NCC want a real Shopify-side Return object created at request time (via some `returnCreate`-equivalent, not yet researched), or is app-side reconciliation the permanent design here?
- No `/account/quotes` list page (Phase 9's carried-forward gap, unchanged) and no `/account/support` list page (same reasoning — PRD names only `/account/returns` explicitly for this phase).
- Staff-initiated company *account creation* is not built (ADR-036) — every company today originates from a buyer's own Shopify sign-in.
- Real live products still have incomplete data at the individual-SKU level (£0.00 pricing, missing images) — a live-store data gap, unchanged, not a code defect.
- A guest order/quote/return with no contact email can never get a real Shopify invoice/notification — unchanged business-decision gap from Phase 8.
- PRD §13 Questions 4, 5, 6 unchanged. `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` still unconfigured (Phase 7's blocker, unchanged).

**Database migrations / environment variables:** one new migration (`0003_sad_reavers.sql`, adds the `attachments` table). No new environment variables.

---

## Next phase: Phase 12 — SEO, AEO, accessibility, performance and security hardening

**Phase 12 entry criteria (Phase 11 exit gate, satisfied):** every customer-facing and staff-facing workflow through returns/support/team management works end-to-end against live data; internal notes are provably excluded from customer views at the query layer; every staff mutation is confirmed NCC-admin-gated with a real authorization test, not just a hidden button; `pnpm typecheck`/`lint`/`test`/`build` all pass. ✅

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
