# NCC Supply — Quality Audit

## Scope of this pass

Phase 12 in the runbook (`docs/NCC-Supply-Claude-Code-Phased-Prompt-Plan.md` §15) covers SEO/AEO, accessibility, performance, *and* security. At the user's explicit request (2026-09-13, ahead of standing up a staging deployment), this pass covers **only the security-relevant half** — authorization, tenant isolation, injection/XSS, uploads, secrets, and rate limiting — so a reachable staging URL isn't exposed before that review happens. **SEO/AEO, accessibility, performance budgets, and a dependency/config audit are still outstanding** and belong to a follow-up full Phase 12 pass; nothing below should be read as covering them.

Everything in this document is either (a) a review of existing, already-tested code with the evidence cited, or (b) a real, fixed gap with before/after description. No item here is aspirational.

## 1. Authorization matrix

`docs/route-permissions-matrix.md` is the source of truth for who can reach what. It's enforced through two shared primitives (`server/auth/authorization.ts`): `canViewCompanyResource` (read) and `canMutateCompanyResource` (write) — both deny-by-default, both switch exhaustively over the `Actor` discriminated union so a new role can't silently fall through. A sales rep is read-only everywhere regardless of company assignment; this is enforced in the authorization function itself, not left to route/UI convention.

Every staff queue (orders, quotes, returns, support, team, company directory) has a real cross-tenant test asserting a sales rep sees only their assigned company and never a guest-originated resource, verified by grep against the actual test files:

```
orders/staff-queue.test.ts, quotes/staff-quote-queue.test.ts,
returns/staff-return-queue.test.ts, support/staff-support-queue.test.ts
```

Every staff-only mutation (approve/reject/price/reply/add-account/deactivate/assign) is called through `requireStaffActor`/`isNccAdmin` gates with a corresponding `ForbiddenError` test for a sales rep and/or buyer attempting it directly (bypassing the UI).

## 2. Tenant isolation / IDOR

Every "view by id" function (`buildOrderRequestView`, `buildQuoteView`, `buildReturnView`, `buildSupportTicketView`) is a pure DB fetch — the caller is responsible for authorization, checked once at the route/server-function boundary via `canViewCompanyResource` or a guest-token check. This was audited by re-reading every `*ViewForActor` call site; none skip the check.

Guest access is entirely token-mediated (`server/tokens/token-service.ts`): a 256-bit `crypto.randomBytes` token, SHA-256-hashed before storage (the raw token is returned exactly once, never persisted), checked for exact resource-type match, revocation, and expiry — all failure modes collapse to the same `null` result so a probing request can't distinguish "wrong token" from "right token, wrong resource" (no enumeration).

## 3. Sessions and CSRF

All three session cookie types (staff, buyer, site-access-gate) use `httpOnly: true`, `sameSite: 'lax'`, `secure` in production. No state-changing action is exposed via a GET-method server function — confirmed by listing every `createServerFn({ method: 'GET' })` in the codebase (27 of them): all are reads. The one GET-method action that looks like a mutation (`completeLogin`) is the OAuth2/OIDC authorization-code callback from Shopify's Customer Account API, which is inherently a GET redirect per the OAuth2 spec; it's protected by a server-side-only `state` value (never influenced by the client) plus PKCE (`codeVerifier`), both checked in `completeBuyerLogin` before any session is established.

## 4. Injection

No raw/interpolated SQL exists anywhere in the codebase — every query goes through Drizzle's parameterized query builder. The only `sql\`...\`` usage is for two `current_timestamp` column defaults in the schema (no user input involved). Confirmed by grepping for `sql\`.*\${` (interpolated raw SQL) across `server/` — zero matches.

## 5. XSS

Zero uses of `dangerouslySetInnerHTML` anywhere in the codebase — every render goes through React's default escaping.

## 6. File uploads

`server/attachments/attachments.ts` sniffs real magic bytes (JPEG/PNG/WebP/GIF/PDF signatures) rather than trusting a client-supplied MIME type or filename extension — a renamed-malicious-file attack is rejected and covered by a test. Size is capped both at the schema layer (`attachmentInputSchema`'s base64 length cap, defense-in-depth) and for real after decoding (`storeAttachment`). Attachments are never served from a public static path — `getAttachmentDataUrl` re-runs the owning resource's own real authorization check (guest token or actor) before releasing any bytes.

## 7. Input validation boundary — real gap found and fixed

**Finding:** `createServerFn`'s `.validator()` is the real HTTP/RPC boundary — each one is its own callable endpoint, reachable directly regardless of what the client-side route loader happens to pass it. Every server function defined in `server/**/server-functions.ts` correctly validates with a real Zod schema (`.validator(someSchema.parse)`). But **12 inline server functions defined directly inside route files** used a bare TypeScript type-annotated identity function instead — `.validator((input: {...}) => input)` — which performs **no runtime validation at all**; the type only constrains the app's own client code, not a direct call to the endpoint.

The highest-severity instance: `routes/support/$id.tsx`'s `replyToTicketAction` (a real mutation — posting a customer reply to a support ticket) had no length cap on `message` and no size cap on `attachment.base64`, bypassing the 5,000-character/7,000,000-character caps (`supportTicketMessageSchema`, `attachmentInputSchema`) that the equivalent staff-side reply action already enforced. That schema existed in `validation/commands.ts` but was never wired up to this action — dead code that should have been the fix.

**Fixed** — all 12 sites now validate with a real Zod schema at the `.validator()` boundary:

| File | Function(s) |
|---|---|
| `routes/support/$id.tsx` | `getSupportTicketDetailView`, `replyToTicketAction` (now uses `supportTicketMessageSchema`, extended with `token`) |
| `routes/returns/$id.tsx` | `getReturnDetailView` |
| `routes/returns/index.tsx` | `getOrderForReturn` |
| `routes/quote/$id.tsx` | `getQuoteDetailView`, `acceptQuoteAction` |
| `routes/checkout/$id.tsx` | `getCheckoutView` |
| `routes/order/$id.tsx` | `getOrderRequestView` |
| `routes/category/$slug.tsx` | `getCategoryData` |
| `routes/search.tsx` | `getSearchData`, `getSearchSuggestions` |
| `routes/product/$sku.tsx` | `getProductData` |

Verified: `pnpm typecheck`/`lint`/`test` all pass after the change (441 tests, 6 new — a `commands.test.ts` suite for `supportTicketMessageSchema` proving the empty/oversized/unknown-field cases are now rejected).

## 8. Rate limiting — real gap found and fixed

**Finding:** no rate limiting existed anywhere in the app for its own endpoints (the only pre-existing "rate limit" code handles *Shopify's* 429 responses, not ours). The runbook's Phase 12 security list names this explicitly for public submissions.

**Fixed** — a new in-memory fixed-window limiter (`server/shared/rate-limit.ts`, with its own test suite) wired into:

- `staffLogin` — two independent caps: 20/15min per source IP, 8/15min per identifier regardless of IP (so a distributed attacker spraying one account from many IPs is still caught).
- `submitSiteAccess` (the pre-launch password gate) — 10/15min per IP.
- `submitCurrentBasket` (guest/buyer order submission), `submitQuote`, `submitReturn`, `submitSupportTicketFn`, and the support-ticket reply action — 20/hour per IP each.

**Recorded limitation (CLAUDE.md rule 25):** this is in-process memory, not a shared store — it resets on restart and does not coordinate across multiple instances. Fine for blunting casual scripted abuse of a single instance; a genuine multi-instance production deployment would need a shared store (e.g. Redis) instead. Not fixed in this pass because no such shared infrastructure exists yet, and provisioning one is a hosting decision, not a code gap.

## 9. Passwords

`server/auth/password.ts`: scrypt via `node:crypto` (no native-binding dependency), per-user random salt, `timingSafeEqual` for comparison, self-describing stored format. Reviewed, no change needed.

## 10. Secret exposure

Re-ran the established client-bundle sweep after every change in this pass:

```
grep -rlE "SHOPIFY_ADMIN|ADMIN_API|shpat_|shpca_|shpss_|SECRET|PRIVATE_KEY" dist/client
```

Zero matches, both before and after this pass's changes.

## 11. Shopify return-sync follow-up (carried from Phase 10/11, addressed alongside this pass)

ADR-034 proved the Shopify `returnApproveRequest` mutation can never succeed for an app-originated return. Since the failure is proven rather than merely possible, the code no longer attempts it at all — `decideReturn` was changed to stop calling a guaranteed-failing network call on every approval. See `DECISIONS.md` ADR-034 and `PHASE_HANDOFF.md` for the full writeup; this is a business/architecture question now, not a code gap.

## Verification

```
$ pnpm typecheck  → tsc --noEmit, no output, exit 0
$ pnpm lint       → eslint ., no output, exit 0
$ pnpm test       → 60 files, 441 passed | 1 skipped (442)
$ pnpm build      → client + SSR bundles built successfully
```
Client bundle re-swept for every known secret literal — clean.

## Explicitly out of scope for this pass (deferred to a full Phase 12)

- SEO/AEO: titles/descriptions, canonical URLs, Open Graph/Twitter metadata, structured data, robots/sitemap rules, Q&A content.
- Accessibility: automated WCAG checks, keyboard-only review, focus order/trapping, contrast, responsive breakpoints, reduced-motion.
- Performance: bundle analysis, image loading/layout-shift, cache review, pagination/search load checks, measured budgets.
- Dependency/configuration audit (e.g. `pnpm audit`, outdated packages).
- Observability/redacted logging review beyond what already exists.

## Hosting recommendation (for Phase 14 deployment prep)

Vercel (app) + Turso (database). TanStack Start's SSR/Vite output has first-party Vercel support with a generous free tier; Cloudflare Workers would need an edge-runtime adapter and doesn't fully support the Node APIs already used for migrations/seeding (`node --experimental-strip-types`). The app already depends on `@libsql/client`; a local SQLite file won't survive serverless hosting, and Turso is the same client, hosted, with a free tier. Account creation itself is the user's own action (not something this session can do), to be walked through when Phase 14 begins.
