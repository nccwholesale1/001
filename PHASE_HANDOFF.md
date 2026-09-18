# NCC Supply — Phase Handoff

This file is overwritten at the end of every phase with that phase's actual handoff. Use runbook §20's continuation prompt at the start of a fresh session — it reads this file (among others) to verify the last phase from evidence, not assumption.

---

## Most recent work: Phase 14 hosted-deploy prep slice (not full Phase 14, not a production launch)

**Scope (user's explicit request, 2026-09-17):** prepare a live production setup with **all real Shopify products**, as a separate headless deploy. Current NCC website / DNS untouched. Launch prompt (runbook §18) was **not** run — `SITE_ACCESS_PASSWORD` remains the pre-launch gate.

**What landed:**
1. Nitro Vite plugin (`nitro` + `nitro()` in `ncc-supply/vite.config.ts`) so TanStack Start can deploy to Vercel.
2. Hosted-deploy env guards (`parseEnv` in `src/server/env.ts`): when `VERCEL=1` or `NCC_HOSTED=1`, refuse fixture catalogue, fixture admin (fake invoice URLs), local SQLite, and a missing Turso auth token. Live catalogue requires Storefront credentials; live admin requires the Admin token.
3. `/dev/*` routes 404 when `NODE_ENV=production`. TanStack Devtools only render when `import.meta.env.DEV`.
4. CLI `pnpm db:bootstrap-admin` creates the first NCC admin on an empty staff table (never an HTTP endpoint; fixture `pnpm db:seed` still refuses `NODE_ENV=production`).
5. `.env.example` hosted/Vercel checklist (names only).

**Verification (actual output):**
```
$ pnpm typecheck  → tsc --noEmit, no output, exit 0
$ pnpm lint       → eslint ., no output, exit 0
$ pnpm test       → Test Files 62 passed (62), Tests 596 passed | 1 skipped (597)
$ pnpm build      → client + SSR bundles built; nitro.json preset node-server locally (VERCEL unset); "Generated .output/nitro.json"
```
Client `.output/public` re-swept for `dev-only-insecure-secret`, `SITE_ACCESS_PASSWORD`, `shpat_`, `ncc-preview-2026` — no matches.

**Not done (still user/business-owned, or remaining Phase 14):**
- Create Turso DB, run `pnpm db:migrate` against it, run `pnpm db:bootstrap-admin`.
- Create Vercel project, Root Directory `ncc-supply`, paste env vars, deploy.
- Admin token still needs `write_draft_orders` for a real Draft Order (unchanged Phase 8 blocker).
- `CUSTOMER_ACCOUNT_ADAPTER=live` still blocked on `SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID` + HTTPS callback.
- Full Phase 12 remainder (SEO/AEO, a11y, performance, dependency audit).
- Full Phase 14 UAT matrix and deployment/rollback runbooks.
- Production domain / DNS / replacing the current NCC site — launch prompt only.

**Next-phase prompt (when continuing Phase 14 after accounts exist):** runbook §17 (staging UAT), not §18, until the business explicitly authorizes launch.

---

## Last completed full phase: Phase 10 + 11 (merged) — Returns, support, staff accounts, team management

See git history / previous handoff body in this file's prior revision. Phase 12 security-only slice (ADR-037) remains the last completed quality pass; SEO/AEO/a11y/performance still deferred.
