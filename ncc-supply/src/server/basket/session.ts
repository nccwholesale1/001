import { randomUUID } from 'node:crypto'
import { useSession } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { getCurrentActor } from '../buyers/buyer-session'
import type { Db } from '../db/client'
import { baskets } from '../db/schema'
import { env } from '../env'

interface BasketSessionData {
  basketId?: string
}

function getBasketSession() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- TanStack Start's `useSession` is a server-side request-context utility (AsyncLocalStorage-backed), not a React hook, despite the naming convention; it has no call-order constraints and is safe to call from a plain async function.
  return useSession<BasketSessionData>({
    password: env.SESSION_SECRET,
    name: 'ncc_basket',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      path: '/',
    },
  })
}

/**
 * A signed-in buyer's identity (the buyer session itself) is the basket
 * anchor — no cookie pointer needed, unlike the guest path, since the
 * buyer's own row can just be queried for their open basket directly.
 */
export async function getOrCreateBuyerBasketId(db: Db, buyerUserId: string): Promise<string> {
  const [existing] = await db
    .select({ id: baskets.id })
    .from(baskets)
    .where(and(eq(baskets.buyerUserId, buyerUserId), eq(baskets.status, 'open')))
    .limit(1)
  if (existing) return existing.id

  const id = randomUUID()
  await db.insert(baskets).values({ id, buyerUserId })
  return id
}

/**
 * The guest basket's persistence mechanism (PRD §6.5 "persistent guest
 * basket"): an encrypted, httpOnly session cookie (TanStack Start's own
 * `useSession`, sealed with the existing `SESSION_SECRET`) holds only a
 * pointer — the basket's own id — never basket contents, and nothing a
 * client could tamper with meaningfully.
 *
 * A submitted basket is never reused: once `status` moves off `open`
 * (Phase 6's own submission flow), the next visit gets a fresh basket
 * rather than resurfacing a completed one as if it were still editable.
 *
 * A signed-in buyer (Phase 7) never touches the guest cookie mechanism at
 * all — checked first, so every existing call site (server-functions.ts,
 * ProductCard, /product/$sku) keeps working unchanged for both guest and
 * buyer without knowing which one it's talking to.
 */
export async function getOrCreateBasketId(db: Db): Promise<string> {
  const actor = await getCurrentActor(db)
  if (actor) return getOrCreateBuyerBasketId(db, actor.buyerUserId)

  const session = await getBasketSession()

  if (session.data.basketId) {
    const [existing] = await db
      .select({ id: baskets.id, status: baskets.status })
      .from(baskets)
      .where(eq(baskets.id, session.data.basketId))
      .limit(1)
    if (existing && existing.status === 'open') return existing.id
  }

  const id = randomUUID()
  await db.insert(baskets).values({ id })
  await session.update({ basketId: id })
  return id
}
