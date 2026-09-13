import type { Actor } from '../auth/authorization'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, quoteLines, quotes } from '../db/schema'
import { listQuotesForStaff } from './staff-quote-queue'

async function seedQuotes(db: Awaited<ReturnType<typeof createTestDb>>['db']) {
  await db.insert(companies).values([
    { id: 'co-assigned', name: 'Assigned Co' },
    { id: 'co-other', name: 'Other Co' },
  ])
  await db.insert(buyerUsers).values([
    { id: 'buyer-assigned', companyId: 'co-assigned', name: 'Buyer A', email: 'a@example.com', role: 'buyer', status: 'active' },
    { id: 'buyer-other', companyId: 'co-other', name: 'Buyer B', email: 'b@example.com', role: 'buyer', status: 'active' },
  ])
  await db.insert(quotes).values([
    { id: 'quote-guest', status: 'requested', guestContactEmail: 'guest@example.com' },
    { id: 'quote-assigned', status: 'requested', buyerUserId: 'buyer-assigned' },
    { id: 'quote-other', status: 'requested', buyerUserId: 'buyer-other' },
  ])
  await db.insert(quoteLines).values(
    ['quote-guest', 'quote-assigned', 'quote-other'].map((quoteId, i) => ({
      id: `line-${i}`,
      quoteId,
      sku: 'FIXTURE-CHG-001',
      shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
      requestedQuantity: 1,
    })),
  )
}

describe('listQuotesForStaff', () => {
  it('an ncc_admin sees every quote, guest and company alike', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedQuotes(db)
      const admin: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
      const result = await listQuotesForStaff(db, admin)
      expect(result.map((q) => q.id).sort()).toEqual(['quote-assigned', 'quote-guest', 'quote-other'])
    } finally {
      client.close()
    }
  })

  it('a sales rep sees only their assigned company and never a guest quote', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedQuotes(db)
      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: ['co-assigned'] }
      const result = await listQuotesForStaff(db, rep)
      expect(result.map((q) => q.id)).toEqual(['quote-assigned'])
    } finally {
      client.close()
    }
  })

  it('a sales rep with no assignments sees nothing', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedQuotes(db)
      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }
      expect(await listQuotesForStaff(db, rep)).toEqual([])
    } finally {
      client.close()
    }
  })
})
