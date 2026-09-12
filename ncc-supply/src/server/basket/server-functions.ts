import { createServerFn } from '@tanstack/react-start'
import { db } from '../db/client'
import {
  addBasketLineSchema,
  removeBasketLineSchema,
  submitBasketSchema,
  updateBasketLineQuantitySchema,
} from '../validation/commands'
import { addLine, getBasketView, removeLine, updateLineQuantity, type BasketView } from './basket'
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

export const submitCurrentBasket = createServerFn({ method: 'POST' })
  .validator(submitBasketSchema.parse)
  .handler(async ({ data }): Promise<SubmitBasketResult> => {
    const basketId = await getOrCreateBasketId(db)
    return submitBasket(db, basketId, data)
  })
