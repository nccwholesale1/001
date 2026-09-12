import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { basketLines, baskets, orderRequestLines, orderRequests } from '../db/schema'
import { withIdempotency } from '../idempotency/idempotency'
import { getCatalogueAdapter } from '../integrations/shopify'
import { issueGuestToken } from '../tokens/token-service'
import type { SubmitBasketInput } from '../validation/commands'

export class BasketNotFoundError extends Error {
  constructor() {
    super('Basket not found')
    this.name = 'BasketNotFoundError'
  }
}

export class EmptyBasketError extends Error {
  constructor() {
    super('Cannot submit an empty basket')
    this.name = 'EmptyBasketError'
  }
}

export class UnavailableLinesError extends Error {
  readonly skus: string[]
  constructor(skus: string[]) {
    super(`These items are no longer available: ${skus.join(', ')}. Remove them and try again.`)
    this.name = 'UnavailableLinesError'
    this.skus = skus
  }
}

export type SubmitBasketResult =
  | { kind: 'guest'; orderRequestId: string; /** Only ever returned here — never persisted raw (CLAUDE.md rule 16). */ token: string }
  | { kind: 'buyer'; orderRequestId: string }

interface ResolvedLine {
  sku: string
  shopifyVariantId: string
  quantity: number
  unitPricePence: number
}

/**
 * Re-resolves every line's price from the live catalogue at this exact
 * moment (CLAUDE.md rule 9) — shared by both the guest and buyer submission
 * paths below, since "never trust a stored/client price" applies equally
 * to either.
 */
async function resolveLinesOrThrow(
  db: Db,
  basketId: string,
): Promise<ResolvedLine[]> {
  const lines = await db.select().from(basketLines).where(eq(basketLines.basketId, basketId))
  if (lines.length === 0) throw new EmptyBasketError()

  const adapter = getCatalogueAdapter()
  const resolvedLines: ResolvedLine[] = []
  const unavailableSkus: string[] = []

  for (const line of lines) {
    const product = await adapter.getProduct(line.sku)
    if (!product) {
      unavailableSkus.push(line.sku)
      continue
    }
    resolvedLines.push({
      sku: line.sku,
      shopifyVariantId: product.variantId,
      quantity: line.quantity,
      unitPricePence: product.price.amountPence,
    })
  }

  if (unavailableSkus.length > 0) throw new UnavailableLinesError(unavailableSkus)
  return resolvedLines
}

async function insertOrderRequestLines(
  db: Db,
  orderRequestId: string,
  resolvedLines: ResolvedLine[],
): Promise<void> {
  await db.insert(orderRequestLines).values(
    resolvedLines.map((line) => ({
      id: randomUUID(),
      orderRequestId,
      sku: line.sku,
      shopifyVariantId: line.shopifyVariantId,
      requestedQuantity: line.quantity,
      unitPricePence: line.unitPricePence,
    })),
  )
}

/**
 * The guest order-submission path (PRD §§4, 6.5, 6.7; CLAUDE.md rules 1, 6,
 * 9, 13). No payment, no Shopify order — this creates only an app-owned
 * order request at `awaiting_ncc_review`, since a guest skips the
 * company-approval step entirely (rule 6; a signed-in buyer's path below
 * does go through it). Every price is re-resolved from the live catalogue
 * at this exact moment — there is no price field anywhere in
 * `SubmitBasketInput` for a client to even attempt to supply one.
 *
 * Deliberately no separate "already submitted" guard: `withIdempotency` is
 * checked before any of the mutation logic below runs, keyed on the
 * basket's own id, so resubmitting an already-submitted basket — whether a
 * near-simultaneous double-click or a client retrying well after the fact —
 * always replays the original `{ orderRequestId, token }` rather than
 * erroring or creating a second order request. Basket lines are never
 * deleted on submission (only `status` changes), so the empty-basket check
 * still reflects reality even for a basket that was submitted long ago.
 */
async function submitGuestBasket(
  db: Db,
  basketId: string,
  input: SubmitBasketInput,
): Promise<SubmitBasketResult> {
  return withIdempotency(db, 'submit_basket', basketId, async () => {
    const resolvedLines = await resolveLinesOrThrow(db, basketId)

    const orderRequestId = randomUUID()
    await db.insert(orderRequests).values({
      id: orderRequestId,
      status: 'awaiting_ncc_review',
      guestContactEmail: input.contactEmail ?? null,
      guestContactName: input.contactName ?? null,
    })
    await insertOrderRequestLines(db, orderRequestId, resolvedLines)
    await db
      .update(baskets)
      .set({ status: 'submitted', orderRequestId })
      .where(eq(baskets.id, basketId))

    const { token } = await issueGuestToken(db, 'order_request', orderRequestId)

    await recordAuditEvent(db, {
      actorType: 'guest',
      actorId: null,
      action: 'submit_order_request',
      resourceType: 'order_request',
      resourceId: orderRequestId,
      detail: { lineCount: resolvedLines.length },
    })

    return { kind: 'guest', orderRequestId, token }
  })
}

/**
 * A signed-in company buyer's basket requires company-admin approval
 * unconditionally (rule 6) — so, unlike the guest path, this creates the
 * order request directly at `awaiting_company_approval` (a creation value,
 * same as the guest path's direct creation at `awaiting_ncc_review` — no
 * transition needed to reach an initial state). The company admin's
 * approve/reject action (../orders/company-approval.ts) is what actually
 * exercises `transitionOrderRequest`'s guarded `company_approve`/
 * `company_reject` transitions out of this state. No guest token: the
 * buyer reaches their own order via `/account/orders`, session-gated.
 */
async function submitBuyerBasket(
  db: Db,
  basketId: string,
  buyerUserId: string,
): Promise<SubmitBasketResult> {
  return withIdempotency(db, 'submit_basket', basketId, async () => {
    const resolvedLines = await resolveLinesOrThrow(db, basketId)

    const orderRequestId = randomUUID()
    await db.insert(orderRequests).values({
      id: orderRequestId,
      status: 'awaiting_company_approval',
      buyerUserId,
    })
    await insertOrderRequestLines(db, orderRequestId, resolvedLines)
    await db
      .update(baskets)
      .set({ status: 'submitted', orderRequestId })
      .where(eq(baskets.id, basketId))

    await recordAuditEvent(db, {
      actorType: 'buyer',
      actorId: buyerUserId,
      action: 'submit_order_request',
      resourceType: 'order_request',
      resourceId: orderRequestId,
      detail: { lineCount: resolvedLines.length },
    })

    return { kind: 'buyer', orderRequestId }
  })
}

export async function submitBasket(
  db: Db,
  basketId: string,
  input: SubmitBasketInput,
): Promise<SubmitBasketResult> {
  const [basket] = await db.select().from(baskets).where(eq(baskets.id, basketId)).limit(1)
  if (!basket) throw new BasketNotFoundError()

  return basket.buyerUserId
    ? submitBuyerBasket(db, basketId, basket.buyerUserId)
    : submitGuestBasket(db, basketId, input)
}
