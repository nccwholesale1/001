import { describe, expect, it } from 'vitest'
import type { Actor } from '../auth/authorization'
import { ForbiddenError } from '../auth/authorization'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, staffUsers, supportTicketMessages, supportTickets } from '../db/schema'
import { buildSupportTicketView, getSupportTicketViewForActor } from './support-view'

async function seedTicketWithInternalNote(db: Awaited<ReturnType<typeof createTestDb>>['db']) {
  await db.insert(staffUsers).values({
    id: 'admin-1',
    name: 'Admin One',
    email: 'admin@example.com',
    username: 'admin.one',
    passwordHash: 'x',
    role: 'ncc_admin',
    status: 'active',
  })
  await db.insert(supportTickets).values({ id: 'ticket-1', status: 'open', category: 'other', guestContactEmail: 'guest@example.com' })
  await db.insert(supportTicketMessages).values([
    { id: 'msg-1', supportTicketId: 'ticket-1', message: 'Customer message', isInternalNote: false },
    { id: 'msg-2', supportTicketId: 'ticket-1', authorStaffUserId: 'admin-1', message: 'Internal-only commentary', isInternalNote: true },
  ])
}

describe('buildSupportTicketView', () => {
  it('never includes an internal note when includeInternalNotes is false — the customer-facing contract', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicketWithInternalNote(db)
      const view = await buildSupportTicketView(db, 'ticket-1', { includeInternalNotes: false })
      expect(view?.messages).toHaveLength(1)
      expect(view?.messages.some((m) => m.isInternalNote)).toBe(false)
      expect(view?.messages.some((m) => m.message.includes('Internal-only'))).toBe(false)
    } finally {
      client.close()
    }
  })

  it('includes internal notes when includeInternalNotes is true — the staff-facing contract', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicketWithInternalNote(db)
      const view = await buildSupportTicketView(db, 'ticket-1', { includeInternalNotes: true })
      expect(view?.messages).toHaveLength(2)
      expect(view?.messages.some((m) => m.isInternalNote)).toBe(true)
    } finally {
      client.close()
    }
  })
})

describe('getSupportTicketViewForActor', () => {
  it('a buyer never sees internal notes on their own ticket', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(companies).values({ id: 'co-1', name: 'Acme' })
      await db.insert(buyerUsers).values({ id: 'buyer-1', companyId: 'co-1', name: 'A Buyer', email: 'buyer@example.com', role: 'buyer', status: 'active' })
      await db.insert(supportTickets).values({ id: 'ticket-buyer', status: 'open', category: 'other', buyerUserId: 'buyer-1' })
      await db.insert(staffUsers).values({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', username: 'admin', passwordHash: 'x', role: 'ncc_admin', status: 'active' })
      await db.insert(supportTicketMessages).values({ id: 'msg-1', supportTicketId: 'ticket-buyer', authorStaffUserId: 'admin-1', message: 'Secret', isInternalNote: true })

      const buyer: Actor = { kind: 'buyer', buyerUserId: 'buyer-1', companyId: 'co-1', role: 'buyer' }
      const view = await getSupportTicketViewForActor(db, buyer, 'ticket-buyer')
      expect(view?.messages).toHaveLength(0)
    } finally {
      client.close()
    }
  })

  it('a sales rep sees internal notes for their assigned company (staff, just read-only)', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(companies).values({ id: 'co-1', name: 'Acme' })
      await db.insert(buyerUsers).values({ id: 'buyer-1', companyId: 'co-1', name: 'A Buyer', email: 'buyer@example.com', role: 'buyer', status: 'active' })
      await db.insert(supportTickets).values({ id: 'ticket-buyer', status: 'open', category: 'other', buyerUserId: 'buyer-1' })
      await db.insert(staffUsers).values({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', username: 'admin', passwordHash: 'x', role: 'ncc_admin', status: 'active' })
      await db.insert(supportTicketMessages).values({ id: 'msg-1', supportTicketId: 'ticket-buyer', authorStaffUserId: 'admin-1', message: 'Secret', isInternalNote: true })

      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: ['co-1'] }
      const view = await getSupportTicketViewForActor(db, rep, 'ticket-buyer')
      expect(view?.messages).toHaveLength(1)
    } finally {
      client.close()
    }
  })

  it('never exposes a guest ticket to a sales rep', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(supportTickets).values({ id: 'ticket-guest', status: 'open', category: 'other', guestContactEmail: 'g@example.com' })
      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }
      await expect(getSupportTicketViewForActor(db, rep, 'ticket-guest')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})
