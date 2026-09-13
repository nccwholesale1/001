import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { orderRequestLines, orderRequests, returnLines, returns } from '../db/schema'
import { issueGuestToken } from '../tokens/token-service'
import {
  OrderNotEligibleForReturnError,
  ReturnQuantityExceedsAvailableError,
  submitReturnRequest,
} from './submit-return-request'

async function seedConfirmedOrder(db: Awaited<ReturnType<typeof createTestDb>>['db'], status: 'confirmed' | 'awaiting_ncc_review' = 'confirmed') {
  await db.insert(orderRequests).values({ id: 'order-1', status, guestContactEmail: 'guest@example.com' })
  await db.insert(orderRequestLines).values({
    id: 'line-1',
    orderRequestId: 'order-1',
    sku: 'FIXTURE-CHG-001',
    shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
    requestedQuantity: 5,
    confirmedQuantity: 5,
    unitPricePence: 1000,
  })
}

describe('submitReturnRequest', () => {
  it('rejects a return against an order that is not confirmed', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedConfirmedOrder(db, 'awaiting_ncc_review')
      const { token } = await issueGuestToken(db, 'order_request', 'order-1')
      await expect(
        submitReturnRequest(db, null, {
          orderRequestId: 'order-1',
          reason: 'damaged',
          lines: [{ orderRequestLineId: 'line-1', quantity: 1 }],
          orderToken: token,
        }),
      ).rejects.toThrow(OrderNotEligibleForReturnError)
    } finally {
      client.close()
    }
  })

  it('rejects a guest with no valid order token', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedConfirmedOrder(db)
      await expect(
        submitReturnRequest(db, null, {
          orderRequestId: 'order-1',
          reason: 'damaged',
          lines: [{ orderRequestLineId: 'line-1', quantity: 1 }],
        }),
      ).rejects.toThrow()
    } finally {
      client.close()
    }
  })

  it('rejects a guest token that belongs to a different order', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedConfirmedOrder(db)
      await db.insert(orderRequests).values({ id: 'order-2', status: 'confirmed', guestContactEmail: 'other@example.com' })
      const { token } = await issueGuestToken(db, 'order_request', 'order-2')

      await expect(
        submitReturnRequest(db, null, {
          orderRequestId: 'order-1',
          reason: 'damaged',
          lines: [{ orderRequestLineId: 'line-1', quantity: 1 }],
          orderToken: token,
        }),
      ).rejects.toThrow()
    } finally {
      client.close()
    }
  })

  it('rejects a return quantity above what was confirmed', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedConfirmedOrder(db)
      const { token } = await issueGuestToken(db, 'order_request', 'order-1')
      await expect(
        submitReturnRequest(db, null, {
          orderRequestId: 'order-1',
          reason: 'damaged',
          lines: [{ orderRequestLineId: 'line-1', quantity: 10 }],
          orderToken: token,
        }),
      ).rejects.toThrow(ReturnQuantityExceedsAvailableError)
    } finally {
      client.close()
    }
  })

  it('accepts a valid return, minting a guest token', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedConfirmedOrder(db)
      const { token } = await issueGuestToken(db, 'order_request', 'order-1')
      const result = await submitReturnRequest(db, null, {
        orderRequestId: 'order-1',
        reason: 'damaged',
        lines: [{ orderRequestLineId: 'line-1', quantity: 2 }],
        orderToken: token,
      })

      expect(result.kind).toBe('guest')
      const [ret] = await db.select().from(returns).where(eq(returns.orderRequestId, 'order-1'))
      expect(ret?.status).toBe('requested')
      const lines = await db.select().from(returnLines).where(eq(returnLines.returnId, ret!.id))
      expect(lines).toEqual([expect.objectContaining({ orderRequestLineId: 'line-1', quantity: 2 })])
    } finally {
      client.close()
    }
  })

  it('rejects a second return once the confirmed quantity is fully claimed by a prior non-rejected return', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedConfirmedOrder(db)
      const { token } = await issueGuestToken(db, 'order_request', 'order-1')
      await submitReturnRequest(db, null, {
        orderRequestId: 'order-1',
        reason: 'damaged',
        lines: [{ orderRequestLineId: 'line-1', quantity: 5 }],
        orderToken: token,
      })

      await expect(
        submitReturnRequest(db, null, {
          orderRequestId: 'order-1',
          reason: 'other',
          lines: [{ orderRequestLineId: 'line-1', quantity: 1 }],
          orderToken: token,
        }),
      ).rejects.toThrow(ReturnQuantityExceedsAvailableError)
    } finally {
      client.close()
    }
  })
})
