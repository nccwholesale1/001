import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSession } from '../auth/session'
import { createTestDb } from '../db/test-helpers'
import { companies, salesRepAssignments, staffUsers } from '../db/schema'

describe('getCurrentStaffActor', () => {
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
    await db.insert(companies).values([{ id: 'co-a', name: 'Acme' }, { id: 'co-b', name: 'Beta' }])
    await db.insert(staffUsers).values([
      { id: 'admin-1', name: 'Admin', email: 'admin@example.com', username: 'admin', passwordHash: 'x', role: 'ncc_admin', status: 'active' },
      { id: 'rep-1', name: 'Rep', email: 'rep@example.com', username: 'rep', passwordHash: 'x', role: 'sales_rep', status: 'active' },
    ])
    await db.insert(salesRepAssignments).values({ id: 'assign-1', staffUserId: 'rep-1', companyId: 'co-a' })
    return db
  }

  function mockCookie(token: string | undefined) {
    vi.doMock('@tanstack/react-start/server', () => ({
      getCookie: vi.fn(() => token),
      setCookie: vi.fn(),
      deleteCookie: vi.fn(),
    }))
  }

  it('returns null when there is no session cookie', async () => {
    const db = await seed()
    mockCookie(undefined)
    const { getCurrentStaffActor } = await import('./staff-session')
    expect(await getCurrentStaffActor(db)).toBeNull()
  })

  it('resolves an ncc_admin actor with no assignedCompanyIds field needed', async () => {
    const db = await seed()
    const { token } = await createSession(db, 'admin-1')
    mockCookie(token)
    const { getCurrentStaffActor } = await import('./staff-session')

    expect(await getCurrentStaffActor(db)).toEqual({ kind: 'ncc_admin', staffUserId: 'admin-1' })
  })

  it('resolves a sales_rep actor with their real assigned companies loaded', async () => {
    const db = await seed()
    const { token } = await createSession(db, 'rep-1')
    mockCookie(token)
    const { getCurrentStaffActor } = await import('./staff-session')

    expect(await getCurrentStaffActor(db)).toEqual({
      kind: 'sales_rep',
      staffUserId: 'rep-1',
      assignedCompanyIds: ['co-a'],
    })
  })

  it('returns null for an invalid/expired token', async () => {
    const db = await seed()
    mockCookie('not-a-real-token')
    const { getCurrentStaffActor } = await import('./staff-session')
    expect(await getCurrentStaffActor(db)).toBeNull()
  })
})
