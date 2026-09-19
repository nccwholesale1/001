import { env } from '../../env'

/**
 * Server-only, privileged. Mints Admin API access tokens with the client
 * credentials grant and caches them in memory.
 *
 * Shopify no longer lets anyone create admin-created custom apps, which were
 * the only source of a permanent token you could paste into an environment
 * variable. A Dev Dashboard app acting on a store in its own organization
 * exchanges its client id and secret for a token instead, and that token is
 * always valid for exactly 24 hours (`expires_in` is 86399) — there is no
 * non-expiring option on this grant. So the token cannot live in config; it
 * has to be fetched and refreshed by the app itself.
 *
 * The client secret must never reach browser code (CLAUDE.md rule 8), which
 * is why this module is only ever imported by `admin-client.ts`.
 */

const TOKEN_ENDPOINT_PATH = '/admin/oauth/access_token'

/**
 * Refresh this long before the token actually expires. A request that starts
 * just under the wire must still be valid when Shopify processes it, and a
 * serverless instance's clock can drift from Shopify's.
 */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000

interface CachedToken {
  token: string
  /** Epoch ms after which this token must not be used. */
  expiresAt: number
}

let cached: CachedToken | null = null
/**
 * Concurrent callers share one in-flight request rather than each minting a
 * token. Shopify hands out a fresh token per call, so a burst of parallel
 * requests would otherwise waste calls and leave every one but the last
 * immediately superseded in our own cache.
 */
let inFlight: Promise<CachedToken> | null = null

export class AdminTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminTokenError'
  }
}

/** True when the client credentials grant is configured and should be used. */
export function hasClientCredentials(): boolean {
  return Boolean(env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET)
}

/**
 * Drops the cached token so the next call mints a fresh one. Called when
 * Shopify rejects a request as unauthenticated — a token can stop working
 * before its stated expiry (the app's secret was rotated, the app was
 * reinstalled), and a cached-but-dead token would otherwise fail every
 * request until it aged out on its own.
 */
export function invalidateAdminToken(): void {
  cached = null
}

/** Test-only: clears both the cache and any in-flight request. */
export function resetAdminTokenCacheForTests(): void {
  cached = null
  inFlight = null
}

/**
 * Returns a usable Admin API access token, minting one only when there isn't
 * a live cached token. Prefers a statically configured token when one is
 * present, so a legacy admin-created custom app keeps working unchanged.
 */
export async function getAdminAccessToken(): Promise<string> {
  if (env.SHOPIFY_ADMIN_ACCESS_TOKEN) return env.SHOPIFY_ADMIN_ACCESS_TOKEN

  if (!hasClientCredentials()) {
    throw new AdminTokenError(
      'No Admin API credentials configured — set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (or a legacy SHOPIFY_ADMIN_ACCESS_TOKEN)',
    )
  }

  if (cached && Date.now() < cached.expiresAt) return cached.token

  inFlight ??= requestToken().finally(() => {
    inFlight = null
  })

  const fresh = await inFlight
  return fresh.token
}

async function requestToken(): Promise<CachedToken> {
  const domain = env.SHOPIFY_STORE_DOMAIN
  if (!domain) throw new AdminTokenError('SHOPIFY_STORE_DOMAIN is not configured')
  if (!domain.endsWith('.myshopify.com')) {
    throw new AdminTokenError('SHOPIFY_STORE_DOMAIN must be the store *.myshopify.com hostname')
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.SHOPIFY_CLIENT_ID!,
    client_secret: env.SHOPIFY_CLIENT_SECRET!,
  })

  const response = await fetch(`https://${domain}${TOKEN_ENDPOINT_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    // Shopify's error body names the cause (`invalid_client`,
    // `shop_not_permitted`) and contains no secret, so it is safe and useful
    // to surface. The request body, which does hold the secret, is not.
    const detail = await response.text().catch(() => '')
    throw new AdminTokenError(
      `Shopify refused the client credentials grant (HTTP ${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    )
  }

  const payload = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!payload.access_token) {
    throw new AdminTokenError('Shopify returned no access_token for the client credentials grant')
  }

  // Treat a missing or nonsensical expires_in as "expires immediately" rather
  // than assuming 24 hours — caching a token we can't vouch for is worse than
  // minting one per request.
  const lifetimeMs = Number.isFinite(payload.expires_in) ? (payload.expires_in as number) * 1000 : 0
  const expiresAt = Date.now() + Math.max(0, lifetimeMs - EXPIRY_MARGIN_MS)

  cached = { token: payload.access_token, expiresAt }
  return cached
}
