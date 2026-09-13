import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireStaffActor } from '../staff/staff-session'
import { db } from '../db/client'
import { issueQuoteSchema } from '../validation/commands'
import { getGuestQuoteLink, issueQuote } from './quote-pricing'
import { listQuotesForStaff } from './staff-quote-queue'
import { getQuoteViewForActor, type QuoteSummary, type QuoteView } from './quote-view'

export const listStaffQuotes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<QuoteSummary[]> => {
    const actor = await requireStaffActor(db)
    return listQuotesForStaff(db, actor)
  },
)

const quoteIdSchema = z.object({ quoteId: z.string().min(1) })

export const getStaffQuoteDetail = createServerFn({ method: 'GET' })
  .validator(quoteIdSchema.parse)
  .handler(async ({ data }): Promise<QuoteView | null> => {
    const actor = await requireStaffActor(db)
    return getQuoteViewForActor(db, actor, data.quoteId)
  })

export const issueStaffQuote = createServerFn({ method: 'POST' })
  .validator(issueQuoteSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await issueQuote(db, actor, data)
  })

export const getQuoteCustomerLink = createServerFn({ method: 'POST' })
  .validator(quoteIdSchema.parse)
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const actor = await requireStaffActor(db)
    const url = await getGuestQuoteLink(db, actor, data.quoteId)
    return { url }
  })
