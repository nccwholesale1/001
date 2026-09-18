import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { InvalidTransitionError } from '../domain/status'
import { createTestDb } from '../db/test-helpers'
import { auditEvents, buyerUsers, companies, orderRequestLines, orderRequests, staffUsers } from '../db/schema'
import { cancelOrder, confirmOrder, getGuestOrderLink, OrderRequestNotFoundError, retryShopifySync } from './ncc-approval'

const ncc: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }

describe('ncc-approval', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.doUnmock('../integrations/shopify')
    vi.resetModules()
  })

  async function seed() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(staffUsers).values({
      id: 'admin-1',
      name: 'Admin One',
      email: 'admin@example.com',
      username: 'admin.one',
      passwordHash: 'x',
      role: 'ncc_admin',
      status: 'active',
    })
    await db.insert(orderRequests).values({
      id: 'order-1',
      guestContactEmail: 'guest@example.com',
      status: 'awaiting_ncc_review',
    })
    await db.insert(orderRequestLines).values({
      id: 'line-1',
      orderRequestId: 'order-1',
      sku: 'FIXTURE-CHG-001',
      shopifyVariantId: 'gid://shopify/ProductVariant/1',
      requestedQuantity: 5,
      unitPricePence: 1000,
    })
    return db
  }

  const approvalInput = {
    orderRequestId: 'order-1',
    lines: [{ orderRequestLineId: 'line-1', confirmedQuantity: 3 }],
    deliveryPence: 500,
    finalTotalPence: 3500,
  }

  it('confirms the order atomically and syncs a real (fixture) Shopify draft order + invoice', async () => {
    const db = await seed()
    await confirmOrder(db, ncc, approvalInput)

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.status).toBe('confirmed')
    expect(order?.deliveryPence).toBe(500)
    // Subtotal 3000 + delivery 500. No VAT is added on top — prices are
    // VAT-inclusive (PRD §14 A2).
    expect(order?.finalTotalPence).toBe(3500)
    expect(order?.vatPence).toBeNull()
    expect(order?.nccApprovedByStaffUserId).toBe('admin-1')
    expect(order?.shopifyDraftOrderId).toEqual(expect.any(String))
    expect(order?.invoiceUrl).toEqual(expect.any(String))

    const [line] = await db.select().from(orderRequestLines).where(eq(orderRequestLines.id, 'line-1'))
    expect(line?.confirmedQuantity).toBe(3)

    const [event] = await db.select().from(auditEvents).where(eq(auditEvents.action, 'ncc_approve_order'))
    expect(event?.resourceId).toBe('order-1')
  })

  it('rejects a confirmed quantity above what was requested', async () => {
    const db = await seed()
    await expect(
      confirmOrder(db, ncc, { ...approvalInput, lines: [{ orderRequestLineId: 'line-1', confirmedQuantity: 999 }] }),
    ).rejects.toThrow()

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.status).toBe('awaiting_ncc_review')
  })

  it('a replayed approval on an already-confirmed order fails cleanly, never double-syncing Shopify', async () => {
    const db = await seed()
    await confirmOrder(db, ncc, approvalInput)
    const [firstDraft] = await db.select({ id: orderRequests.shopifyDraftOrderId }).from(orderRequests).where(eq(orderRequests.id, 'order-1'))

    await expect(confirmOrder(db, ncc, approvalInput)).rejects.toThrow(InvalidTransitionError)

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.shopifyDraftOrderId).toBe(firstDraft?.id)
  })

  it('rejects a sales rep — read-only everywhere, never a mutation', async () => {
    const db = await seed()
    await expect(confirmOrder(db, rep, approvalInput)).rejects.toThrow(ForbiddenError)
    await expect(cancelOrder(db, rep, { orderRequestId: 'order-1', reason: 'test' })).rejects.toThrow(ForbiddenError)
    await expect(retryShopifySync(db, rep, 'order-1')).rejects.toThrow(ForbiddenError)
  })

  it('a Shopify failure leaves the order validly confirmed with an explicit, recoverable sync-pending state — and retry recovers it', async () => {
    vi.resetModules()
    vi.doMock('../integrations/shopify', () => ({
      getAdminCommerceAdapter: () => ({
        createDraftOrder: vi.fn().mockRejectedValue(new Error('simulated Shopify outage')),
        sendDraftOrderInvoice: vi.fn(),
        approveReturn: vi.fn(),
      }),
    }))
    const { confirmOrder: confirmOrderWithFailingShopify } = await import('./ncc-approval')
    const db = await seed()

    await confirmOrderWithFailingShopify(db, ncc, approvalInput)

    const [afterFailure] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(afterFailure?.status).toBe('confirmed') // rule 13 already satisfied — never contingent on Shopify
    expect(afterFailure?.shopifyDraftOrderId).toBeNull()
    expect(afterFailure?.invoiceUrl).toBeNull()

    vi.doUnmock('../integrations/shopify')
    vi.resetModules()
    const { retryShopifySync: retryWithRealAdapter } = await import('./ncc-approval')
    await retryWithRealAdapter(db, ncc, 'order-1')

    const [afterRetry] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(afterRetry?.shopifyDraftOrderId).toEqual(expect.any(String))
    expect(afterRetry?.invoiceUrl).toEqual(expect.any(String))
  })

  it('cancels with a required reason and an audit record', async () => {
    const db = await seed()
    await cancelOrder(db, ncc, { orderRequestId: 'order-1', reason: 'Customer requested cancellation' })

    const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, 'order-1'))
    expect(order?.status).toBe('cancelled')
    expect(order?.cancelledReason).toBe('Customer requested cancellation')

    const [event] = await db.select().from(auditEvents).where(eq(auditEvents.action, 'ncc_cancel_order'))
    expect(event?.resourceId).toBe('order-1')
  })

  it('mints a fresh guest link on demand (the raw token is never stored, so it cannot be re-derived any other way)', async () => {
    const db = await seed()
    const url = await getGuestOrderLink(db, ncc, 'order-1')
    expect(url).toMatch(/^\/order\/order-1\?token=/)
  })

  it('still mints a link for a guest order with no contact email on file — the absence of an email never means "this is a company buyer"', async () => {
    const db = await seed()
    await db.update(orderRequests).set({ guestContactEmail: null }).where(eq(orderRequests.id, 'order-1'))
    const url = await getGuestOrderLink(db, ncc, 'order-1')
    expect(url).toMatch(/^\/order\/order-1\?token=/)
  })

  it('returns null for a company-buyer order — no guest link exists for those', async () => {
    const db = await seed()
    await db.insert(companies).values({ id: 'co-1', name: 'Acme' })
    await db.insert(buyerUsers).values({
      id: 'some-buyer',
      companyId: 'co-1',
      name: 'A Buyer',
      email: 'buyer@example.com',
      role: 'buyer',
      status: 'active',
    })
    await db.insert(orderRequests).values({ id: 'buyer-order', buyerUserId: 'some-buyer', status: 'awaiting_ncc_review' })
    expect(await getGuestOrderLink(db, ncc, 'buyer-order')).toBeNull()
  })

  it('denies a sales rep from minting a customer link', async () => {
    const db = await seed()
    await expect(getGuestOrderLink(db, rep, 'order-1')).rejects.toThrow(ForbiddenError)
  })

  it('throws for a nonexistent order', async () => {
    const db = await seed()
    await expect(confirmOrder(db, ncc, { ...approvalInput, orderRequestId: 'no-such-order' })).rejects.toThrow(
      OrderRequestNotFoundError,
    )
  })
})
