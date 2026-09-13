import type { Actor } from '../auth/authorization'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, supportTickets } from '../db/schema'
import { listSupportTicketsForStaff } from './staff-support-queue'

describe('listSupportTicketsForStaff', () => {
  it('cross-tenant isolation: a sales rep sees only their assigned company, never a guest ticket', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(companies).values([
        { id: 'co-assigned', name: 'Assigned Co' },
        { id: 'co-other', name: 'Other Co' },
      ])
      await db.insert(buyerUsers).values([
        { id: 'buyer-assigned', companyId: 'co-assigned', name: 'A', email: 'a@example.com', role: 'buyer', status: 'active' },
        { id: 'buyer-other', companyId: 'co-other', name: 'B', email: 'b@example.com', role: 'buyer', status: 'active' },
      ])
      await db.insert(supportTickets).values([
        { id: 'ticket-guest', status: 'open', category: 'other', guestContactEmail: 'g@example.com' },
        { id: 'ticket-assigned', status: 'open', category: 'other', buyerUserId: 'buyer-assigned' },
        { id: 'ticket-other', status: 'open', category: 'other', buyerUserId: 'buyer-other' },
      ])

      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: ['co-assigned'] }
      const result = await listSupportTicketsForStaff(db, rep)
      expect(result.map((t) => t.id)).toEqual(['ticket-assigned'])

      const admin: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
      const adminResult = await listSupportTicketsForStaff(db, admin)
      expect(adminResult.map((t) => t.id).sort()).toEqual(['ticket-assigned', 'ticket-guest', 'ticket-other'])
    } finally {
      client.close()
    }
  })
})
