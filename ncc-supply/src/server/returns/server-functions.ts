import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCurrentActor, requireActor } from '../buyers/buyer-session'
import { db } from '../db/client'
import { checkRateLimitByIp } from '../shared/rate-limit'
import { returnRequestSchema } from '../validation/commands'
import { getReturnViewForActor, listReturnsForActor, type ReturnSummary, type ReturnView } from './return-view'
import { submitReturnRequest, type SubmitReturnResult } from './submit-return-request'

/**
 * Works for both a guest (no session, proves ownership via `orderToken`
 * inside the payload — verified in `submitReturnRequest`) and a signed-in
 * buyer (proves ownership via their own session instead). Safe to expose
 * with no auth gate on the function itself, unlike a mutation against an
 * *existing* return/ticket id, since the caller can't get anywhere without
 * already proving they can see the referenced order.
 */
export const submitReturn = createServerFn({ method: 'POST' })
  .validator(returnRequestSchema.parse)
  .handler(async ({ data }): Promise<SubmitReturnResult> => {
    checkRateLimitByIp('submit-return', { limit: 20, windowMs: 60 * 60 * 1000 })
    const actor = await getCurrentActor(db)
    return submitReturnRequest(db, actor, data)
  })

export const listMyReturns = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ReturnSummary[]> => {
    const actor = await requireActor(db)
    return listReturnsForActor(db, actor)
  },
)

const returnIdSchema = z.object({ returnId: z.string().min(1) })

export const getMyReturnDetail = createServerFn({ method: 'GET' })
  .validator(returnIdSchema.parse)
  .handler(async ({ data }): Promise<ReturnView | null> => {
    const actor = await requireActor(db)
    return getReturnViewForActor(db, actor, data.returnId)
  })
