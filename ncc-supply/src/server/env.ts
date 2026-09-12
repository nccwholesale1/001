import { z } from 'zod'

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
  SHOPIFY_STORE_DOMAIN: z.string().min(1).optional(),
  /** Storefront API access token (public or private) — only required when CATALOGUE_ADAPTER=live. */
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: z.string().min(1).optional(),
  /** Admin API access token — not needed until Phase 8's real draft-order/invoice/refund operations. */
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().min(1).optional(),
  SHOPIFY_API_VERSION: z.string().min(1).default('2026-07'),
  /** Customer Account API client id from the Headless channel — required when CUSTOMER_ACCOUNT_ADAPTER=live. */
  SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: z.string().min(1).optional(),

  /** Which CustomerAccountAdapter getCustomerAccountAdapter() returns — see integrations/shopify/index.ts. */
  CUSTOMER_ACCOUNT_ADAPTER: z.enum(['fixture', 'live']).default('fixture'),

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
  return result.data
}

export const env = loadEnv()
