import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestDb } from '../db/test-helpers'
import { baskets, guestTokens, orderRequestLines, orderRequests } from '../db/schema'
import { addLine } from './basket'
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

  it('marks the basket submitted and issues a guest token that is never stored raw', async () => {
    const { db, basketId } = await seedOpenBasketWithLine()

    const result = await submitBasket(db, basketId, {})

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
})
