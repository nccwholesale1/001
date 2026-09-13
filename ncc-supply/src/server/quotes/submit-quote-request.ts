import { randomUUID } from 'node:crypto'
import type { Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { quoteLines, quotes } from '../db/schema'
import { getCatalogueAdapter } from '../integrations/shopify'
import { issueGuestToken } from '../tokens/token-service'
import type { QuoteRequestInput } from '../validation/commands'

export class NoMatchingProductsError extends Error {
  readonly skus: string[]
  constructor(skus: string[]) {
    super(`These items are no longer available: ${skus.join(', ')}. Remove them and try again.`)
    this.name = 'NoMatchingProductsError'
    this.skus = skus
  }
}

export type SubmitQuoteResult =
  | { kind: 'guest'; quoteId: string; /** Only ever returned here — never persisted raw (CLAUDE.md rule 16). */ token: string }
  | { kind: 'buyer'; quoteId: string }

interface ResolvedQuoteLine {
  sku: string
  shopifyVariantId: string
  quantity: number
}

/**
 * A quote line has no price yet — that's NCC's job at issue time
 * (quote-pricing.ts) — so this only needs to confirm each requested SKU is a
 * real, current catalogue product (never trusting a client-supplied title or
 * variant id) and capture its variant GID. Uses the same batch lookup as
 * bulk order rather than a per-SKU loop — see the CatalogueAdapter interface
 * doc comment.
 */
async function resolveQuoteLinesOrThrow(
  lines: QuoteRequestInput['lines'],
): Promise<ResolvedQuoteLine[]> {
  const products = await getCatalogueAdapter().getProductsBySku(lines.map((line) => line.sku))
  const resolved: ResolvedQuoteLine[] = []
  const unknownSkus: string[] = []

  for (const line of lines) {
    const product = products.get(line.sku)
    if (!product) {
      unknownSkus.push(line.sku)
      continue
    }
    resolved.push({ sku: line.sku, shopifyVariantId: product.variantId, quantity: line.quantity })
  }

  if (unknownSkus.length > 0) throw new NoMatchingProductsError(unknownSkus)
  return resolved
}

async function insertQuoteLines(db: Db, quoteId: string, lines: ResolvedQuoteLine[]): Promise<void> {
  await db.insert(quoteLines).values(
    lines.map((line) => ({
      id: randomUUID(),
      quoteId,
      sku: line.sku,
      shopifyVariantId: line.shopifyVariantId,
      requestedQuantity: line.quantity,
    })),
  )
}

/**
 * PRD §6.8's guest path: a private status link is minted the same way a
 * guest order gets one — no company/NCC approval step exists to skip here,
 * since a quote is just a request for pricing, not a commitment.
 */
async function submitGuestQuoteRequest(
  db: Db,
  input: QuoteRequestInput,
): Promise<SubmitQuoteResult> {
  const resolvedLines = await resolveQuoteLinesOrThrow(input.lines)

  const quoteId = randomUUID()
  await db.insert(quotes).values({
    id: quoteId,
    status: 'requested',
    guestContactEmail: input.contactEmail ?? null,
    guestContactName: input.contactName ?? null,
    referringSalesRepId: input.referringSalesRepId ?? null,
  })
  await insertQuoteLines(db, quoteId, resolvedLines)

  const { token } = await issueGuestToken(db, 'quote', quoteId)

  await recordAuditEvent(db, {
    actorType: 'guest',
    actorId: null,
    action: 'submit_quote_request',
    resourceType: 'quote',
    resourceId: quoteId,
    detail: { lineCount: resolvedLines.length },
  })

  return { kind: 'guest', quoteId, token }
}

/** A signed-in buyer's own quote appears under their account — no guest token needed, mirroring the order-request buyer path. */
async function submitBuyerQuoteRequest(
  db: Db,
  buyerUserId: string,
  input: QuoteRequestInput,
): Promise<SubmitQuoteResult> {
  const resolvedLines = await resolveQuoteLinesOrThrow(input.lines)

  const quoteId = randomUUID()
  await db.insert(quotes).values({
    id: quoteId,
    status: 'requested',
    buyerUserId,
    referringSalesRepId: input.referringSalesRepId ?? null,
  })
  await insertQuoteLines(db, quoteId, resolvedLines)

  await recordAuditEvent(db, {
    actorType: 'buyer',
    actorId: buyerUserId,
    action: 'submit_quote_request',
    resourceType: 'quote',
    resourceId: quoteId,
    detail: { lineCount: resolvedLines.length },
  })

  return { kind: 'buyer', quoteId }
}

export async function submitQuoteRequest(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }> | null,
  input: QuoteRequestInput,
): Promise<SubmitQuoteResult> {
  return actor
    ? submitBuyerQuoteRequest(db, actor.buyerUserId, input)
    : submitGuestQuoteRequest(db, input)
}
