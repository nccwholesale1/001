import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { ForbiddenError, isNccAdmin, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { orderRequestLines, orderRequests, quoteLines, quotes } from '../db/schema'
import { transitionQuote } from '../domain/status'
import { issueGuestToken } from '../tokens/token-service'
import type { IssueQuoteInput } from '../validation/commands'
import { applyLazyExpiry } from './quote-view'

export class QuoteNotFoundError extends Error {
  constructor() {
    super('Quote not found')
    this.name = 'QuoteNotFoundError'
  }
}

export class QuoteLineMismatchError extends Error {
  constructor() {
    super('The priced lines do not match this quote')
    this.name = 'QuoteLineMismatchError'
  }
}

/** PRD §6.8 doesn't specify a duration — 30 days matches this project's other guest-link/session TTL defaults. Staff can override per-quote via `expiresInDays`. */
const DEFAULT_QUOTE_EXPIRY_DAYS = 30

/**
 * PRD §6.14: pricing a quote is NCC-admin-only, mirroring
 * `orders/ncc-approval.ts::confirmOrder`'s gate — a sales rep's quote view
 * stays read-only. One atomic transaction prices every line and moves the
 * quote to `quoted` together, same "all or nothing" reasoning as order
 * confirmation.
 */
export async function issueQuote(db: Db, actor: Actor, input: IssueQuoteInput): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, input.quoteId)).limit(1)
  if (!quote) throw new QuoteNotFoundError()

  const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quote.id))
  const lineById = new Map(lines.map((line) => [line.id, line]))
  if (input.lines.length !== lines.length) throw new QuoteLineMismatchError()
  for (const priced of input.lines) {
    if (!lineById.has(priced.quoteLineId)) throw new QuoteLineMismatchError()
  }

  const nextStatus = transitionQuote(quote.status, { type: 'issue' })
  const expiryDays = input.expiresInDays ?? DEFAULT_QUOTE_EXPIRY_DAYS
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()

  await db.transaction(async (tx) => {
    for (const priced of input.lines) {
      await tx
        .update(quoteLines)
        .set({ quotedUnitPricePence: priced.quotedUnitPricePence })
        .where(eq(quoteLines.id, priced.quoteLineId))
    }
    await tx
      .update(quotes)
      .set({ status: nextStatus, expiresAt, issuedByStaffUserId: actor.staffUserId })
      .where(eq(quotes.id, quote.id))
  })

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: 'issue_quote',
    resourceType: 'quote',
    resourceId: quote.id,
    detail: { lineCount: input.lines.length, expiresAt },
  })
}

/**
 * PRD §6.8: "Accept quote" converts it into an order re-entering the
 * standard review/approval step — never skipping it. Authorization here is
 * identical to viewing the quote (decision 8): whoever the caller already
 * confirmed can *see* this quote (guest token or `getQuoteViewForActor`) is
 * allowed to accept it, so this function itself takes no actor and trusts
 * the id it's given, same as `buildQuoteView`. `transitionQuote` alone
 * already rejects every invalid case for free — not yet quoted, already
 * accepted, or expired all throw `InvalidTransitionError` before any write
 * happens. For a guest quote, also mints a guest token for the *new* order
 * request — `acceptQuote` creates it directly rather than going through
 * `submitGuestBasket`, so without this the guest would have no way to check
 * their new order's status afterward (rule 16).
 */
export async function acceptQuote(
  db: Db,
  quoteId: string,
): Promise<{ orderRequestId: string; token?: string }> {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1)
  if (!quote) throw new QuoteNotFoundError()

  const effectiveStatus = await applyLazyExpiry(db, quote)
  const nextStatus = transitionQuote(effectiveStatus, { type: 'accept' })

  const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId))
  if (lines.length === 0 || lines.some((line) => line.quotedUnitPricePence === null)) {
    throw new Error('Quote is missing pricing on one or more lines')
  }

  const orderRequestId = randomUUID()
  const orderStatus = quote.buyerUserId ? 'awaiting_company_approval' : 'awaiting_ncc_review'

  await db.transaction(async (tx) => {
    await tx.insert(orderRequests).values({
      id: orderRequestId,
      status: orderStatus,
      buyerUserId: quote.buyerUserId,
      guestContactEmail: quote.guestContactEmail,
      guestContactName: quote.guestContactName,
    })
    await tx.insert(orderRequestLines).values(
      lines.map((line) => ({
        id: randomUUID(),
        orderRequestId,
        sku: line.sku,
        shopifyVariantId: line.shopifyVariantId,
        requestedQuantity: line.requestedQuantity,
        unitPricePence: line.quotedUnitPricePence as number,
      })),
    )
    await tx
      .update(quotes)
      .set({ status: nextStatus, convertedOrderRequestId: orderRequestId })
      .where(eq(quotes.id, quoteId))
  })

  await recordAuditEvent(db, {
    actorType: quote.buyerUserId ? 'buyer' : 'guest',
    actorId: quote.buyerUserId,
    action: 'accept_quote',
    resourceType: 'quote',
    resourceId: quoteId,
    detail: { orderRequestId },
  })

  if (quote.buyerUserId) return { orderRequestId }
  const { token } = await issueGuestToken(db, 'order_request', orderRequestId)
  return { orderRequestId, token }
}

/**
 * PRD §6.14 copy-to-clipboard link, mirroring
 * `orders/ncc-approval.ts::getGuestOrderLink` exactly — a fresh token minted
 * on demand since the raw token is never stored (rule 16), guest quotes
 * only (a buyer's quote has no token-based link at all).
 */
export async function getGuestQuoteLink(db: Db, actor: Actor, quoteId: string): Promise<string | null> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [quote] = await db
    .select({ buyerUserId: quotes.buyerUserId })
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1)
  if (!quote) throw new QuoteNotFoundError()
  if (quote.buyerUserId) return null

  const { token } = await issueGuestToken(db, 'quote', quoteId)
  return `/quote/${quoteId}?token=${encodeURIComponent(token)}`
}
