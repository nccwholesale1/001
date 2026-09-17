import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { staffUsers } from '../db/schema'
import { bootstrapFirstNccAdmin, BootstrapAdminExistsError } from './bootstrap-admin'

describe('bootstrapFirstNccAdmin', () => {
  it('creates an active ncc_admin when none exist', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await bootstrapFirstNccAdmin(db, {
        name: 'NCC Admin',
        email: 'Admin@Example.com',
        username: 'NccAdmin',
        password: 'a-real-password',
      })
      const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(row?.role).toBe('ncc_admin')
      expect(row?.status).toBe('active')
      expect(row?.email).toBe('admin@example.com')
      expect(row?.username).toBe('nccadmin')
      expect(row?.employeeId).toBeNull()
    } finally {
      client.close()
    }
  })

  it('refuses to create a second ncc_admin', async () => {
    const { db, client } = await createTestDb()
    try {
      await bootstrapFirstNccAdmin(db, {
        name: 'First',
        email: 'first@example.com',
        username: 'first',
        password: 'a-real-password',
      })
      await expect(
        bootstrapFirstNccAdmin(db, {
          name: 'Second',
          email: 'second@example.com',
          username: 'second',
          password: 'a-real-password',
        }),
      ).rejects.toThrow(BootstrapAdminExistsError)
    } finally {
      client.close()
    }
  })
})
