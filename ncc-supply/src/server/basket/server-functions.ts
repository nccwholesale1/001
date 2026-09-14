import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/client'
import { checkRateLimitByIp } from '../shared/rate-limit'
import {
  addBasketLineSchema,
  removeBasketLineSchema,
  setBasketReferringSalesRepSchema,
  submitBasketSchema,
  updateBasketLineQuantitySchema,
} from '../validation/commands'
import {
  addLine,
  getBasketItemCount,
  getBasketView,
  removeLine,
  setBasketReferringSalesRep,
  updateLineQuantity,
  type BasketView,
} from './basket'
import { getOrCreateBasketId } from './session'
import { submitBasket, type SubmitBasketResult } from './submit-order-request'

/**
 * Every mutation resolves the basket id from the guest's own session
 * cookie (`getOrCreateBasketId`) — never from client input — before doing
 * anything else, so there is no way for a request to name a different
 * guest's basket (CLAUDE.md rule 17's least-privilege spirit applied to an
 * unauthenticated actor).
 */

export const getBasket = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BasketView> => {
    const basketId = await getOrCreateBasketId(db)
    const view = await getBasketView(db, basketId)
    if (!view) throw new Error('Basket unexpectedly missing immediately after creation')
    return view
  },
)

/** Header badge — deliberately cheap (no catalogue lookups) since this loads on every page. */
export const getBasketCount = createServerFn({ method: 'GET' }).handler(async (): Promise<number> => {
  const basketId = await getOrCreateBasketId(db)
  return getBasketItemCount(db, basketId)
})

export const addBasketLine = createServerFn({ method: 'POST' })
  .validator(addBasketLineSchema.parse)
  .handler(async ({ data }): Promise<BasketView> => {
    const basketId = await getOrCreateBasketId(db)
    await addLine(db, basketId, data.sku, data.quantity)
    const view = await getBasketView(db, basketId)
    if (!view) throw new Error('Basket unexpectedly missing immediately after adding a line')
    return view
  })

export const updateBasketLine = createServerFn({ method: 'POST' })
  .validator(updateBasketLineQuantitySchema.parse)
  .handler(async ({ data }): Promise<BasketView> => {
    const basketId = await getOrCreateBasketId(db)
    await updateLineQuantity(db, basketId, data.lineId, data.quantity)
    const view = await getBasketView(db, basketId)
    if (!view) throw new Error('Basket unexpectedly missing immediately after updating a line')
    return view
  })

export const removeBasketLine = createServerFn({ method: 'POST' })
  .validator(removeBasketLineSchema.parse)
  .handler(async ({ data }): Promise<BasketView> => {
    const basketId = await getOrCreateBasketId(db)
    await removeLine(db, basketId, data.lineId)
    const view = await getBasketView(db, basketId)
    if (!view) throw new Error('Basket unexpectedly missing immediately after removing a line')
    return view
  })

export const setReferringSalesRep = createServerFn({ method: 'POST' })
  .validator(setBasketReferringSalesRepSchema.parse)
  .handler(async ({ data }): Promise<void> => {
    const basketId = await getOrCreateBasketId(db)
    await setBasketReferringSalesRep(db, basketId, data.referringSalesRepId)
  })

export const submitCurrentBasket = createServerFn({ method: 'POST' })
  .validator(submitBasketSchema.parse)
  .handler(async ({ data }): Promise<SubmitBasketResult> => {
    checkRateLimitByIp('submit-order', { limit: 20, windowMs: 60 * 60 * 1000 })
    const basketId = await getOrCreateBasketId(db)
    return submitBasket(db, basketId, data)
  })
