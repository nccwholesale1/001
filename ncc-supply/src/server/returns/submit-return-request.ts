import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { ForbiddenError, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import { storeAttachment } from '../attachments/attachments'
import type { Db } from '../db/client'
import { orderRequestLines, orderRequests, returnLines, returns } from '../db/schema'
import { getOrderRequestViewForActor } from '../orders/order-view'
import { issueGuestToken, verifyGuestToken } from '../tokens/token-service'
import type { ReturnRequestInput } from '../validation/commands'

export class OrderNotEligibleForReturnError extends Error {
  constructor() {
    super('This order is not eligible for a return')
    this.name = 'OrderNotEligibleForReturnError'
  }
}

export class ReturnQuantityExceedsAvailableError extends Error {
  constructor() {
    super('The requested return quantity exceeds what is still available to return on that line')
    this.name = 'ReturnQuantityExceedsAvailableError'
  }
}

export type SubmitReturnResult =
  | { kind: 'guest'; returnId: string; token: string }
  | { kind: 'buyer'; returnId: string }

/** Only a `confirmed` order can be returned — nothing before that has actually shipped. */
async function assertOrderEligibleAndGetLines(
  db: Db,
  orderRequestId: string,
): Promise<Map<string, { sku: string; confirmedQuantity: number }>> {
  const [order] = await db
    .select({ status: orderRequests.status })
    .from(orderRequests)
    .where(eq(orderRequests.id, orderRequestId))
    .limit(1)
  if (!order || order.status !== 'confirmed') throw new OrderNotEligibleForReturnError()

  const lines = await db.select().from(orderRequestLines).where(eq(orderRequestLines.orderRequestId, orderRequestId))
  return new Map(lines.map((line) => [line.id, { sku: line.sku, confirmedQuantity: line.confirmedQuantity ?? 0 }]))
}

/** Sums quantity already claimed by any return on this line that hasn't been rejected — a rejected return frees its quantity back up. */
async function getAlreadyReturnedQuantity(db: Db, orderRequestLineId: string): Promise<number> {
  const rows = await db
    .select({ quantity: returnLines.quantity, status: returns.status })
    .from(returnLines)
    .innerJoin(returns, eq(returnLines.returnId, returns.id))
    .where(eq(returnLines.orderRequestLineId, orderRequestLineId))
  return rows.filter((row) => row.status !== 'rejected').reduce((sum, row) => sum + row.quantity, 0)
}

async function assertAccess(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }> | null,
  orderToken: string | undefined,
  orderRequestId: string,
): Promise<void> {
  if (!actor) {
    if (!orderToken) throw new ForbiddenError()
    const verification = await verifyGuestToken(db, orderToken, 'order_request')
    if (!verification || verification.resourceId !== orderRequestId) throw new ForbiddenError()
    return
  }
  const view = await getOrderRequestViewForActor(db, actor, orderRequestId)
  if (!view) throw new OrderNotEligibleForReturnError()
}

/**
 * PRD §6.16: always reached with confirmed-order context, never a
 * cold-start form — the caller must already prove they can see that order
 * (guest token or buyer session) before a return can be filed against it.
 * Quantity eligibility is enforced per line against what was actually
 * confirmed, minus anything already claimed by a non-rejected return.
 */
export async function submitReturnRequest(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }> | null,
  input: ReturnRequestInput,
): Promise<SubmitReturnResult> {
  await assertAccess(db, actor, input.orderToken, input.orderRequestId)

  const lineMap = await assertOrderEligibleAndGetLines(db, input.orderRequestId)
  for (const line of input.lines) {
    const orderLine = lineMap.get(line.orderRequestLineId)
    if (!orderLine) throw new OrderNotEligibleForReturnError()
    const alreadyReturned = await getAlreadyReturnedQuantity(db, line.orderRequestLineId)
    if (line.quantity + alreadyReturned > orderLine.confirmedQuantity) {
      throw new ReturnQuantityExceedsAvailableError()
    }
  }

  const returnId = randomUUID()
  await db.insert(returns).values({
    id: returnId,
    orderRequestId: input.orderRequestId,
    status: 'requested',
    reason: input.reason,
    note: input.note ?? null,
  })
  await db.insert(returnLines).values(
    input.lines.map((line) => ({
      id: randomUUID(),
      returnId,
      orderRequestLineId: line.orderRequestLineId,
      quantity: line.quantity,
    })),
  )

  if (input.attachment) {
    await storeAttachment(db, 'return', returnId, input.attachment)
  }

  await recordAuditEvent(db, {
    actorType: actor ? 'buyer' : 'guest',
    actorId: actor?.buyerUserId ?? null,
    action: 'submit_return_request',
    resourceType: 'return',
    resourceId: returnId,
    detail: { orderRequestId: input.orderRequestId, lineCount: input.lines.length },
  })

  if (!actor) {
    const { token } = await issueGuestToken(db, 'return', returnId)
    return { kind: 'guest', returnId, token }
  }
  return { kind: 'buyer', returnId }
}
