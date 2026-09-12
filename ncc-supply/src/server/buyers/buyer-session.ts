import { useSession } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import type { Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers } from '../db/schema'
import { env } from '../env'

interface BuyerSessionData {
  buyerUserId?: string
}

/**
 * A separate cookie from the guest basket session (`../basket/session.ts`'s
 * `ncc_basket`) — a buyer signing in doesn't invalidate an in-progress guest
 * basket pointer, and the two identities are never conflated.
 */
export function getBuyerSession() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- TanStack Start's `useSession` is a server-side request-context utility (AsyncLocalStorage-backed), not a React hook.
  return useSession<BuyerSessionData>({
    password: env.SESSION_SECRET,
    name: 'ncc_buyer',
    cookie: { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production', path: '/' },
  })
}

/**
 * Resolves the signed-in buyer into the shared `Actor` shape from
 * `../auth/authorization.ts` — every buyer-scoped route/mutation should
 * authorize against this, not raw `buyerUserId`. Returns `null` for no
 * session, a session pointing at a since-removed buyer (stale cookie after
 * an admin removes the user), or a session whose row is somehow gone —
 * callers treat all of these as simply "not signed in."
 */
export async function getCurrentActor(db: Db): Promise<Extract<Actor, { kind: 'buyer' }> | null> {
  const session = await getBuyerSession()
  const buyerUserId = session.data.buyerUserId
  if (!buyerUserId) return null

  const [buyer] = await db
    .select({ id: buyerUsers.id, companyId: buyerUsers.companyId, role: buyerUsers.role, status: buyerUsers.status })
    .from(buyerUsers)
    .where(eq(buyerUsers.id, buyerUserId))
    .limit(1)

  if (!buyer || buyer.status !== 'active') return null

  return { kind: 'buyer', buyerUserId: buyer.id, companyId: buyer.companyId, role: buyer.role }
}

export class NotSignedInError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'NotSignedInError'
  }
}

/** For server functions that require a signed-in buyer — throws rather than returning null, so callers don't have to re-check. */
export async function requireActor(db: Db): Promise<Extract<Actor, { kind: 'buyer' }>> {
  const actor = await getCurrentActor(db)
  if (!actor) throw new NotSignedInError()
  return actor
}

export async function establishBuyerSession(buyerUserId: string): Promise<void> {
  const session = await getBuyerSession()
  await session.update({ buyerUserId })
}

export async function clearBuyerSession(): Promise<void> {
  const session = await getBuyerSession()
  await session.clear()
}
