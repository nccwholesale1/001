import { getRequestUrl, useSession } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { buyerUsers } from '../db/schema'
import { transitionBuyer } from '../domain/status'
import { env } from '../env'
import { getCustomerAccountAdapter } from '../integrations/shopify'
import { clearBuyerSession, establishBuyerSession } from './buyer-session'

const CALLBACK_PATH = '/auth-callback'

interface OidcPendingSessionData {
  state?: string
  codeVerifier?: string
  redirectUri?: string
  pendingEmail?: string
  pendingShopifyCustomerId?: string
}

/**
 * Holds OIDC round-trip state server-side only — the client never sees or
 * can influence `state`/`codeVerifier` (CLAUDE.md rule 21: mutations/flows
 * are protected against replay and tampering). Reused after a successful
 * verify-with-no-match to briefly hold the identity `/register` completes
 * company creation for, so that step never has to redo the OIDC round trip.
 */
function getOidcPendingSession() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see ../buyers/buyer-session.ts's identical note on useSession.
  return useSession<OidcPendingSessionData>({
    password: env.SESSION_SECRET,
    name: 'ncc_oidc_pending',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    },
  })
}

export async function beginBuyerLogin(): Promise<{ url: string }> {
  const redirectUri = new URL(CALLBACK_PATH, getRequestUrl()).toString()
  const { url, state, codeVerifier } = await getCustomerAccountAdapter().login(redirectUri)

  const session = await getOidcPendingSession()
  await session.update({ state, codeVerifier, redirectUri, pendingEmail: undefined, pendingShopifyCustomerId: undefined })

  return { url }
}

export type CompleteBuyerLoginResult =
  | { outcome: 'signed_in' }
  | { outcome: 'pending_registration' }
  | { outcome: 'removed' }
  | { outcome: 'invalid_state' }

/**
 * Matches a verified Shopify identity to `buyerUsers` by email. An
 * `invited` row activates on this first successful sign-in — the same
 * pattern as ADR-007's staff first-login activation — since the admin who
 * created the row already established the invite; sign-in itself is
 * acceptance. No match at all means this is a brand-new company; the
 * identity is stashed for `/register` to finish, never re-verified.
 */
export async function completeBuyerLogin(
  db: Db,
  input: { code: string; state: string },
): Promise<CompleteBuyerLoginResult> {
  const pending = await getOidcPendingSession()
  const { state, codeVerifier, redirectUri } = pending.data
  if (!state || state !== input.state || !codeVerifier || !redirectUri) {
    return { outcome: 'invalid_state' }
  }

  const adapter = getCustomerAccountAdapter()
  const session = await adapter.authorize(input.code, codeVerifier, redirectUri)
  const identity = await adapter.verifyIdentity(session.idToken)

  const [buyer] = await db
    .select()
    .from(buyerUsers)
    .where(eq(buyerUsers.email, identity.email))
    .limit(1)

  if (!buyer) {
    await pending.update({
      state: undefined,
      codeVerifier: undefined,
      redirectUri: undefined,
      pendingEmail: identity.email,
      pendingShopifyCustomerId: identity.shopifyCustomerId,
    })
    return { outcome: 'pending_registration' }
  }

  if (buyer.status === 'removed') {
    await pending.clear()
    return { outcome: 'removed' }
  }

  if (buyer.status === 'invited') {
    transitionBuyer('invited', { type: 'activate' })
    await db
      .update(buyerUsers)
      .set({ status: 'active', shopifyCustomerId: identity.shopifyCustomerId })
      .where(eq(buyerUsers.id, buyer.id))
    await recordAuditEvent(db, {
      actorType: 'buyer',
      actorId: buyer.id,
      action: 'activate_buyer',
      resourceType: 'buyer_user',
      resourceId: buyer.id,
    })
  } else if (buyer.shopifyCustomerId !== identity.shopifyCustomerId) {
    await db
      .update(buyerUsers)
      .set({ shopifyCustomerId: identity.shopifyCustomerId })
      .where(eq(buyerUsers.id, buyer.id))
  }

  await pending.clear()
  await establishBuyerSession(buyer.id)
  return { outcome: 'signed_in' }
}

export async function getPendingRegistrationIdentity(): Promise<{
  email: string
  shopifyCustomerId: string
} | null> {
  const session = await getOidcPendingSession()
  const { pendingEmail, pendingShopifyCustomerId } = session.data
  if (!pendingEmail || !pendingShopifyCustomerId) return null
  return { email: pendingEmail, shopifyCustomerId: pendingShopifyCustomerId }
}

export async function clearPendingRegistrationIdentity(): Promise<void> {
  const session = await getOidcPendingSession()
  await session.clear()
}

export async function logoutBuyer(): Promise<void> {
  await clearBuyerSession()
}
