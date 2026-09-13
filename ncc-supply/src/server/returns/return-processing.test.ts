import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { InvalidTransitionError } from '../domain/status'
import { createTestDb } from '../db/test-helpers'
import { orderRequestLines, orderRequests, returnLines, returns, staffUsers } from '../db/schema'
import { beginReturnReview, decideReturn, getGuestReturnLink, markReturnOutcome, ReturnNotFoundError } from './return-processing'

const ncc: Actor = { kind: 'ncc_admin', staffUserId: 'admin-1' }
const rep: Actor = { kind: 'sales_rep', staffUserId: 'rep-1', assignedCompanyIds: [] }

async function seedReturn(db: Awaited<ReturnType<typeof createTestDb>>['db'], status: 'requested' | 'under_review' | 'approved' = 'requested') {
  await db.insert(staffUsers).values({
    id: 'admin-1',
    name: 'Admin One',
    email: 'admin@example.com',
    username: 'admin.one',
    passwordHash: 'x',
    role: 'ncc_admin',
    status: 'active',
  })
  await db.insert(orderRequests).values({ id: 'order-1', status: 'confirmed', guestContactEmail: 'guest@example.com' })
  await db.insert(orderRequestLines).values({
    id: 'order-line-1',
    orderRequestId: 'order-1',
    sku: 'FIXTURE-CHG-001',
    shopifyVariantId: 'gid://shopify/ProductVariant/fixture-1',
    requestedQuantity: 5,
    confirmedQuantity: 5,
    unitPricePence: 1000,
  })
  await db.insert(returns).values({ id: 'return-1', orderRequestId: 'order-1', status, reason: 'damaged', resolution: status === 'approved' ? 'refund' : null })
  await db.insert(returnLines).values({ id: 'rline-1', returnId: 'return-1', orderRequestLineId: 'order-line-1', quantity: 1 })
}

describe('return-processing', () => {
  afterEach(() => {
    vi.doUnmock('../integrations/shopify')
    vi.resetModules()
  })

  it('begins review, moving requested -> under_review', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'requested')
      await beginReturnReview(db, ncc, 'return-1')
      const [ret] = await db.select({ status: returns.status }).from(returns).where(eq(returns.id, 'return-1'))
      expect(ret?.status).toBe('under_review')
    } finally {
      client.close()
    }
  })

  it('rejects approve/reject before review has begun (invalid transition)', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'requested')
      await expect(
        decideReturn(db, ncc, { returnId: 'return-1', decision: 'approve', resolution: 'refund' }),
      ).rejects.toThrow(InvalidTransitionError)
    } finally {
      client.close()
    }
  })

  it('requires a resolution to approve', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'under_review')
      await expect(decideReturn(db, ncc, { returnId: 'return-1', decision: 'approve' })).rejects.toThrow(/resolution/i)
    } finally {
      client.close()
    }
  })

  it('requires a rejection reason to reject', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'under_review')
      await expect(decideReturn(db, ncc, { returnId: 'return-1', decision: 'reject' })).rejects.toThrow(/reason/i)
    } finally {
      client.close()
    }
  })

  it('a sales rep is denied every mutation — read-only everywhere', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'requested')
      await expect(beginReturnReview(db, rep, 'return-1')).rejects.toThrow(ForbiddenError)
      await expect(decideReturn(db, rep, { returnId: 'return-1', decision: 'approve', resolution: 'refund' })).rejects.toThrow(ForbiddenError)
      await expect(markReturnOutcome(db, rep, { returnId: 'return-1', outcome: 'refunded' })).rejects.toThrow(ForbiddenError)
      await expect(getGuestReturnLink(db, rep, 'return-1')).rejects.toThrow(ForbiddenError)
    } finally {
      client.close()
    }
  })

  it('approving is authoritative in the app even when the best-effort Shopify sync fails', async () => {
    vi.resetModules()
    vi.doMock('../integrations/shopify', () => ({
      getAdminCommerceAdapter: () => ({
        createDraftOrder: vi.fn(),
        sendDraftOrderInvoice: vi.fn(),
        approveReturn: vi.fn().mockRejectedValue(new Error('simulated: no matching Shopify return object')),
      }),
    }))
    const { decideReturn: decideWithFailingShopify } = await import('./return-processing')
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'under_review')
      await decideWithFailingShopify(db, ncc, { returnId: 'return-1', decision: 'approve', resolution: 'refund' })

      const [ret] = await db.select().from(returns).where(eq(returns.id, 'return-1'))
      expect(ret?.status).toBe('approved') // never thrown back, never left un-approved
      expect(ret?.resolution).toBe('refund')
    } finally {
      client.close()
    }
  })

  it('marks a refund outcome only after approval, and rejects it before that', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'requested')
      await expect(markReturnOutcome(db, ncc, { returnId: 'return-1', outcome: 'refunded' })).rejects.toThrow(InvalidTransitionError)

      await db.update(returns).set({ status: 'approved', resolution: 'refund' }).where(eq(returns.id, 'return-1'))
      await markReturnOutcome(db, ncc, { returnId: 'return-1', outcome: 'refunded' })
      const [ret] = await db.select({ status: returns.status }).from(returns).where(eq(returns.id, 'return-1'))
      expect(ret?.status).toBe('refunded')
    } finally {
      client.close()
    }
  })

  it('mints a guest link only for a guest return, and throws for a nonexistent one', async () => {
    const { db, client } = await createTestDb()
    try {
      await seedReturn(db, 'requested')
      const url = await getGuestReturnLink(db, ncc, 'return-1')
      expect(url).toMatch(/^\/returns\/return-1\?token=/)
      await expect(getGuestReturnLink(db, ncc, 'no-such-return')).rejects.toThrow(ReturnNotFoundError)
    } finally {
      client.close()
    }
  })
})
