import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireStaffActor } from '../staff/staff-session'
import { db } from '../db/client'
import { decideReturnSchema, markReturnOutcomeSchema } from '../validation/commands'
import { getReturnViewForActor, type ReturnSummary, type ReturnView } from './return-view'
import { listReturnsForStaff } from './staff-return-queue'
import { beginReturnReview, decideReturn, getGuestReturnLink, markReturnOutcome } from './return-processing'

export const listStaffReturns = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ReturnSummary[]> => {
    const actor = await requireStaffActor(db)
    return listReturnsForStaff(db, actor)
  },
)

const returnIdSchema = z.object({ returnId: z.string().min(1) })

export const getStaffReturnDetail = createServerFn({ method: 'GET' })
  .validator(returnIdSchema.parse)
  .handler(async ({ data }): Promise<ReturnView | null> => {
    const actor = await requireStaffActor(db)
    return getReturnViewForActor(db, actor, data.returnId)
  })

export const beginStaffReturnReview = createServerFn({ method: 'POST' })
  .validator(returnIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await beginReturnReview(db, actor, data.returnId)
  })

export const decideStaffReturn = createServerFn({ method: 'POST' })
  .validator(decideReturnSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await decideReturn(db, actor, data)
  })

export const markStaffReturnOutcome = createServerFn({ method: 'POST' })
  .validator(markReturnOutcomeSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await markReturnOutcome(db, actor, data)
  })

export const getReturnCustomerLink = createServerFn({ method: 'POST' })
  .validator(returnIdSchema.parse)
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const actor = await requireStaffActor(db)
    const url = await getGuestReturnLink(db, actor, data.returnId)
    return { url }
  })
