import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCurrentActor, requireActor } from '../buyers/buyer-session'
import { db } from '../db/client'
import { quoteRequestSchema } from '../validation/commands'
import { getQuoteViewForActor, listQuotesForActor, type QuoteSummary, type QuoteView } from './quote-view'
import { submitQuoteRequest, type SubmitQuoteResult } from './submit-quote-request'

/** Works for both a guest (no session) and a signed-in buyer — `getCurrentActor` returns null rather than throwing. */
export const submitQuote = createServerFn({ method: 'POST' })
  .validator(quoteRequestSchema.parse)
  .handler(async ({ data }): Promise<SubmitQuoteResult> => {
    const actor = await getCurrentActor(db)
    return submitQuoteRequest(db, actor, data)
  })

export const listMyQuotes = createServerFn({ method: 'GET' }).handler(
  async (): Promise<QuoteSummary[]> => {
    const actor = await requireActor(db)
    return listQuotesForActor(db, actor)
  },
)

const quoteIdSchema = z.object({ quoteId: z.string().min(1) })

export const getMyQuoteDetail = createServerFn({ method: 'GET' })
  .validator(quoteIdSchema.parse)
  .handler(async ({ data }): Promise<QuoteView | null> => {
    const actor = await requireActor(db)
    return getQuoteViewForActor(db, actor, data.quoteId)
  })
