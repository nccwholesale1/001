import { eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, quoteLines, quotes } from '../db/schema'
import { applyLazyExpiry, type QuoteSummary } from './quote-view'

/**
 * The `/staff/quotes` queue (PRD §6.14): an NCC admin sees every quote,
 * guest and company alike; a sales rep sees only quotes whose company is on
 * their own assigned book, read-only, and never sees a guest quote at all —
 * exactly mirroring `orders/staff-queue.ts::listOrderRequestsForStaff`,
 * reusing the same `canViewCompanyResource` rather than a re-derived rule.
 */
export async function listQuotesForStaff(
  db: Db,
  actor: Extract<Actor, { kind: 'sales_rep' | 'ncc_admin' }>,
): Promise<QuoteSummary[]> {
  const rows = await db.select().from(quotes)

  const buyerIds = rows.map((quote) => quote.buyerUserId).filter((id): id is string => id !== null)
  const buyers =
    buyerIds.length > 0
      ? await db
          .select({ id: buyerUsers.id, name: buyerUsers.name, companyId: buyerUsers.companyId })
          .from(buyerUsers)
          .where(inArray(buyerUsers.id, buyerIds))
      : []
  const buyerById = new Map(buyers.map((buyer) => [buyer.id, buyer]))

  const visible = rows.filter((quote) => {
    const buyer = quote.buyerUserId ? buyerById.get(quote.buyerUserId) : undefined
    const companyId = buyer?.companyId ?? null
    return canViewCompanyResource(actor, { companyId, ownerBuyerUserId: quote.buyerUserId })
  })

  const summaries: QuoteSummary[] = []
  for (const quote of visible) {
    const status = await applyLazyExpiry(db, quote)
    const lines = await db
      .select({ requestedQuantity: quoteLines.requestedQuantity, quotedUnitPricePence: quoteLines.quotedUnitPricePence })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quote.id))
    const allPriced = lines.length > 0 && lines.every((line) => line.quotedUnitPricePence !== null)
    const buyer = quote.buyerUserId ? buyerById.get(quote.buyerUserId) : undefined

    summaries.push({
      id: quote.id,
      status,
      createdAt: quote.createdAt,
      buyerName: buyer?.name ?? null,
      lineCount: lines.length,
      subtotalPence: allPriced
        ? lines.reduce((sum, line) => sum + (line.quotedUnitPricePence ?? 0) * line.requestedQuantity, 0)
        : null,
    })
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
