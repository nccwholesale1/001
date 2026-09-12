import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { staffSessions, staffUsers } from '../db/schema'
import { createTestDb } from '../db/test-helpers'
import {
  createSession,
  invalidateAllSessionsForStaff,
  invalidateSession,
  verifySession,
} from './session'

async function seedStaffUser(
  db: Awaited<ReturnType<typeof createTestDb>>['db'],
  overrides?: { role?: 'ncc_admin' | 'sales_rep' },
) {
  const id = 'staff_1'
  await db.insert(staffUsers).values({
    id,
    name: 'Jordan Admin',
    email: 'jordan@ncc-supply.test',
    username: 'jordan.admin',
    passwordHash: 'scrypt:unused-in-this-test:unused',
    role: overrides?.role ?? 'ncc_admin',
    status: 'active',
  })
  return id
}

describe('session lifecycle', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('verifies a freshly created session and returns the staff role', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const staffUserId = await seedStaffUser(db, { role: 'sales_rep' })

    const { token, expiresAt } = await createSession(db, staffUserId)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now())

    const authenticated = await verifySession(db, token)
    expect(authenticated).toEqual({ staffUserId, role: 'sales_rep' })
  })

  it('never persists the raw token', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const staffUserId = await seedStaffUser(db)

    const { token } = await createSession(db, staffUserId)
    const rows = await db.select().from(staffSessions)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).not.toBe(token)
  })

  it('rejects an unknown token without distinguishing it from an expired one', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    expect(await verifySession(db, 'not-a-real-token')).toBeNull()
  })

  it('rejects a token after invalidation (logout)', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const staffUserId = await seedStaffUser(db)

    const { token } = await createSession(db, staffUserId)
    await invalidateSession(db, token)

    expect(await verifySession(db, token)).toBeNull()
  })

  it('rejects a token belonging to a deactivated staff account', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const staffUserId = await seedStaffUser(db)
    const { token } = await createSession(db, staffUserId)

    await db.update(staffUsers).set({ status: 'deactivated' }).where(eq(staffUsers.id, staffUserId))

    expect(await verifySession(db, token)).toBeNull()
  })

  it('invalidateAllSessionsForStaff revokes every session for that staff user only', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const staffUserId = await seedStaffUser(db)

    const sessionA = await createSession(db, staffUserId)
    const sessionB = await createSession(db, staffUserId)

    await invalidateAllSessionsForStaff(db, staffUserId)

    expect(await verifySession(db, sessionA.token)).toBeNull()
    expect(await verifySession(db, sessionB.token)).toBeNull()
  })
})
