import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { InvalidTransitionError } from '../domain/status'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, orderRequestLines, orderRequests, quoteLines, quotes, staffUsers } from '../db/schema'
import { acceptQuote, getGuestQuoteLink, issueQuote, QuoteLineMismatchError, QuoteNotFoundError } from './quote-pricing'

const ncc: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }

async function seedGuestQuote(db: Awaited<ReturnType<typeof createTestDb>>['db'], status: 'requested' | 'quoted' = 'requested', expiresAt: string | null = null) {
  await db.insert(quotes).values({
    id: 'quote-1',
    status,
    guestContactEmail: 'guest@example.com',
    guestContactName: 'Guest Buyer',
    expiresAt,
  })
  await db.insert(quoteLines).values({
    id: 'line-1',
    quoteId: 'quote-1',
    sku: 'FIXTURE-CHG-001',
    shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
    requestedQuantity: 3,
    quotedUnitPricePence: status === 'quoted' ? 1500 : null,
  })
}

const issueInput = {
  quoteId: 'quote-1',
  lines: [{ quoteLineId: 'line-1', quotedUnitPricePence: 1500 }],
}

describe('issueQuote', () => {
  it('prices every line and moves the quote to quoted, with an expiry set', async () => {
    const { db, client } = await createTestDb()
    try {
      await db.insert(staffUsers).values({
        id: 'admin-1',
        name: 'Admin One',
        email: 'admin@example.com',
        username: 'admin.one',
        passwordHash: 'x',
        role: 'ncc_admin',
        status: 'active',
      })
      await seedGuestQuote(db)
      await issueQuote(db, ncc, issueInput)

      const [quote] = await db.select().from(quotes).where(eq(quotes.id, 'quote-1'))
      expect(quote?.status).toBe('quoted')
      expect(quote?.issuedByStaffUserId).toBe('admin-1')
      expect(quote?.expiresAt).toEqual(expect.any(String))

      const [line] = await db.select().from(quoteLines).where(eq(quoteLines.id, 'line-1'))
      expect(line?.quotedUnitPricePence).toBe(1500)
    } finally {
      client.close()
    }
  })

  it('denies a sales rep — pricing is NCC-admin-only', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      await expect(issueQuote(db, rep, issueInput)).rejects.toThrow(ForbiddenError)

      const [quote] = await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, 'quote-1'))
      expect(quote?.status).toBe('requested')
    } finally {
      client.close()
    }
  })

  it('rejects a line list that does not match the quote', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      await expect(
        issueQuote(db, ncc, { quoteId: 'quote-1', lines: [{ quoteLineId: 'no-such-line', quotedUnitPricePence: 100 }] }),
      ).rejects.toThrow(QuoteLineMismatchError)
    } finally {
      client.close()
    }
  })

  it('throws for a nonexistent quote', async () => {
    const { db, client } = await createTestDb()
    try {
      await expect(issueQuote(db, ncc, { ...issueInput, quoteId: 'no-such-quote' })).rejects.toThrow(QuoteNotFoundError)
    } finally {
      client.close()
    }
  })
})

describe('acceptQuote', () => {
  it('converts a guest quote into an order at awaiting_ncc_review, minting a guest token for it', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db, 'quoted')
      const { orderRequestId, token } = await acceptQuote(db, 'quote-1')

      expect(token).toEqual(expect.any(String))
      const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, orderRequestId))
      expect(order?.status).toBe('awaiting_ncc_review')
      expect(order?.guestContactEmail).toBe('guest@example.com')

      const lines = await db.select().from(orderRequestLines).where(eq(orderRequestLines.orderRequestId, orderRequestId))
      expect(lines).toEqual([
        expect.objectContaining({ sku: 'FIXTURE-CHG-001', requestedQuantity: 3, unitPricePence: 1500 }),
      ])

      const [quote] = await db.select().from(quotes).where(eq(quotes.id, 'quote-1'))
      expect(quote?.status).toBe('accepted')
      expect(quote?.convertedOrderRequestId).toBe(orderRequestId)
    } finally {
      client.close()
    }
  })

  it('converts a company buyer quote into an order at awaiting_company_approval, no token', async () => {
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
      await db.insert(quotes).values({ id: 'quote-buyer', status: 'quoted', buyerUserId: 'buyer-1' })
      await db.insert(quoteLines).values({
        id: 'line-buyer',
        quoteId: 'quote-buyer',
        sku: 'FIXTURE-CHG-001',
        shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
        requestedQuantity: 1,
        quotedUnitPricePence: 999,
      })

      const { orderRequestId, token } = await acceptQuote(db, 'quote-buyer')
      expect(token).toBeUndefined()

      const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, orderRequestId))
      expect(order?.status).toBe('awaiting_company_approval')
      expect(order?.buyerUserId).toBe('buyer-1')
    } finally {
      client.close()
    }
  })

  it('rejects repeated acceptance cleanly', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db, 'quoted')
      await acceptQuote(db, 'quote-1')
      await expect(acceptQuote(db, 'quote-1')).rejects.toThrow(InvalidTransitionError)
    } finally {
      client.close()
    }
  })

  it('rejects accepting a quote that was never priced', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db, 'requested')
      await expect(acceptQuote(db, 'quote-1')).rejects.toThrow(InvalidTransitionError)
    } finally {
      client.close()
    }
  })

  it('rejects accepting an expired quote and observably transitions it to expired', async () => {
    const { db, client } = await createTestDb()
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await seedGuestQuote(db, 'quoted', yesterday)

      await expect(acceptQuote(db, 'quote-1')).rejects.toThrow(InvalidTransitionError)

      const [quote] = await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, 'quote-1'))
      expect(quote?.status).toBe('expired')
    } finally {
      client.close()
    }
  })
})

describe('getGuestQuoteLink', () => {
  it('mints a link for a guest quote', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      const url = await getGuestQuoteLink(db, ncc, 'quote-1')
      expect(url).toMatch(/^\/quote\/quote-1\?token=/)
    } finally {
      client.close()
    }
  })

  it('returns null for a company-buyer quote', async () => {
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
      await db.insert(quotes).values({ id: 'quote-buyer', status: 'requested', buyerUserId: 'buyer-1' })
      expect(await getGuestQuoteLink(db, ncc, 'quote-buyer')).toBeNull()
    } finally {
      client.close()
    }
  })

  it('denies a sales rep', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      await expect(getGuestQuoteLink(db, rep, 'quote-1')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })
})
