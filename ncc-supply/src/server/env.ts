import { z } from 'zod'

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
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .default('dev-only-insecure-secret-do-not-use-in-production-xxxxx'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

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
   * once per browser (server/auth/site-access.ts). Unset entirely to turn
   * the gate off once the site is ready for its real launch — never gated
   * by NODE_ENV, since a staging/preview deploy still runs a production
   * build (CLAUDE.md: "production launch... never inferred from phase
   * completion").
   */
  SITE_ACCESS_PASSWORD: z.string().min(1).default('ncc-preview-2026'),
})

export type Env = z.infer<typeof envSchema>

const INSECURE_DEV_SECRET = 'dev-only-insecure-secret-do-not-use-in-production-xxxxx'

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`)
  }
  if (result.data.NODE_ENV === 'production' && result.data.SESSION_SECRET === INSECURE_DEV_SECRET) {
    throw new Error(
      'SESSION_SECRET must be set to a real value in production — refusing to start with the dev default.',
    )
  }
  if (
    result.data.CATALOGUE_ADAPTER === 'live' &&
    (!result.data.SHOPIFY_STORE_DOMAIN || !result.data.SHOPIFY_STOREFRONT_ACCESS_TOKEN)
  ) {
    throw new Error(
      'CATALOGUE_ADAPTER=live requires both SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_ACCESS_TOKEN to be set.',
    )
  }
  if (
    result.data.CUSTOMER_ACCOUNT_ADAPTER === 'live' &&
    (!result.data.SHOPIFY_STORE_DOMAIN || !result.data.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID)
  ) {
    throw new Error(
      'CUSTOMER_ACCOUNT_ADAPTER=live requires both SHOPIFY_STORE_DOMAIN and SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID to be set.',
    )
  }
  if (
    result.data.ADMIN_COMMERCE_ADAPTER === 'live' &&
    (!result.data.SHOPIFY_STORE_DOMAIN || !result.data.SHOPIFY_ADMIN_ACCESS_TOKEN)
  ) {
    throw new Error(
      'ADMIN_COMMERCE_ADAPTER=live requires both SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN to be set.',
    )
  }
  return result.data
}

export const env = loadEnv()
