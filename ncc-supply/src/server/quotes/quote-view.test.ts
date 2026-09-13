import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, quoteLines, quotes } from '../db/schema'
import { issueGuestToken, verifyGuestToken } from '../tokens/token-service'
import { buildQuoteView, getQuoteViewForActor, listQuotesForActor } from './quote-view'

async function seedGuestQuote(db: Awaited<ReturnType<typeof createTestDb>>['db'], overrides: Partial<{ status: 'requested' | 'quoted' | 'accepted' | 'expired'; expiresAt: string | null }> = {}) {
  await db.insert(quotes).values({
    id: 'quote-1',
    status: overrides.status ?? 'requested',
    guestContactEmail: 'guest@example.com',
    expiresAt: overrides.expiresAt ?? null,
  })
  await db.insert(quoteLines).values({
    id: 'line-1',
    quoteId: 'quote-1',
    sku: 'FIXTURE-CHG-001',
    shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
    requestedQuantity: 2,
    quotedUnitPricePence: overrides.status === 'quoted' || overrides.status === 'accepted' ? 999 : null,
  })
}

describe('buildQuoteView', () => {
  it('resolves the current product title from the catalogue for each line', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      const view = await buildQuoteView(db, 'quote-1')
      expect(view?.lines[0].title).not.toBe('FIXTURE-CHG-001') // resolved to a real title, not falling back to the bare SKU
      expect(view?.lines[0].sku).toBe('FIXTURE-CHG-001')
    } finally {
      client.close()
    }
  })

  it('returns null for a nonexistent quote', async () => {
    const { db, client } = await createTestDb()
    try {
      expect(await buildQuoteView(db, 'no-such-quote')).toBeNull()
    } finally {
      client.close()
    }
  })

  it('lazily expires a quoted-but-past-expiry quote and persists the transition', async () => {
    const { db, client } = await createTestDb()
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await seedGuestQuote(db, { status: 'quoted', expiresAt: yesterday })

      const view = await buildQuoteView(db, 'quote-1')
      expect(view?.status).toBe('expired')

      const [row] = await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, 'quote-1'))
      expect(row?.status).toBe('expired')
    } finally {
      client.close()
    }
  })
})

describe('quote token isolation', () => {
  it('a quote token never resolves as an order_request, and vice versa', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      const { token } = await issueGuestToken(db, 'quote', 'quote-1')

      expect(await verifyGuestToken(db, token, 'quote')).toEqual({ resourceId: 'quote-1' })
      expect(await verifyGuestToken(db, token, 'order_request')).toBeNull()
    } finally {
      client.close()
    }
  })
})

describe('getQuoteViewForActor / listQuotesForActor', () => {
  async function seedCompanyQuote(db: Awaited<ReturnType<typeof createTestDb>>['db']) {
    await db.insert(companies).values({ id: 'co-1', name: 'Acme' })
    await db.insert(buyerUsers).values({
      id: 'buyer-1',
      companyId: 'co-1',
      name: 'A Buyer',
      email: 'buyer@example.com',
      role: 'buyer',
      status: 'active',
    })
    await db.insert(quotes).values({ id: 'quote-co', status: 'requested', buyerUserId: 'buyer-1' })
    await db.insert(quoteLines).values({
      id: 'line-co',
      quoteId: 'quote-co',
      sku: 'FIXTURE-CHG-001',
      shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
      requestedQuantity: 1,
    })
  }

  it('a buyer can view their own company quote; a sales rep outside the company is denied', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedCompanyQuote(db)
      const buyer: Actor = { kind: 'buyer', buyerUserId: 'buyer-1', companyId: 'co-1', role: 'buyer' }
      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }

      expect(await getQuoteViewForActor(db, buyer, 'quote-co')).not.toBeNull()
      await expect(getQuoteViewForActor(db, rep, 'quote-co')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })

  it('a sales rep assigned to the company can view it read-only; an ncc_admin sees everything', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedCompanyQuote(db)
      const assignedRep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: ['co-1'] }
      const admin: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }

      expect(await getQuoteViewForActor(db, assignedRep, 'quote-co')).not.toBeNull()
      expect(await getQuoteViewForActor(db, admin, 'quote-co')).not.toBeNull()
    } finally {
      client.close()
    }
  })

  it('never exposes a guest quote to a sales rep — companyId: null is never assignable', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedGuestQuote(db)
      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }
      await expect(getQuoteViewForActor(db, rep, 'quote-1')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })

  it('listQuotesForActor: a plain buyer sees only their own; a company admin sees the whole company', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedCompanyQuote(db)
      await db.insert(buyerUsers).values({
        id: 'buyer-2',
        companyId: 'co-1',
        name: 'Another Buyer',
        email: 'buyer2@example.com',
        role: 'buyer',
        status: 'active',
      })
      await db.insert(quotes).values({ id: 'quote-other-buyer', status: 'requested', buyerUserId: 'buyer-2' })

      const plainBuyer: Actor = { kind: 'buyer', buyerUserId: 'buyer-1', companyId: 'co-1', role: 'buyer' }
      const admin: Actor = { kind: 'buyer', buyerUserId: 'buyer-1', companyId: 'co-1', role: 'company_admin' }

      const plainResult = await listQuotesForActor(db, plainBuyer)
      expect(plainResult.map((q) => q.id)).toEqual(['quote-co'])

      const adminResult = await listQuotesForActor(db, admin)
      expect(adminResult.map((q) => q.id).sort()).toEqual(['quote-co', 'quote-other-buyer'])
    } finally {
      client.close()
    }
  })
})
