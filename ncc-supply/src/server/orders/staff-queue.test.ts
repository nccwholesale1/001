import { afterEach, describe, expect, it } from 'vitest'
import type { Actor } from '../auth/authorization'
import { createTestDb } from '../db/test-helpers'
import { buyerUsers, companies, orderRequestLines, orderRequests } from '../db/schema'
import { listOrderRequestsForStaff } from './staff-queue'

describe('listOrderRequestsForStaff', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  async function seed() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(companies).values([{ id: 'co-a', name: 'Acme' }, { id: 'co-b', name: 'Beta' }])
    await db.insert(buyerUsers).values([
      { id: 'buyer-a', companyId: 'co-a', name: 'Buyer A', email: 'a@example.com', role: 'buyer', status: 'active' },
      { id: 'buyer-b', companyId: 'co-b', name: 'Buyer B', email: 'b@example.com', role: 'buyer', status: 'active' },
    ])
    await db.insert(orderRequests).values([
      { id: 'order-guest', guestContactEmail: 'guest@example.com', status: 'awaiting_ncc_review' },
      { id: 'order-a', buyerUserId: 'buyer-a', status: 'awaiting_ncc_review' },
      { id: 'order-b', buyerUserId: 'buyer-b', status: 'awaiting_ncc_review' },
    ])
    await db.insert(orderRequestLines).values([
      { id: 'l1', orderRequestId: 'order-guest', sku: 'X', shopifyVariantId: 'v1', requestedQuantity: 1, unitPricePence: 100 },
      { id: 'l2', orderRequestId: 'order-a', sku: 'X', shopifyVariantId: 'v1', requestedQuantity: 1, unitPricePence: 100 },
      { id: 'l3', orderRequestId: 'order-b', sku: 'X', shopifyVariantId: 'v1', requestedQuantity: 1, unitPricePence: 100 },
    ])
    return db
  }

  it('an ncc_admin sees every order, including guest orders', async () => {
    const db = await seed()
    const admin: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
    const orders = await listOrderRequestsForStaff(db, admin)
    expect(orders.map((o) => o.id).sort()).toEqual(['order-a', 'order-b', 'order-guest'])
  })

  it('a sales rep sees only their assigned company, and never a guest order', async () => {
    const db = await seed()
    const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: ['co-a'] }
    const orders = await listOrderRequestsForStaff(db, rep)
    expect(orders.map((o) => o.id)).toEqual(['order-a'])
  })

  it('a sales rep with no assignments sees nothing', async () => {
    const db = await seed()
    const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-2', assignedCompanyIds: [] }
    expect(await listOrderRequestsForStaff(db, rep)).toEqual([])
  })
})
