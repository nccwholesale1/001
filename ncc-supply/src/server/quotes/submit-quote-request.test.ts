import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, quoteLines, quotes } from '../db/schema'
import { NoMatchingProductsError, submitQuoteRequest } from './submit-quote-request'

describe('submitQuoteRequest', () => {
  it('a guest request creates a requested quote and mints a guest token', async () => {
    const { db, client } = await createTestDb()
    try {
      const result = await submitQuoteRequest(db, null, {
        lines: [{ sku: 'FIXTURE-CHG-001', quantity: 4 }],
        contactEmail: 'guest@example.com',
        contactName: 'Guest Buyer',
      })

      expect(result.kind).toBe('guest')
      if (result.kind !== 'guest') throw new Error('expected guest result')
      expect(result.token).toEqual(expect.any(String))

      const [quote] = await db.select().from(quotes).where(eq(quotes.id, result.quoteId))
      expect(quote?.status).toBe('requested')
      expect(quote?.guestContactEmail).toBe('guest@example.com')
      expect(quote?.buyerUserId).toBeNull()

      const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, result.quoteId))
      expect(lines).toEqual([
        expect.objectContaining({ sku: 'FIXTURE-CHG-001', requestedQuantity: 4, quotedUnitPricePence: null }),
      ])
    } finally {
      client.close()
    }
  })

  it('a signed-in buyer request creates a quote under their own buyerUserId, no token', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(companies).values({ id: 'co-1', name: 'Acme' })
      await db.insert(buyerUsers).values({
        id: 'buyer-1',
        companyId: 'co-1',
        name: 'A Buyer',
        email: 'buyer@example.com',
        role: 'buyer',
        status: 'active',
      })
      const actor = { kind: 'buyer' as const, buyerUserId: 'buyer-1', companyId: 'co-1', role: 'buyer' as const }
      const result = await submitQuoteRequest(db, actor, { lines: [{ sku: 'FIXTURE-CAB-001', quantity: 1 }] })

      expect(result.kind).toBe('buyer')
      const [quote] = await db.select().from(quotes).where(eq(quotes.id, result.quoteId))
      expect(quote?.buyerUserId).toBe('buyer-1')
      expect(quote?.status).toBe('requested')
    } finally {
      client.close()
    }
  })

  it('rejects the whole request if any SKU is unknown, inserting nothing', async () => {
    const { db, client } = await createTestDb()
    try {
      await expect(
        submitQuoteRequest(db, null, {
          lines: [
            { sku: 'FIXTURE-CHG-001', quantity: 1 },
            { sku: 'NOT-A-REAL-SKU', quantity: 1 },
          ],
        }),
      ).rejects.toThrow(NoMatchingProductsError)

      expect(await db.select().from(quotes)).toEqual([])
    } finally {
      client.close()
    }
  })
})
