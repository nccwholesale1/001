import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { InvalidTransitionError } from '../domain/status'
import { createTestDb } from '../db/test-helpers'
import { companies, salesRepAssignments, staffUsers } from '../db/schema'
import {
  addStaffAccount,
  assignSalesRepCompany,
  DuplicateStaffFieldError,
  EmployeeIdRequiredError,
  InvalidEmployeeIdFormatError,
  deactivateStaffAccount,
  listStaffAccounts,
  reactivateStaffAccount,
  unassignSalesRepCompany,
  updateStaffRole,
} from './team-management'

const ncc: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }
const buyer: Actor = { kind: 'buyer', buyerUserId: 'buyer-1', companyId: 'co-1', role: 'buyer' }

describe('addStaffAccount', () => {
  it('creates an ncc_admin active immediately, with no employee ID required', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, {
        name: 'New Admin',
        email: 'New.Admin@Example.com',
        username: 'NewAdmin',
        role: 'ncc_admin',
        initialPassword: 'a-real-password',
      })
      const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(row?.status).toBe('active')
      expect(row?.employeeId).toBeNull()
      // Case normalization: email/username are stored lowercase regardless of how they were typed.
      expect(row?.email).toBe('new.admin@example.com')
      expect(row?.username).toBe('newadmin')
    } finally {
      client.close()
    }
  })

  it('creates a sales rep as pending_id_verification, never active until first login', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, {
        name: 'New Rep',
        email: 'rep@example.com',
        username: 'reponee',
        role: 'sales_rep',
        initialPassword: 'a-real-password',
        employeeId: 'EMP-001',
      })
      const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(row?.status).toBe('pending_id_verification')
      expect(row?.employeeId).toBe('EMP-001')
    } finally {
      client.close()
    }
  })

  it('rejects a sales rep with no employee ID — cannot activate without one', async () => {
    const { db, client } = await createTestDb()
    try {
      await expect(
        addStaffAccount(db, ncc, { name: 'No ID', email: 'noid@example.com', username: 'noid', role: 'sales_rep', initialPassword: 'a-real-password' }),
      ).rejects.toThrow(EmployeeIdRequiredError)
    } finally {
      client.close()
    }
  })

  it('rejects a malformed employee ID', async () => {
    const { db, client } = await createTestDb()
    try {
      await expect(
        addStaffAccount(db, ncc, {
          name: 'Bad ID',
          email: 'badid@example.com',
          username: 'badid',
          role: 'sales_rep',
          initialPassword: 'a-real-password',
          employeeId: '!!',
        }),
      ).rejects.toThrow(InvalidEmployeeIdFormatError)
    } finally {
      client.close()
    }
  })

  it('rejects a duplicate email regardless of case — email/username ambiguity', async () => {
    const { db, client } = await createTestDb()
    try {
      await addStaffAccount(db, ncc, { name: 'First', email: 'dup@example.com', username: 'first', role: 'ncc_admin', initialPassword: 'a-real-password' })
      await expect(
        addStaffAccount(db, ncc, { name: 'Second', email: 'DUP@EXAMPLE.COM', username: 'second', role: 'ncc_admin', initialPassword: 'a-real-password' }),
      ).rejects.toThrow(DuplicateStaffFieldError)
    } finally {
      client.close()
    }
  })

  it('rejects a duplicate username', async () => {
    const { db, client } = await createTestDb()
    try {
      await addStaffAccount(db, ncc, { name: 'First', email: 'first@example.com', username: 'sameuser', role: 'ncc_admin', initialPassword: 'a-real-password' })
      await expect(
        addStaffAccount(db, ncc, { name: 'Second', email: 'second@example.com', username: 'sameuser', role: 'ncc_admin', initialPassword: 'a-real-password' }),
      ).rejects.toThrow(DuplicateStaffFieldError)
    } finally {
      client.close()
    }
  })

  it('rejects a duplicate employee ID', async () => {
    const { db, client } = await createTestDb()
    try {
      await addStaffAccount(db, ncc, { name: 'First', email: 'first@example.com', username: 'first', role: 'sales_rep', initialPassword: 'a-real-password', employeeId: 'EMP-1' })
      await expect(
        addStaffAccount(db, ncc, { name: 'Second', email: 'second@example.com', username: 'second', role: 'sales_rep', initialPassword: 'a-real-password', employeeId: 'EMP-1' }),
      ).rejects.toThrow(DuplicateStaffFieldError)
    } finally {
      client.close()
    }
  })

  it('denies horizontal privilege escalation — a sales rep or buyer cannot add staff accounts', async () => {
    const { db, client } = await createTestDb()
    try {
      const input = { name: 'X', email: 'x@example.com', username: 'x', role: 'ncc_admin' as const, initialPassword: 'a-real-password' }
      await expect(addStaffAccount(db, rep, input)).rejects.toThrow(ForbiddenError)
      await expect(addStaffAccount(db, buyer, input)).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})

describe('deactivate / reactivate', () => {
  it('deactivates an active account, then reactivates it — and rejects an invalid transition', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, { name: 'X', email: 'x@example.com', username: 'x', role: 'ncc_admin', initialPassword: 'a-real-password' })
      await deactivateStaffAccount(db, ncc, staffUserId)
      const [after] = await db.select({ status: staffUsers.status }).from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(after?.status).toBe('deactivated')

      await expect(deactivateStaffAccount(db, ncc, staffUserId)).rejects.toThrow(InvalidTransitionError)

      await reactivateStaffAccount(db, ncc, staffUserId)
      const [reactivated] = await db.select({ status: staffUsers.status }).from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(reactivated?.status).toBe('active')
    } finally {
      client.close()
    }
  })

  it('denies a sales rep from deactivating any account', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, { name: 'X', email: 'x@example.com', username: 'x', role: 'ncc_admin', initialPassword: 'a-real-password' })
      await expect(deactivateStaffAccount(db, rep, staffUserId)).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})

describe('updateStaffRole — role downgrade', () => {
  it('downgrading an ncc_admin to sales_rep requires a new employee ID', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, { name: 'X', email: 'x@example.com', username: 'x', role: 'ncc_admin', initialPassword: 'a-real-password' })
      await expect(updateStaffRole(db, ncc, staffUserId, 'sales_rep')).rejects.toThrow(EmployeeIdRequiredError)

      await updateStaffRole(db, ncc, staffUserId, 'sales_rep', 'EMP-9')
      const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(row?.role).toBe('sales_rep')
      expect(row?.employeeId).toBe('EMP-9')
    } finally {
      client.close()
    }
  })

  it('upgrading a sales_rep to ncc_admin clears the employee ID', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, { name: 'X', email: 'x@example.com', username: 'x', role: 'sales_rep', initialPassword: 'a-real-password', employeeId: 'EMP-1' })
      await updateStaffRole(db, ncc, staffUserId, 'ncc_admin')
      const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffUserId))
      expect(row?.role).toBe('ncc_admin')
      expect(row?.employeeId).toBeNull()
    } finally {
      client.close()
    }
  })

  it('denies a sales rep from changing any role', async () => {
    const { db, client } = await createTestDb()
    try {
      const { staffUserId } = await addStaffAccount(db, ncc, { name: 'X', email: 'x@example.com', username: 'x', role: 'ncc_admin', initialPassword: 'a-real-password' })
      await expect(updateStaffRole(db, rep, staffUserId, 'sales_rep', 'EMP-1')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})

describe('sales rep company assignment', () => {
  it('assigns and unassigns a company, denying a sales rep from doing either', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(companies).values({ id: 'co-1', name: 'Acme' })
      const { staffUserId } = await addStaffAccount(db, ncc, { name: 'Rep', email: 'rep@example.com', username: 'rep', role: 'sales_rep', initialPassword: 'a-real-password', employeeId: 'EMP-1' })

      await assignSalesRepCompany(db, ncc, staffUserId, 'co-1')
      const assignments = await db.select().from(salesRepAssignments).where(eq(salesRepAssignments.staffUserId, staffUserId))
      expect(assignments).toHaveLength(1)

      await unassignSalesRepCompany(db, ncc, staffUserId, 'co-1')
      const afterUnassign = await db.select().from(salesRepAssignments).where(eq(salesRepAssignments.staffUserId, staffUserId))
      expect(afterUnassign).toHaveLength(0)

      await expect(assignSalesRepCompany(db, rep, staffUserId, 'co-1')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})

describe('listStaffAccounts', () => {
  it('denies read access to anyone but an ncc_admin — direct URL access protection', async () => {
    const { db, client } = await createTestDb()
    try {
      await expect(listStaffAccounts(db, rep)).rejects.toThrow(ForbiddenError)
      await expect(listStaffAccounts(db, buyer)).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})
