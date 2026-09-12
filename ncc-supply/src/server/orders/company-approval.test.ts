import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { InvalidTransitionError } from '../domain/status'
import { createTestDb } from '../db/test-helpers'
import { auditEvents, buyerUsers, companies, orderRequestLines, orderRequests } from '../db/schema'
import { decideCompanyApproval, OrderRequestNotFoundError } from './company-approval'

describe('decideCompanyApproval', () => {
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
      { id: 'buyer-a', companyId: 'co-a', name: 'Buyer A', email: 'buyer-a@example.com', role: 'buyer', status: 'active' },
      { id: 'admin-b', companyId: 'co-b', name: 'Admin B', email: 'admin-b@example.com', role: 'company_admin', status: 'active' },
    ])
    await db.insert(orderRequests).values({
      id: 'order-1',
      buyerUserId: 'buyer-a',
      status: 'awaiting_company_approval',
    })
    await db.insert(orderRequestLines).values({
      id: 'line-1',
      orderRequestId: 'order-1',
      sku: 'FIXTURE-CHG-001',
      shopifyVariantId: 'gid://shopify/ProductVariant/1',
      requestedQuantity: 3,
      unitPricePence: 1299,
    })
    return db
  }

  const adminA: Actor = { kind: 'buyer', buyerUserId: 'admin-a', companyId: 'co-a', role: 'company_admin' }
  const buyerA: Actor = { kind: 'buyer', buyerUserId: 'buyer-a', companyId: 'co-a', role: 'buyer' }
  const adminB: Actor = { kind: 'buyer', buyerUserId: 'admin-b', companyId: 'co-b', role: 'company_admin' }

  it("approves, advancing status to awaiting_ncc_review and recording who/when", async () => {
    const db = await seed()
    await decideCompanyApproval(db, adminA, { orderRequestId: 'order-1', decision: 'approve' })

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.status).toBe('awaiting_ncc_review')
    expect(order?.companyApprovedByBuyerUserId).toBe('admin-a')
    expect(order?.companyApprovedAt).not.toBeNull()

    const [event] = await db.select().from(auditEvents).where(eq(auditEvents.action, 'company_approve_order'))
    expect(event?.resourceId).toBe('order-1')
  })

  it('rejects, moving status to cancelled with a reason', async () => {
    const db = await seed()
    await decideCompanyApproval(db, adminA, { orderRequestId: 'order-1', decision: 'reject', reason: 'Duplicate order' })

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.status).toBe('cancelled')
    expect(order?.cancelledReason).toBe('Duplicate order')
  })

  it('rejects a plain buyer (non-admin) from deciding', async () => {
    const db = await seed()
    await expect(
      decideCompanyApproval(db, buyerA, { orderRequestId: 'order-1', decision: 'approve' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it("rejects a different company's admin from seeing or deciding this order (cross-company isolation)", async () => {
    const db = await seed()
    await expect(
      decideCompanyApproval(db, adminB, { orderRequestId: 'order-1', decision: 'approve' }),
    ).rejects.toThrow(ForbiddenError)

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.status).toBe('awaiting_company_approval')
  })

  it('a replayed approval on an already-decided order fails cleanly rather than double-applying', async () => {
    const db = await seed()
    await decideCompanyApproval(db, adminA, { orderRequestId: 'order-1', decision: 'approve' })

    await expect(
      decideCompanyApproval(db, adminA, { orderRequestId: 'order-1', decision: 'approve' }),
    ).rejects.toThrow(InvalidTransitionError)

    const events = await db.select().from(auditEvents).where(eq(auditEvents.action, 'company_approve_order'))
    expect(events).toHaveLength(1)
  })

  it('throws for a nonexistent order request', async () => {
    const db = await seed()
    await expect(
      decideCompanyApproval(db, adminA, { orderRequestId: 'no-such-order', decision: 'approve' }),
    ).rejects.toThrow(OrderRequestNotFoundError)
  })
})
