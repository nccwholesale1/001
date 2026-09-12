import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import type {
  CustomerAccountAdapter,
  CustomerAccountSession,
  ShopifyReturn,
  VerifiedCustomerIdentity,
} from './types'

/**
 * Simulates the Customer Account API's OIDC contract with zero Shopify
 * credentials, so Phase 7's buyer sign-in → callback → session flow is
 * exercisable end-to-end in the Browser tool (CLAUDE.md rule 25 — test the
 * contract, don't skip verification just because live credentials are
 * unavailable). `login()` points at the dev-only `/dev/fixture-shopify-login`
 * page instead of a real Shopify authorization endpoint; that page mints a
 * self-signed JWT via `mintFixtureIdToken` and redirects back exactly like a
 * real hosted login would. `authorize()` treats the authorization "code" as
 * being that JWT directly (there is no real token endpoint to exchange it
 * against) — `verifyIdentity()` still verifies its signature, so the same
 * verify-then-decode code path the live adapter uses is genuinely exercised.
 * Never selected in production (env.ts requires CUSTOMER_ACCOUNT_ADAPTER=live
 * there once SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID is configured).
 */

const FIXTURE_ISSUER = 'fixture-shopify'
const FIXTURE_AUDIENCE = 'fixture-client'

/**
 * A `CryptoKey` rather than a raw `Uint8Array` — jose's WebCrypto runtime
 * (picked up under jsdom, e.g. in tests) does an `instanceof Uint8Array`
 * check against its own realm's constructor, which a Uint8Array from a
 * different realm (Node's `node:crypto`) fails even though it's
 * structurally identical. Importing it once up front sidesteps that
 * entirely — a `CryptoKey` has no such realm ambiguity.
 */
let fixtureKeyPromise: Promise<CryptoKey> | undefined
function getFixtureKey(): Promise<CryptoKey> {
  fixtureKeyPromise ??= crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('ncc-supply-dev-fixture-oidc-secret-not-for-prod'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  return fixtureKeyPromise
}

function randomUrlSafeToken(): string {
  return randomBytes(32).toString('base64url')
}

function fixtureCustomerId(email: string): string {
  return `gid://shopify/Customer/fixture-${Buffer.from(email).toString('hex').slice(0, 24)}`
}

/** Used only by the dev-only fixture login route — never part of the CustomerAccountAdapter contract. */
export async function mintFixtureIdToken(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase()
  const key = await getFixtureKey()
  return new SignJWT({ email: normalizedEmail, sub: fixtureCustomerId(normalizedEmail) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(FIXTURE_ISSUER)
    .setAudience(FIXTURE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key)
}

export function createFixtureCustomerAccountAdapter(): CustomerAccountAdapter {
  return { login, authorize, verifyIdentity, getReturnEligibility, requestReturn }
}

async function login(redirectUri: string) {
  const state = randomUrlSafeToken()
  const nonce = randomUrlSafeToken()
  const codeVerifier = randomUrlSafeToken()

  const url = new URL('/dev/fixture-shopify-login', 'http://fixture.local')
  url.searchParams.set('state', state)
  url.searchParams.set('redirect_uri', redirectUri)

  return { url: url.pathname + url.search, state, codeVerifier, nonce }
}

// codeVerifier/redirectUri intentionally unused: the fixture has no real token endpoint to present them to.
async function authorize(code: string): Promise<CustomerAccountSession> {
  return {
    accessToken: 'fixture-access-token',
    idToken: code,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }
}

async function verifyIdentity(idToken: string): Promise<VerifiedCustomerIdentity> {
  const key = await getFixtureKey()
  const { payload } = await jwtVerify(idToken, key, {
    issuer: FIXTURE_ISSUER,
    audience: FIXTURE_AUDIENCE,
  })
  const email = typeof payload.email === 'string' ? payload.email : null
  const shopifyCustomerId = typeof payload.sub === 'string' ? payload.sub : null
  if (!email || !shopifyCustomerId) {
    throw new Error('Fixture id_token is missing required email/sub claims')
  }
  return { email, shopifyCustomerId }
}

async function getReturnEligibility(_orderId: string, _accessToken: string): Promise<{ eligible: boolean }> {
  throw new Error('getReturnEligibility is not implemented until Phase 10 builds the real returns workflow')
}

async function requestReturn(
  _accessToken: string,
  _input: { orderId: string; lineIds: string[] },
): Promise<ShopifyReturn> {
  throw new Error('requestReturn is not implemented until Phase 10 builds the real returns workflow')
}
