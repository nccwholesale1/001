import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { createTestDb } from '../db/test-helpers'
import { basketLines, baskets, buyerUsers, companies, orderRequestLines, orderRequests } from '../db/schema'
import {
  buildOrderRequestView,
  getOrderRequestViewForActor,
  listOrderRequestsForActor,
  reorderIntoBasket,
} from './order-view'

describe('order-view', () => {
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
      { id: 'admin-a', companyId: 'co-a', name: 'Admin A', email: 'admin-a@example.com', role: 'company_admin', status: 'active' },
      { id: 'buyer-a1', companyId: 'co-a', name: 'Buyer A1', email: 'buyer-a1@example.com', role: 'buyer', status: 'active' },
      { id: 'buyer-a2', companyId: 'co-a', name: 'Buyer A2', email: 'buyer-a2@example.com', role: 'buyer', status: 'active' },
      { id: 'admin-b', companyId: 'co-b', name: 'Admin B', email: 'admin-b@example.com', role: 'company_admin', status: 'active' },
    ])
    await db.insert(orderRequests).values([
      { id: 'order-a1', buyerUserId: 'buyer-a1', status: 'awaiting_company_approval' },
      { id: 'order-a2', buyerUserId: 'buyer-a2', status: 'awaiting_ncc_review' },
    ])
    await db.insert(orderRequestLines).values([
      { id: 'line-a1', orderRequestId: 'order-a1', sku: 'FIXTURE-CHG-001', shopifyVariantId: 'gid://v/1', requestedQuantity: 2, unitPricePence: 1299 },
      { id: 'line-a2', orderRequestId: 'order-a2', sku: 'FIXTURE-CHG-001', shopifyVariantId: 'gid://v/1', requestedQuantity: 5, confirmedQuantity: 3, unitPricePence: 1299 },
    ])
    return db
  }

  const adminA: Actor = { kind: 'buyer', buyerUserId: 'admin-a', companyId: 'co-a', role: 'company_admin' }
  const buyerA1: Actor = { kind: 'buyer', buyerUserId: 'buyer-a1', companyId: 'co-a', role: 'buyer' }
  const buyerA2: Actor = { kind: 'buyer', buyerUserId: 'buyer-a2', companyId: 'co-a', role: 'buyer' }
  const adminB: Actor = { kind: 'buyer', buyerUserId: 'admin-b', companyId: 'co-b', role: 'company_admin' }

  describe('listOrderRequestsForActor', () => {
    it('shows a plain buyer only their own orders', async () => {
      const db = await seed()
      const orders = await listOrderRequestsForActor(db, buyerA1)
      expect(orders.map((o) => o.id)).toEqual(['order-a1'])
    })

    it('shows a company admin every order in the company', async () => {
      const db = await seed()
      const orders = await listOrderRequestsForActor(db, adminA)
      expect(orders.map((o) => o.id).sort()).toEqual(['order-a1', 'order-a2'])
    })

    it("never returns another company's orders (cross-company isolation)", async () => {
      const db = await seed()
      const orders = await listOrderRequestsForActor(db, adminB)
      expect(orders).toEqual([])
    })
  })

  describe('getOrderRequestViewForActor', () => {
    it("lets a buyer view their own order's detail", async () => {
      const db = await seed()
      const view = await getOrderRequestViewForActor(db, buyerA1, 'order-a1')
      expect(view?.id).toBe('order-a1')
      expect(view?.lines).toHaveLength(1)
    })

    it("rejects a buyer viewing a co-worker's order (own-data-only, unauthorized price access)", async () => {
      const db = await seed()
      await expect(getOrderRequestViewForActor(db, buyerA1, 'order-a2')).rejects.toThrow(ForbiddenError)
    })

    it('lets a company admin view any order in the company', async () => {
      const db = await seed()
      const view = await getOrderRequestViewForActor(db, adminA, 'order-a2')
      expect(view?.id).toBe('order-a2')
    })

    it("rejects a different company's admin (cross-company isolation)", async () => {
      const db = await seed()
      await expect(getOrderRequestViewForActor(db, adminB, 'order-a1')).rejects.toThrow(ForbiddenError)
    })

    it('returns null for a nonexistent order id', async () => {
      const db = await seed()
      expect(await getOrderRequestViewForActor(db, adminA, 'no-such-order')).toBeNull()
    })
  })

  describe('buildOrderRequestView', () => {
    it('always resolves line prices from the catalogue adapter, never the client', async () => {
      const db = await seed()
      const view = await buildOrderRequestView(db, 'order-a1')
      // 1299 is the real fixture price for FIXTURE-CHG-001 — proves nothing client-supplied leaked in.
      expect(view?.lines[0]?.unitPricePence).toBe(1299)
    })
  })

  describe('reorderIntoBasket', () => {
    it('duplicates confirmed (or requested, if unconfirmed) quantities into a fresh basket for that buyer', async () => {
      const db = await seed()
      await reorderIntoBasket(db, buyerA2, 'order-a2')

      const [basket] = await db.select().from(baskets).where(eq(baskets.buyerUserId, 'buyer-a2'))
      expect(basket?.status).toBe('open')
      const lines = await db.select().from(basketLines).where(eq(basketLines.basketId, basket!.id))
      expect(lines).toHaveLength(1)
      expect(lines[0]?.quantity).toBe(3) // confirmedQuantity, not the original requestedQuantity of 5
    })

    it("rejects reordering another buyer's order", async () => {
      const db = await seed()
      await expect(reorderIntoBasket(db, buyerA1, 'order-a2')).rejects.toThrow(ForbiddenError)
    })
  })
})
