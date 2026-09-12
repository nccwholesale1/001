import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies } from '../db/schema'

function createFakeSession(initialData: { buyerUserId?: string } = {}) {
  const data = { ...initialData }
  return {
    id: 'fake-buyer-session',
    data,
    update: vi.fn(async (patch: Record<string, unknown>) => {
      Object.assign(data, patch)
      return { id: 'fake-buyer-session', data }
    }),
    clear: vi.fn(async () => {
      for (const key of Object.keys(data)) delete (data as Record<string, unknown>)[key]
    }),
  }
}

describe('getCurrentActor', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.doUnmock('@tanstack/react-start/server')
    vi.resetModules()
  })

  async function seed() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(companies).values({ id: 'co-a', name: 'Acme' })
    await db.insert(buyerUsers).values([
      { id: 'active-buyer', companyId: 'co-a', name: 'Active', email: 'active@example.com', role: 'buyer', status: 'active' },
      { id: 'removed-buyer', companyId: 'co-a', name: 'Removed', email: 'removed@example.com', role: 'buyer', status: 'removed' },
    ])
    return db
  }

  it('returns null when there is no session', async () => {
    const db = await seed()
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn().mockResolvedValue(createFakeSession()),
    }))
    const { getCurrentActor } = await import('./buyer-session')

    expect(await getCurrentActor(db)).toBeNull()
  })

  it('resolves an active buyer into a buyer Actor', async () => {
    const db = await seed()
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn().mockResolvedValue(createFakeSession({ buyerUserId: 'active-buyer' })),
    }))
    const { getCurrentActor } = await import('./buyer-session')

    const actor = await getCurrentActor(db)
    expect(actor).toEqual({ kind: 'buyer', buyerUserId: 'active-buyer', companyId: 'co-a', role: 'buyer' })
  })

  it('treats a stale session pointing at a removed buyer as not signed in', async () => {
    const db = await seed()
    vi.doMock('@tanstack/react-start/server', () => ({
      useSession: vi.fn().mockResolvedValue(createFakeSession({ buyerUserId: 'removed-buyer' })),
    }))
    const { getCurrentActor } = await import('./buyer-session')

    expect(await getCurrentActor(db)).toBeNull()
  })
})
