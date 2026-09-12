import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { env } from '../../env'
import type {
  CustomerAccountAdapter,
  CustomerAccountSession,
  ShopifyReturn,
  VerifiedCustomerIdentity,
} from './types'

/**
 * Real OIDC discovery + PKCE construction, verified against
 * https://shopify.dev/docs/api/customer/2026-07 this session — not
 * live-testable yet: Shopify never accepts a localhost redirect_uri, and
 * there is no HTTPS login route until Phase 7. Contract-tested via mocked
 * fetch. The app never builds its own buyer password system (ADR-003) —
 * this is the only identity path for a company buyer.
 */

interface OidcDiscoveryDocument {
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  issuer: string
}

interface TokenResponse {
  access_token: string
  id_token: string
  expires_in: number
  refresh_token?: string
}

async function discoverEndpoints(): Promise<OidcDiscoveryDocument> {
  if (!env.SHOPIFY_STORE_DOMAIN) {
    throw new Error('discoverEndpoints called without SHOPIFY_STORE_DOMAIN configured')
  }
  const response = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/.well-known/openid-configuration`,
  )
  if (!response.ok) {
    throw new Error(`OIDC discovery failed with HTTP ${response.status}`)
  }
  return (await response.json()) as OidcDiscoveryDocument
}

function randomUrlSafeToken(): string {
  return randomBytes(32).toString('base64url')
}

/** RFC 7636 S256: base64url(SHA-256(code_verifier)), already unpadded/URL-safe via Node's base64url encoding. */
function toCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier).digest('base64url')
}

export function createCustomerAccountAdapter(): CustomerAccountAdapter {
  return { login, authorize, verifyIdentity, getReturnEligibility, requestReturn }
}

async function login(redirectUri: string) {
  if (!env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID) {
    throw new Error('login called without SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID configured')
  }
  const { authorization_endpoint } = await discoverEndpoints()

  const state = randomUrlSafeToken()
  const nonce = randomUrlSafeToken()
  const codeVerifier = randomUrlSafeToken()

  const url = new URL(authorization_endpoint)
  url.searchParams.set('scope', 'openid email customer-account-api:full')
  url.searchParams.set('client_id', env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('nonce', nonce)
  url.searchParams.set('code_challenge', toCodeChallenge(codeVerifier))
  url.searchParams.set('code_challenge_method', 'S256')

  return { url: url.toString(), state, codeVerifier, nonce }
}

async function authorize(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<CustomerAccountSession> {
  if (!env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID) {
    throw new Error('authorize called without SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID configured')
  }
  const { token_endpoint } = await discoverEndpoints()

  const response = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  })
  if (!response.ok) {
    throw new Error(`Customer Account token exchange failed with HTTP ${response.status}`)
  }
  const token = (await response.json()) as TokenResponse

  return {
    accessToken: token.access_token,
    idToken: token.id_token,
    expiresAt: new Date(Date.now() + token.expires_in * 1000),
    refreshToken: token.refresh_token,
  }
}

/**
 * Verifies the id_token's signature against Shopify's own JWKS (never trust
 * an unverified claim about who signed in — CLAUDE.md rule 9) and checks
 * `aud`/`iss` before reading the `email`/`sub` claims that the Phase 7
 * callback route matches against `buyerUsers`.
 */
async function verifyIdentity(idToken: string): Promise<VerifiedCustomerIdentity> {
  if (!env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID) {
    throw new Error('verifyIdentity called without SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID configured')
  }
  const { jwks_uri, issuer } = await discoverEndpoints()
  const jwks = createRemoteJWKSet(new URL(jwks_uri))
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: env.SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
  })

  const email = typeof payload.email === 'string' ? payload.email : null
  const shopifyCustomerId = typeof payload.sub === 'string' ? payload.sub : null
  if (!email || !shopifyCustomerId) {
    throw new Error('id_token is missing required email/sub claims')
  }
  return { email: email.toLowerCase(), shopifyCustomerId }
}

// Params intentionally unused: signature fixed by CustomerAccountAdapter, needs a real session to mean anything (Phase 10).
async function getReturnEligibility(
  _orderId: string,
  _accessToken: string,
): Promise<{ eligible: boolean }> {
  throw new Error(
    'getReturnEligibility is not implemented until Phase 10 builds the real returns workflow',
  )
}

async function requestReturn(
  _accessToken: string,
  _input: { orderId: string; lineIds: string[] },
): Promise<ShopifyReturn> {
  throw new Error(
    'requestReturn is not implemented until Phase 10 builds the real returns workflow',
  )
}
