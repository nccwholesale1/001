import { eq } from 'drizzle-orm'
import { ForbiddenError, isNccAdmin, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { buyerUsers, orderRequestLines, orderRequests } from '../db/schema'
import { assertConfirmedQuantityAllowed, transitionOrderRequest } from '../domain/status'
import { getAdminCommerceAdapter } from '../integrations/shopify'
import { issueGuestToken } from '../tokens/token-service'
import type { NccApprovalInput } from '../validation/commands'

export class OrderRequestNotFoundError extends Error {
  constructor() {
    super('Order request not found')
    this.name = 'OrderRequestNotFoundError'
  }
}

export class OrderRequestLineMismatchError extends Error {
  constructor() {
    super('The confirmed lines do not match this order request')
    this.name = 'OrderRequestLineMismatchError'
  }
}

async function resolveOrderEmail(db: Db, order: { guestContactEmail: string | null; buyerUserId: string | null }): Promise<string> {
  if (order.guestContactEmail) return order.guestContactEmail
  if (order.buyerUserId) {
    const [buyer] = await db.select({ email: buyerUsers.email }).from(buyerUsers).where(eq(buyerUsers.id, order.buyerUserId)).limit(1)
    if (buyer) return buyer.email
  }
  throw new Error(`Order request has no resolvable contact email`)
}

/**
 * Attempts whichever Shopify step hasn't succeeded yet for this order —
 * called both right after confirmation and from the explicit "Retry Shopify
 * sync" action. Idempotent by construction: never re-creates a draft order
 * that already exists, never re-sends an invoice that's already been sent.
 * A failure here is deliberately swallowed (logged, not thrown) — the order
 * is already validly `confirmed` in our own system (rule 13 is satisfied
 * regardless), and `shopifyDraftOrderId`/`invoiceUrl` staying `null` *is*
 * the explicit, visible "needs Shopify sync" state the staff console shows.
 */
async function syncToShopify(db: Db, orderRequestId: string): Promise<void> {
  const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, orderRequestId)).limit(1)
  if (!order) return

  const adapter = getAdminCommerceAdapter()

  try {
    let draftOrderId = order.shopifyDraftOrderId
    if (!draftOrderId) {
      const lines = await db.select().from(orderRequestLines).where(eq(orderRequestLines.orderRequestId, orderRequestId))
      const email = await resolveOrderEmail(db, order)
      const draftOrder = await adapter.createDraftOrder({
        email,
        lines: lines
          .filter((line) => (line.confirmedQuantity ?? 0) > 0)
          .map((line) => ({ variantId: line.shopifyVariantId, quantity: line.confirmedQuantity! })),
      })
      draftOrderId = draftOrder.id
      await db.update(orderRequests).set({ shopifyDraftOrderId: draftOrderId }).where(eq(orderRequests.id, orderRequestId))
    }

    if (!order.invoiceUrl) {
      const email = await resolveOrderEmail(db, order)
      const invoiced = await adapter.sendDraftOrderInvoice(draftOrderId, { to: email })
      if (invoiced.invoiceUrl) {
        await db.update(orderRequests).set({ invoiceUrl: invoiced.invoiceUrl }).where(eq(orderRequests.id, orderRequestId))
      }
    }
  } catch (error) {
    console.error(`[ncc-approval] Shopify sync failed for order ${orderRequestId}`, error)
  }
}

/**
 * PRD rule 13/14: one atomic action confirms quantities, delivery, VAT and
 * total together. The DB write is a single transaction; the Shopify sync
 * that follows is a separate, retryable step (see syncToShopify) — never
 * leaving the app's own `confirmed` status contingent on Shopify succeeding.
 */
export async function confirmOrder(db: Db, actor: Actor, input: NccApprovalInput): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()

  const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, input.orderRequestId)).limit(1)
  if (!order) throw new OrderRequestNotFoundError()

  const lines = await db.select().from(orderRequestLines).where(eq(orderRequestLines.orderRequestId, order.id))
  const lineById = new Map(lines.map((line) => [line.id, line]))
  if (input.lines.length !== lines.length) throw new OrderRequestLineMismatchError()

  for (const confirmedLine of input.lines) {
    const line = lineById.get(confirmedLine.orderRequestLineId)
    if (!line) throw new OrderRequestLineMismatchError()
    assertConfirmedQuantityAllowed(line.requestedQuantity, confirmedLine.confirmedQuantity)
  }

  const nextStatus = transitionOrderRequest(order.status, { type: 'ncc_approve' })

  await db.transaction(async (tx) => {
    for (const confirmedLine of input.lines) {
      await tx
        .update(orderRequestLines)
        .set({ confirmedQuantity: confirmedLine.confirmedQuantity })
        .where(eq(orderRequestLines.id, confirmedLine.orderRequestLineId))
    }
    await tx
      .update(orderRequests)
      .set({
        status: nextStatus,
        deliveryPence: input.deliveryPence,
        vatPence: input.vatPence,
        finalTotalPence: input.finalTotalPence,
        internalNotes: input.internalNotes ?? null,
        nccApprovedByStaffUserId: actor.staffUserId,
        nccApprovedAt: new Date().toISOString(),
      })
      .where(eq(orderRequests.id, order.id))
  })

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: 'ncc_approve_order',
    resourceType: 'order_request',
    resourceId: order.id,
    detail: { deliveryPence: input.deliveryPence, vatPence: input.vatPence, finalTotalPence: input.finalTotalPence },
  })

  await syncToShopify(db, order.id)
}

export async function retryShopifySync(db: Db, actor: Actor, orderRequestId: string): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [order] = await db.select({ status: orderRequests.status }).from(orderRequests).where(eq(orderRequests.id, orderRequestId)).limit(1)
  if (!order) throw new OrderRequestNotFoundError()
  if (order.status !== 'confirmed') throw new ForbiddenError('Only a confirmed order can sync to Shopify')
  await syncToShopify(db, orderRequestId)
}

/**
 * PRD §6.9 "Copy-to-clipboard for the customer's private link." A raw
 * guest token is never stored (rule 16, hash-only) so it can't be
 * re-derived — this mints a *fresh* one on demand instead. Harmless: the
 * guest's original link (if they still have it) keeps working too, this is
 * an additional valid token for the same resource, not a replacement.
 * Guest orders only — a company buyer has no token-based link at all, they
 * reach their order via /account/orders.
 */
export async function getGuestOrderLink(db: Db, actor: Actor, orderRequestId: string): Promise<string | null> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [order] = await db
    .select({ buyerUserId: orderRequests.buyerUserId })
    .from(orderRequests)
    .where(eq(orderRequests.id, orderRequestId))
    .limit(1)
  if (!order) throw new OrderRequestNotFoundError()
  // A guest order has no buyerUserId at all — an email being on file or not
  // doesn't change that; a company buyer order always has one.
  if (order.buyerUserId) return null

  const { token } = await issueGuestToken(db, 'order_request', orderRequestId)
  return `/order/${orderRequestId}?token=${encodeURIComponent(token)}`
}

export async function cancelOrder(
  db: Db,
  actor: Actor,
  input: { orderRequestId: string; reason: string },
): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()

  const [order] = await db.select({ status: orderRequests.status }).from(orderRequests).where(eq(orderRequests.id, input.orderRequestId)).limit(1)
  if (!order) throw new OrderRequestNotFoundError()

  const nextStatus = transitionOrderRequest(order.status, { type: 'cancel' })
  await db
    .update(orderRequests)
    .set({ status: nextStatus, cancelledReason: input.reason })
    .where(eq(orderRequests.id, input.orderRequestId))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: 'ncc_cancel_order',
    resourceType: 'order_request',
    resourceId: input.orderRequestId,
    detail: { reason: input.reason },
  })
}
