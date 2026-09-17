import { z } from 'zod'
import { debugSessionLog } from './debug-session-log'

/**
 * A `.env` line like `KEY=` sets `process.env.KEY` to `''`, not undefined —
 * so a plain `.string().min(1).optional()` fails validation on a variable
 * the file only *mentions* (as `.env.example` does, for every var) rather
 * than actually sets. Treat empty-string the same as absent for every
 * optional credential below.
 */
const optionalString = () => z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional())

/**
 * Server-only. Validated once at import time so a missing/invalid variable
 * fails loudly at startup rather than surfacing as a confusing runtime error
 * deep in a request handler. Never import this from client code.
 */
const envSchema = z.object({
  DATABASE_FILE: z.string().min(1).default('./local.db'),
  /** A libsql:// URL for a remote/hosted database (e.g. Turso). When set, this takes priority over DATABASE_FILE — a local file doesn't survive most serverless hosting. */
  DATABASE_URL: optionalString(),
  /** Required alongside DATABASE_URL for a remote database that needs auth (e.g. Turso's auth token). Ignored when DATABASE_URL is unset. */
  DATABASE_AUTH_TOKEN: optionalString(),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .default('dev-only-insecure-secret-do-not-use-in-production-xxxxx'),
  /**
   * Vercel’s dashboard “Preview” environment is not a Node NODE_ENV. If that
   * string is pasted into NODE_ENV, Zod rejects boot and every request 500s
   * as HTTPError. Map Vercel env names onto Node’s enum.
   */
  NODE_ENV: z.preprocess((value) => {
    if (value === '' || value === undefined || value === null) return undefined
    if (typeof value !== 'string') return value
    const normalized = value.trim().toLowerCase()
    if (normalized === 'preview' || normalized === 'prod') return 'production'
    return normalized
  }, z.enum(['development', 'test', 'production']).default('development')),

  /** Which CatalogueAdapter getCatalogueAdapter() returns — see integrations/shopify/index.ts. */
  CATALOGUE_ADAPTER: z.enum(['fixture', 'live']).default('fixture'),
  /** The store's *.myshopify.com domain — NOT its custom storefront domain. Only required when CATALOGUE_ADAPTER=live. */
  SHOPIFY_STORE_DOMAIN: optionalString(),
  /** Storefront API access token (public or private) — only required when CATALOGUE_ADAPTER=live. */
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: optionalString(),
  /** Admin API access token — only required when ADMIN_COMMERCE_ADAPTER=live. */
  SHOPIFY_ADMIN_ACCESS_TOKEN: optionalString(),
  SHOPIFY_API_VERSION: z.string().min(1).default('2026-07'),
  /** Customer Account API client id from the Headless channel — required when CUSTOMER_ACCOUNT_ADAPTER=live. */
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: optionalString(),

  /** Which CustomerAccountAdapter getCustomerAccountAdapter() returns — see integrations/shopify/index.ts. */
  CUSTOMER_ACCOUNT_ADAPTER: z.enum(['fixture', 'live']).default('fixture'),

  /** Which AdminCommerceAdapter getAdminCommerceAdapter() returns — see integrations/shopify/index.ts. */
  ADMIN_COMMERCE_ADAPTER: z.enum(['fixture', 'live']).default('fixture'),

  /**
   * Pre-launch site-wide gate (temporary, operational — not a PRD feature).
   * When set, every route except /preview-access requires this password
   * once per browser (server/auth/site-access.ts). Truly optional — no
   * default — so unsetting it for real turns the gate off entirely, rather
   * than silently falling back to a known password. Never gated by
   * NODE_ENV, since a staging/preview deploy still runs a production build
   * (CLAUDE.md: "production launch... never inferred from phase
   * completion").
   */
  SITE_ACCESS_PASSWORD: optionalString(),
})

export type Env = z.infer<typeof envSchema>

const INSECURE_DEV_SECRET = 'dev-only-insecure-secret-do-not-use-in-production-xxxxx'

/**
 * Vercel sets `VERCEL=1` at build and runtime. Other hosts can opt into the
 * same guards with `NCC_HOSTED=1`. Local `pnpm build` is NODE_ENV=production
 * without those flags, so it can still complete without Turso/Shopify secrets.
 */
function isHostedDeploy(source: Record<string, string | undefined>): boolean {
  return source.VERCEL === '1' || source.NCC_HOSTED === '1'
}

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`)
  }
  const data = { ...result.data }
  if (data.NODE_ENV === 'production' && data.SESSION_SECRET === INSECURE_DEV_SECRET) {
    throw new Error(
      'SESSION_SECRET must be set to a real value in production — refusing to start with the dev default.',
    )
  }
  if (isHostedDeploy(source)) {
    if (data.DATABASE_URL?.startsWith('file:')) {
      data.DATABASE_URL = undefined
      data.DATABASE_AUTH_TOKEN = undefined
    }
    // Missing Turso credentials must not crash the serverless process —
    // Vercel wraps that as {"message":"HTTPError"} on every HTML route.
    // Queries fail softly; the storefront HTML can still render.
    if (
      data.CATALOGUE_ADAPTER === 'fixture' &&
      data.SHOPIFY_STORE_DOMAIN &&
      data.SHOPIFY_STOREFRONT_ACCESS_TOKEN
    ) {
      data.CATALOGUE_ADAPTER = 'live'
    }
    if (
      data.ADMIN_COMMERCE_ADAPTER === 'fixture' &&
      data.SHOPIFY_STORE_DOMAIN &&
      data.SHOPIFY_ADMIN_ACCESS_TOKEN
    ) {
      data.ADMIN_COMMERCE_ADAPTER = 'live'
    }
  }
  // Never crash the whole process because an adapter is "live" without
  // credentials — Vercel surfaces that as {"message":"HTTPError"} on every
  // route. Fall back to the fixture adapter instead.
  if (
    data.CATALOGUE_ADAPTER === 'live' &&
    (!data.SHOPIFY_STORE_DOMAIN || !data.SHOPIFY_STOREFRONT_ACCESS_TOKEN)
  ) {
    data.CATALOGUE_ADAPTER = 'fixture'
  }
  if (
    data.CUSTOMER_ACCOUNT_ADAPTER === 'live' &&
    (!data.SHOPIFY_STORE_DOMAIN || !data.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID)
  ) {
    data.CUSTOMER_ACCOUNT_ADAPTER = 'fixture'
  }
  if (
    data.ADMIN_COMMERCE_ADAPTER === 'live' &&
    (!data.SHOPIFY_STORE_DOMAIN || !data.SHOPIFY_ADMIN_ACCESS_TOKEN)
  ) {
    data.ADMIN_COMMERCE_ADAPTER = 'fixture'
  }
  return data
}

function parseEnvWithDebug(): Env {
  try {
    const parsed = parseEnv()
    // #region agent log
    debugSessionLog({
      location: 'src/server/env.ts:parseEnvWithDebug',
      message: 'parseEnv succeeded',
      hypothesisId: 'A',
      data: {
        nodeEnv: parsed.NODE_ENV,
        hosted: process.env.VERCEL === '1' || process.env.NCC_HOSTED === '1',
        hasDatabaseUrl: Boolean(parsed.DATABASE_URL),
        hasAuthToken: Boolean(parsed.DATABASE_AUTH_TOKEN),
        sessionSecretLength: parsed.SESSION_SECRET.length,
        catalogueAdapter: parsed.CATALOGUE_ADAPTER,
        customerAccountAdapter: parsed.CUSTOMER_ACCOUNT_ADAPTER,
        adminAdapter: parsed.ADMIN_COMMERCE_ADAPTER,
        rawNodeEnv: process.env.NODE_ENV,
      },
    })
    // #endregion
    return parsed
  } catch (error) {
    // #region agent log
    debugSessionLog({
      location: 'src/server/env.ts:parseEnvWithDebug',
      message: 'parseEnv threw',
      hypothesisId: 'A',
      data: {
        name: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        hosted: process.env.VERCEL === '1',
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasSessionSecret: Boolean(process.env.SESSION_SECRET),
      },
    })
    // #endregion
    return parseEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: 'ncc-hosted-degraded-session-secret-replace',
    })
  }
}

export const env = parseEnvWithDebug()
