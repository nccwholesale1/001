import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { InvalidTransitionError } from '../domain/status'
import { createTestDb } from '../db/test-helpers'
import { supportTicketMessages, supportTickets, staffUsers } from '../db/schema'
import {
  escalateSupportTicket,
  getGuestSupportLink,
  replyAsCustomer,
  replyAsStaff,
  resolveSupportTicket,
  SupportTicketNotFoundError,
} from './support-processing'

const ncc: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }

async function seedTicket(db: Awaited<ReturnType<typeof createTestDb>>['db'], status: 'open' | 'awaiting_ncc' | 'awaiting_customer' | 'resolved' | 'escalated' = 'open') {
  await db.insert(staffUsers).values({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', username: 'admin', passwordHash: 'x', role: 'ncc_admin', status: 'active' })
  await db.insert(supportTickets).values({ id: 'ticket-1', status, category: 'other', guestContactEmail: 'guest@example.com' })
}

describe('replyAsCustomer', () => {
  it('cannot reply while a ticket is still open — nothing to reply to yet', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'open')
      await expect(replyAsCustomer(db, 'ticket-1', null, { message: 'Hello?' })).rejects.toThrow(InvalidTransitionError)
    } finally {
      client.close()
    }
  })

  it('replies while awaiting_customer, moving to awaiting_ncc', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'awaiting_customer')
      await replyAsCustomer(db, 'ticket-1', null, { message: 'Thanks, here is more info.' })
      const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, 'ticket-1'))
      expect(ticket?.status).toBe('awaiting_ncc')
    } finally {
      client.close()
    }
  })

  it('replying to a resolved ticket implicitly reopens it', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'resolved')
      await replyAsCustomer(db, 'ticket-1', null, { message: 'Actually this is still broken.' })
      const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, 'ticket-1'))
      expect(ticket?.status).toBe('awaiting_ncc')
    } finally {
      client.close()
    }
  })
})

describe('replyAsStaff', () => {
  it('an ncc_admin reply moves the ticket to awaiting_customer', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'open')
      await replyAsStaff(db, ncc, { ticketId: 'ticket-1', message: 'We are looking into it.', isInternalNote: false })
      const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, 'ticket-1'))
      expect(ticket?.status).toBe('awaiting_customer')
    } finally {
      client.close()
    }
  })

  it('an internal note never changes the customer-visible status', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'open')
      await replyAsStaff(db, ncc, { ticketId: 'ticket-1', message: 'Checking with warehouse.', isInternalNote: true })
      const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, 'ticket-1'))
      expect(ticket?.status).toBe('open')
      const messages = await db.select().from(supportTicketMessages).where(eq(supportTicketMessages.supportTicketId, 'ticket-1'))
      expect(messages).toHaveLength(1)
      expect(messages[0]?.isInternalNote).toBe(true)
    } finally {
      client.close()
    }
  })

  it('a sales rep is denied — replying, resolving and escalating are all NCC-admin-only', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'open')
      await expect(replyAsStaff(db, rep, { ticketId: 'ticket-1', message: 'x', isInternalNote: false })).rejects.toThrow(ForbiddenError)
      await expect(resolveSupportTicket(db, rep, 'ticket-1')).rejects.toThrow(ForbiddenError)
      await expect(escalateSupportTicket(db, rep, 'ticket-1')).rejects.toThrow(ForbiddenError)
      await expect(getGuestSupportLink(db, rep, 'ticket-1')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })

  it('throws for a nonexistent ticket', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(staffUsers).values({ id: 'admin-1', name: 'Admin', email: 'admin@example.com', username: 'admin', passwordHash: 'x', role: 'ncc_admin', status: 'active' })
      await expect(replyAsStaff(db, ncc, { ticketId: 'no-such-ticket', message: 'x', isInternalNote: false })).rejects.toThrow(SupportTicketNotFoundError)
    } finally {
      client.close()
    }
  })
})

describe('getGuestSupportLink', () => {
  it('mints a link for a guest ticket, null for a buyer ticket', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedTicket(db, 'open')
      const url = await getGuestSupportLink(db, ncc, 'ticket-1')
      expect(url).toMatch(/^\/support\/ticket-1\?token=/)
    } finally {
      client.close()
    }
  })
})
