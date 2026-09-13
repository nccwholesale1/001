import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { orderRequests, supportTicketMessages, supportTickets } from '../db/schema'
import { issueGuestToken } from '../tokens/token-service'
import { submitSupportTicket, UnverifiedReferenceError } from './submit-support-ticket'

describe('submitSupportTicket', () => {
  it('creates a general guest ticket with no reference at all', async () => {
    const { db, client } = await createTestDb()
    try {
      const result = await submitSupportTicket(db, null, {
        category: 'site_issue',
        message: 'The search box is broken.',
        contactEmail: 'guest@example.com',
      })
      expect(result.kind).toBe('guest')
      const [ticket] = await db.select().from(supportTickets)
      expect(ticket?.status).toBe('open')
      expect(ticket?.guestContactEmail).toBe('guest@example.com')

      const messages = await db.select().from(supportTicketMessages).where(eq(supportTicketMessages.supportTicketId, ticket!.id))
      expect(messages).toHaveLength(1)
      expect(messages[0]?.isInternalNote).toBe(false)
    } finally {
      client.close()
    }
  })

  it('rejects a guest referencing an order without that order\'s own token', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(orderRequests).values({ id: 'order-1', status: 'confirmed', guestContactEmail: 'guest@example.com' })
      await expect(
        submitSupportTicket(db, null, { category: 'order_issue', orderRequestId: 'order-1', message: 'Where is my order?' }),
      ).rejects.toThrow(UnverifiedReferenceError)
    } finally {
      client.close()
    }
  })

  it('rejects a guest referencing an order using a token for a different order', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(orderRequests).values([
        { id: 'order-1', status: 'confirmed', guestContactEmail: 'guest@example.com' },
        { id: 'order-2', status: 'confirmed', guestContactEmail: 'other@example.com' },
      ])
      const { token } = await issueGuestToken(db, 'order_request', 'order-2')
      await expect(
        submitSupportTicket(db, null, {
          category: 'order_issue',
          orderRequestId: 'order-1',
          message: 'Where is my order?',
          referenceToken: token,
        }),
      ).rejects.toThrow(UnverifiedReferenceError)
    } finally {
      client.close()
    }
  })

  it('accepts a guest referencing an order with that order\'s own valid token', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(orderRequests).values({ id: 'order-1', status: 'confirmed', guestContactEmail: 'guest@example.com' })
      const { token } = await issueGuestToken(db, 'order_request', 'order-1')
      const result = await submitSupportTicket(db, null, {
        category: 'order_issue',
        orderRequestId: 'order-1',
        message: 'Where is my order?',
        referenceToken: token,
      })
      expect(result.kind).toBe('guest')
      const [ticket] = await db.select().from(supportTickets)
      expect(ticket?.orderRequestId).toBe('order-1')
    } finally {
      client.close()
    }
  })
})
