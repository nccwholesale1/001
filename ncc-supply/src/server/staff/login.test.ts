import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { hashPassword } from '../auth/password'
import { createTestDb } from '../db/test-helpers'
import { staffUsers } from '../db/schema'
import { AccountDeactivatedError, InvalidCredentialsError, signInStaff } from './login'

describe('signInStaff', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  async function seed() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const passwordHash = await hashPassword('correct-horse-battery-staple')
    await db.insert(staffUsers).values([
      {
        id: 'admin-1',
        name: 'Admin One',
        email: 'admin@example.com',
        username: 'admin.one',
        passwordHash,
        role: 'ncc_admin',
        status: 'active',
      },
      {
        id: 'rep-pending',
        name: 'Pending Rep',
        email: 'rep@example.com',
        username: 'pending.rep',
        passwordHash,
        role: 'sales_rep',
        employeeId: 'EMP-001',
        status: 'pending_id_verification',
      },
      {
        id: 'rep-no-employee-id',
        name: 'No Employee Id Rep',
        email: 'rep2@example.com',
        username: 'rep2',
        passwordHash,
        role: 'sales_rep',
        status: 'pending_id_verification',
      },
      {
        id: 'deactivated-1',
        name: 'Deactivated One',
        email: 'gone@example.com',
        username: 'gone',
        passwordHash,
        role: 'ncc_admin',
        status: 'deactivated',
      },
    ])
    return db
  }

  it('signs in by email', async () => {
    const db = await seed()
    const result = await signInStaff(db, { identifier: 'admin@example.com', password: 'correct-horse-battery-staple' })
    expect(result.staffUserId).toBe('admin-1')
    expect(result.role).toBe('ncc_admin')
    expect(result.session.token).toEqual(expect.any(String))
  })

  it('signs in by username, same account as email', async () => {
    const db = await seed()
    const result = await signInStaff(db, { identifier: 'admin.one', password: 'correct-horse-battery-staple' })
    expect(result.staffUserId).toBe('admin-1')
  })

  it('rejects a wrong password without revealing which part was wrong', async () => {
    const db = await seed()
    await expect(signInStaff(db, { identifier: 'admin@example.com', password: 'nope' })).rejects.toThrow(
      InvalidCredentialsError,
    )
  })

  it('rejects an unknown identifier with the same error as a wrong password', async () => {
    const db = await seed()
    await expect(
      signInStaff(db, { identifier: 'nobody@example.com', password: 'correct-horse-battery-staple' }),
    ).rejects.toThrow(InvalidCredentialsError)
  })

  it('refuses a deactivated account', async () => {
    const db = await seed()
    await expect(
      signInStaff(db, { identifier: 'gone@example.com', password: 'correct-horse-battery-staple' }),
    ).rejects.toThrow(AccountDeactivatedError)
  })

  it('ADR-007: activates a pending sales rep with an employee id on their first successful login', async () => {
    const db = await seed()
    const result = await signInStaff(db, { identifier: 'rep@example.com', password: 'correct-horse-battery-staple' })
    expect(result.role).toBe('sales_rep')

    const [rep] = await db.select().from(staffUsers).where(eq(staffUsers.id, 'rep-pending'))
    expect(rep?.status).toBe('active')
  })

  it('refuses to activate a pending sales rep with no employee id on file', async () => {
    const db = await seed()
    await expect(
      signInStaff(db, { identifier: 'rep2@example.com', password: 'correct-horse-battery-staple' }),
    ).rejects.toThrow()

    const [rep] = await db.select().from(staffUsers).where(eq(staffUsers.id, 'rep-no-employee-id'))
    expect(rep?.status).toBe('pending_id_verification')
  })
})
