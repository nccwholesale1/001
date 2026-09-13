import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { auditEvents, baskets, buyerUsers, companies, guestTokens, orderRequestLines, orderRequests } from '../db/schema'
import { addLine, setBasketReferringSalesRep } from './basket'
import { BasketNotFoundError, EmptyBasketError, submitBasket } from './submit-order-request'

describe('submitBasket', () => {
  let cleanup: (() => void) | undefined
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  async function seedOpenBasketWithLine() {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    const basketId = 'basket_1'
    await db.insert(baskets).values({ id: basketId })
    await addLine(db, basketId, 'FIXTURE-CHG-001', 2)
    return { db, basketId }
  }

  it('creates an order request at awaiting_ncc_review with a server-resolved price — guests skip company approval (rule 6)', async () => {
    const { db, basketId } = await seedOpenBasketWithLine()

    const result = await submitBasket(db, basketId, { contactEmail: 'guest@example.com' })

    const [orderRequest] = await db
      .select()
      .from(orderRequests)
      .where(eq(orderRequests.id, result.orderRequestId))
    expect(orderRequest?.status).toBe('awaiting_ncc_review')
    expect(orderRequest?.guestContactEmail).toBe('guest@example.com')

    const lines = await db
      .select()
      .from(orderRequestLines)
      .where(eq(orderRequestLines.orderRequestId, result.orderRequestId))
    expect(lines).toHaveLength(1)
    expect(lines[0]?.unitPricePence).toBe(1299) // the real fixture price — never client input
    expect(lines[0]?.requestedQuantity).toBe(2)
    expect(lines[0]?.confirmedQuantity).toBeNull()
  })

  it('carries a self-reported referring sales rep id from the basket onto the order request', async () => {
    const { db, basketId } = await seedOpenBasketWithLine()
    await setBasketReferringSalesRep(db, basketId, 'EMP-042')

    const result = await submitBasket(db, basketId, {})

    const [orderRequest] = await db
      .select()
      .from(orderRequests)
      .where(eq(orderRequests.id, result.orderRequestId))
    expect(orderRequest?.referringSalesRepId).toBe('EMP-042')
  })

  it('marks the basket submitted and issues a guest token that is never stored raw', async () => {
    const { db, basketId } = await seedOpenBasketWithLine()

    const result = await submitBasket(db, basketId, {})
    if (result.kind !== 'guest') throw new Error('expected a guest submission result')

    const [basket] = await db.select().from(baskets).where(eq(baskets.id, basketId))
    expect(basket?.status).toBe('submitted')
    expect(basket?.orderRequestId).toBe(result.orderRequestId)

    const [tokenRow] = await db.select().from(guestTokens)
    expect(tokenRow?.tokenHash).not.toBe(result.token)
  })

  it('rejects submitting an empty basket', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()
    await db.insert(baskets).values({ id: 'empty-basket' })

    await expect(submitBasket(db, 'empty-basket', {})).rejects.toThrow(EmptyBasketError)
  })

  it('rejects a nonexistent basket id', async () => {
    const { db, client } = await createTestDb()
    cleanup = () => client.close()

    await expect(submitBasket(db, 'no-such-basket', {})).rejects.toThrow(BasketNotFoundError)
  })

  it('a duplicate submission (double-click / retry) replays the exact same result rather than creating a second order', async () => {
    const { db, basketId } = await seedOpenBasketWithLine()

    const first = await submitBasket(db, basketId, { contactEmail: 'guest@example.com' })
    const second = await submitBasket(db, basketId, { contactEmail: 'guest@example.com' })

    expect(second).toEqual(first)
    const allOrderRequests = await db.select().from(orderRequests)
    expect(allOrderRequests).toHaveLength(1)
  })

  describe('a signed-in buyer basket (buyerUserId set)', () => {
    async function seedBuyerBasketWithLine() {
      const { db, client } = await createTestDb()
      cleanup = () => client.close()
      await db.insert(companies).values({ id: 'co-a', name: 'Acme' })
      await db.insert(buyerUsers).values({
        id: 'buyer-1',
        companyId: 'co-a',
        name: 'Buyer One',
        email: 'buyer1@example.com',
        role: 'buyer',
        status: 'active',
      })
      const basketId = 'buyer-basket-1'
      await db.insert(baskets).values({ id: basketId, buyerUserId: 'buyer-1' })
      await addLine(db, basketId, 'FIXTURE-CHG-001', 4)
      return { db, basketId }
    }

    it('creates the order request at awaiting_company_approval — unlike a guest, it does not skip company approval (rule 6)', async () => {
      const { db, basketId } = await seedBuyerBasketWithLine()

      const result = await submitBasket(db, basketId, {})
      expect(result.kind).toBe('buyer')
      if (result.kind !== 'buyer') throw new Error('expected a buyer submission result')

      const [orderRequest] = await db.select().from(orderRequests).where(eq(orderRequests.id, result.orderRequestId))
      expect(orderRequest?.status).toBe('awaiting_company_approval')
      expect(orderRequest?.buyerUserId).toBe('buyer-1')
      expect(orderRequest?.guestContactEmail).toBeNull()

      // No guest token for a buyer order — they reach it via /account/orders, session-gated.
      const tokens = await db.select().from(guestTokens)
      expect(tokens).toHaveLength(0)

      const [event] = await db.select().from(auditEvents).where(eq(auditEvents.action, 'submit_order_request'))
      expect(event?.actorType).toBe('buyer')
    })

    it('also carries a self-reported referring sales rep id for a buyer basket', async () => {
      const { db, basketId } = await seedBuyerBasketWithLine()
      await setBasketReferringSalesRep(db, basketId, 'EMP-007')

      const result = await submitBasket(db, basketId, {})

      const [orderRequest] = await db.select().from(orderRequests).where(eq(orderRequests.id, result.orderRequestId))
      expect(orderRequest?.referringSalesRepId).toBe('EMP-007')
    })

    it('still resolves the line price from the live catalogue, never client input', async () => {
      const { db, basketId } = await seedBuyerBasketWithLine()
      const result = await submitBasket(db, basketId, {})
      if (result.kind !== 'buyer') throw new Error('expected a buyer submission result')

      const lines = await db
        .select()
        .from(orderRequestLines)
        .where(eq(orderRequestLines.orderRequestId, result.orderRequestId))
      expect(lines[0]?.unitPricePence).toBe(1299)
    })
  })
})
