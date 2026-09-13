import { eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, isCompanyAdmin, ForbiddenError, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, quoteLines, quotes, type QuoteStatus } from '../db/schema'
import { transitionQuote } from '../domain/status'
import { getCatalogueAdapter } from '../integrations/shopify'

export interface QuoteLineView {
  id: string
  sku: string
  title: string
  requestedQuantity: number
  quotedUnitPricePence: number | null
}

export interface QuoteView {
  id: string
  status: QuoteStatus
  buyerUserId: string | null
  guestContactEmail: string | null
  guestContactName: string | null
  expiresAt: string | null
  convertedOrderRequestId: string | null
  lines: QuoteLineView[]
}

/**
 * PRD §6.8's `requested → quoted → accepted/expired` expiry has no cron job
 * behind it (no background-job infrastructure exists anywhere else in this
 * codebase) — it's checked lazily, right here, wherever a quote's current
 * status actually matters. A `quoted` row past its `expiresAt` is
 * transitioned to `expired` the moment it's observed, via the same
 * `transitionQuote` every other quote-status change goes through.
 */
export async function applyLazyExpiry(
  db: Db,
  quote: { id: string; status: QuoteStatus; expiresAt: string | null },
): Promise<QuoteStatus> {
  if (quote.status !== 'quoted' || !quote.expiresAt) return quote.status
  if (new Date(quote.expiresAt).getTime() > Date.now()) return quote.status

  const nextStatus = transitionQuote(quote.status, { type: 'expire' })
  await db.update(quotes).set({ status: nextStatus }).where(eq(quotes.id, quote.id))
  return nextStatus
}

/**
 * Pure DB-fetch for one quote's detail — shared by the guest token-gated
 * route and the buyer/staff session-gated ones, mirroring
 * `orders/order-view.ts::buildOrderRequestView` exactly. Authorization is
 * each caller's job; this function trusts whatever id it's given.
 */
export async function buildQuoteView(db: Db, quoteId: string): Promise<QuoteView | null> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1)
  if (!quote) return null

  const status = await applyLazyExpiry(db, quote)

  const rows = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id))
  const adapter = getCatalogueAdapter()
  const lines = await Promise.all(
    rows.map(async (row) => {
      const product = await adapter.getProduct(row.sku)
      return {
        id: row.id,
        sku: row.sku,
        title: product?.title ?? row.sku,
        requestedQuantity: row.requestedQuantity,
        quotedUnitPricePence: row.quotedUnitPricePence,
      }
    }),
  )

  return {
    id: quote.id,
    status,
    buyerUserId: quote.buyerUserId,
    guestContactEmail: quote.guestContactEmail,
    guestContactName: quote.guestContactName,
    expiresAt: quote.expiresAt,
    convertedOrderRequestId: quote.convertedOrderRequestId,
    lines,
  }
}

async function companyIdForQuote(db: Db, buyerUserId: string | null): Promise<string | null> {
  if (!buyerUserId) return null
  const [buyer] = await db
    .select({ companyId: buyerUsers.companyId })
    .from(buyerUsers)
    .where(eq(buyerUsers.id, buyerUserId))
    .limit(1)
  return buyer?.companyId ?? null
}

/** Session-gated equivalent of the guest token check — mirrors `getOrderRequestViewForActor`. */
export async function getQuoteViewForActor(db: Db, actor: Actor, quoteId: string): Promise<QuoteView | null> {
  const [quote] = await db
    .select({ id: quotes.id, buyerUserId: quotes.buyerUserId })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1)
  if (!quote) return null

  const companyId = await companyIdForQuote(db, quote.buyerUserId)
  if (!canViewCompanyResource(actor, { companyId, ownerBuyerUserId: quote.buyerUserId })) {
    throw new ForbiddenError()
  }

  return buildQuoteView(db, quoteId)
}

export interface QuoteSummary {
  id: string
  status: QuoteStatus
  createdAt: string
  buyerName: string | null
  lineCount: number
  /** Null until every line has been priced. */
  subtotalPence: number | null
}

/** PRD §6.11-equivalent for quotes: a plain buyer sees only their own; a company admin sees every quote under the company. */
export async function listQuotesForActor(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }>,
): Promise<QuoteSummary[]> {
  const buyerIds = isCompanyAdmin(actor)
    ? (
        await db
          .select({ id: buyerUsers.id })
          .from(buyerUsers)
          .where(eq(buyerUsers.companyId, actor.companyId))
      ).map((row) => row.id)
    : [actor.buyerUserId]

  if (buyerIds.length === 0) return []

  const rows = await db.select().from(quotes).where(inArray(quotes.buyerUserId, buyerIds))

  const buyersList = await db
    .select({ id: buyerUsers.id, name: buyerUsers.name })
    .from(buyerUsers)
    .where(inArray(buyerUsers.id, buyerIds))
  const buyerNameById = new Map(buyersList.map((buyer) => [buyer.id, buyer.name]))

  const summaries: QuoteSummary[] = []
  for (const quote of rows) {
    const status = await applyLazyExpiry(db, quote)
    const lines = await db
      .select({ requestedQuantity: quoteLines.requestedQuantity, quotedUnitPricePence: quoteLines.quotedUnitPricePence })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quote.id))
    const allPriced = lines.length > 0 && lines.every((line) => line.quotedUnitPricePence !== null)

    summaries.push({
      id: quote.id,
      status,
      createdAt: quote.createdAt,
      buyerName: quote.buyerUserId ? (buyerNameById.get(quote.buyerUserId) ?? null) : null,
      lineCount: lines.length,
      subtotalPence: allPriced
        ? lines.reduce((sum, line) => sum + (line.quotedUnitPricePence ?? 0) * line.requestedQuantity, 0)
        : null,
    })
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
