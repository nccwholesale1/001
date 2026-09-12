import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { baskets, buyerUsers, companies } from '../db/schema'

/**
 * `useSession` depends on request-scoped context (AsyncLocalStorage) that
 * only exists inside a real request/server-function invocation — a plain
 * unit test has none, so the mechanism itself is mocked here with a
 * simple in-memory stand-in that behaves the same way for the one thing
 * `getOrCreateBasketId` needs: reading and updating `data.basketId`.
 */
function createFakeSession(initialData: { basketId?: string; buyerUserId?: string } = {}) {
  const data = { ...initialData }
  return {
    id: 'fake-session',
    data,
    update: vi.fn(
      async (update: Record<string, unknown> | ((old: typeof data) => Record<string, unknown>)) => {
        const patch = typeof update === 'function' ? update(data) : update
        Object.assign(data, patch)
        return { id: 'fake-session', data }
      },
    ),
    clear: vi.fn(),
  }
}

describe('getOrCreateBasketId', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.doUnmock('@tanstack/react-start/server')
    vi.resetModules()
  })

  it('creates a new basket and remembers it in the session on a first visit', async () => {
    const session = createFakeSession()
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn().mockResolvedValue(session),
    }))
    const { getOrCreateBasketId } = await import('./session')

    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    const basketId = await getOrCreateBasketId(db)

    expect(session.data.basketId).toBe(basketId)
    const rows = await db.select().from(baskets)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(basketId)
  })

  it('restores the same basket on a returning visit (session already names an open basket)', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(baskets).values({ id: 'existing-basket', status: 'open' })

    const session = createFakeSession({ basketId: 'existing-basket' })
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn().mockResolvedValue(session),
    }))
    const { getOrCreateBasketId } = await import('./session')

    expect(await getOrCreateBasketId(db)).toBe('existing-basket')
    expect(session.update).not.toHaveBeenCalled()
  })

  it('issues a fresh basket if the session points at one that has already been submitted', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(baskets).values({ id: 'old-basket', status: 'submitted' })

    const session = createFakeSession({ basketId: 'old-basket' })
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn().mockResolvedValue(session),
    }))
    const { getOrCreateBasketId } = await import('./session')

    const basketId = await getOrCreateBasketId(db)

    expect(basketId).not.toBe('old-basket')
    expect(session.data.basketId).toBe(basketId)
  })

  it('a signed-in buyer gets their own basket by identity, never the guest cookie mechanism', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(companies).values({ id: 'co-a', name: 'Acme' })
    await db.insert(buyerUsers).values({
      id: 'buyer-1',
      companyId: 'co-a',
      name: 'Buyer One',
      email: 'buyer1@example.com',
      role: 'buyer',
      status: 'active',
    })

    const guestSession = createFakeSession()
    const buyerSession = createFakeSession({ buyerUserId: 'buyer-1' })
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn((opts: { name: string }) =>
        Promise.resolve(opts.name === 'ncc_buyer' ? buyerSession : guestSession),
      ),
    }))
    const { getOrCreateBasketId } = await import('./session')

    const basketId = await getOrCreateBasketId(db)

    const [basket] = await db.select().from(baskets).where(eq(baskets.id, basketId))
    expect(basket?.buyerUserId).toBe('buyer-1')
    expect(guestSession.update).not.toHaveBeenCalled()

    const again = await getOrCreateBasketId(db)
    expect(again).toBe(basketId)
  })
})
