import type { Actor } from '../auth/authorization'
import { describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, orderRequestLines, orderRequests, returnLines, returns } from '../db/schema'
import { listReturnsForStaff } from './staff-return-queue'

async function seedReturns(db: Awaited<ReturnType<typeof createTestDb>>['db']) {
  await db.insert(companies).values([
    { id: 'co-assigned', name: 'Assigned Co' },
    { id: 'co-other', name: 'Other Co' },
  ])
  await db.insert(buyerUsers).values([
    { id: 'buyer-assigned', companyId: 'co-assigned', name: 'A', email: 'a@example.com', role: 'buyer', status: 'active' },
    { id: 'buyer-other', companyId: 'co-other', name: 'B', email: 'b@example.com', role: 'buyer', status: 'active' },
  ])
  await db.insert(orderRequests).values([
    { id: 'order-guest', status: 'confirmed', guestContactEmail: 'guest@example.com' },
    { id: 'order-assigned', status: 'confirmed', buyerUserId: 'buyer-assigned' },
    { id: 'order-other', status: 'confirmed', buyerUserId: 'buyer-other' },
  ])
  await db.insert(orderRequestLines).values(
    ['order-guest', 'order-assigned', 'order-other'].map((orderRequestId, i) => ({
      id: `order-line-${i}`,
      orderRequestId,
      sku: 'FIXTURE-CHG-001',
      shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
      requestedQuantity: 1,
      confirmedQuantity: 1,
      unitPricePence: 1000,
    })),
  )
  await db.insert(returns).values([
    { id: 'return-guest', orderRequestId: 'order-guest', status: 'requested', reason: 'damaged' },
    { id: 'return-assigned', orderRequestId: 'order-assigned', status: 'requested', reason: 'damaged' },
    { id: 'return-other', orderRequestId: 'order-other', status: 'requested', reason: 'damaged' },
  ])
  await db.insert(returnLines).values(
    [
      { returnId: 'return-guest', orderLineId: 'order-line-0' },
      { returnId: 'return-assigned', orderLineId: 'order-line-1' },
      { returnId: 'return-other', orderLineId: 'order-line-2' },
    ].map(({ returnId, orderLineId }, i) => ({
      id: `line-${i}`,
      returnId,
      orderRequestLineId: orderLineId,
      quantity: 1,
    })),
  )
}

describe('listReturnsForStaff', () => {
  it('an ncc_admin sees every return, guest and company alike', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturns(db)
      const admin: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
      const result = await listReturnsForStaff(db, admin)
      expect(result.map((r) => r.id).sort()).toEqual(['return-assigned', 'return-guest', 'return-other'])
    } finally {
      client.close()
    }
  })

  it('a sales rep sees only their assigned company and never a guest return — cross-tenant isolation', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturns(db)
      const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: ['co-assigned'] }
      const result = await listReturnsForStaff(db, rep)
      expect(result.map((r) => r.id)).toEqual(['return-assigned'])
    } finally {
      client.close()
    }
  })
})
