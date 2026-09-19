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
 * Creates the Shopify Draft Order for a confirmed order, if one doesn't
 * exist yet — called both right after confirmation and from the explicit
 * "Retry Shopify sync" action. Idempotent by construction: never re-creates
 * a draft order that already exists.
 *
 * `draftOrderCreate` returns `invoiceUrl` itself, so the customer's pay link
 * is available without emailing anyone. Sending the invoice email is a
 * separate, deliberate staff action (`sendInvoiceEmail`) — syncing must
 * never mail a customer as a side effect.
 *
 * A failure here is deliberately not thrown: the order is already validly
 * `confirmed` in our own system (rule 13 is satisfied regardless). It is
 * recorded on `shopifySyncError` instead of only logged, so the staff
 * console can show *why* an order has no pay link rather than leaving it
 * silently stuck.
 */
async function syncToShopify(db: Db, orderRequestId: string): Promise<void> {
  const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, orderRequestId)).limit(1)
  if (!order) return
  if (order.shopifyDraftOrderId) return

  const adapter = getAdminCommerceAdapter()

  try {
    const lines = await db.select().from(orderRequestLines).where(eq(orderRequestLines.orderRequestId, orderRequestId))
    const email = await resolveOrderEmail(db, order)
    const draftOrder = await adapter.createDraftOrder({
      email,
      reference: order.id,
      lines: lines
        .filter((line) => (line.confirmedQuantity ?? 0) > 0)
        .map((line) => ({
          variantId: line.shopifyVariantId,
          quantity: line.confirmedQuantity!,
          unitPricePence: line.unitPricePence,
        })),
      ...(order.deliveryPence
        ? { shippingLine: { title: 'Delivery', pricePence: order.deliveryPence } }
        : {}),
    })

    await db
      .update(orderRequests)
      .set({
        shopifyDraftOrderId: draftOrder.id,
        invoiceUrl: draftOrder.invoiceUrl,
        shopifySyncError: null,
      })
      .where(eq(orderRequests.id, orderRequestId))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[ncc-approval] Shopify sync failed for order ${orderRequestId}`, error)
    await db
      .update(orderRequests)
      .set({ shopifySyncError: message })
      .where(eq(orderRequests.id, orderRequestId))
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
    detail: { deliveryPence: input.deliveryPence, finalTotalPence: input.finalTotalPence },
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
 * Emails the Shopify invoice to the customer. Split out of `syncToShopify`
 * deliberately: creating the draft order already yields a usable pay link,
 * so mailing the customer is a decision staff make, never a side effect of
 * approving or retrying. Unlike sync, a failure here *is* thrown — staff
 * pressed a button and must be told it didn't work, or they'll assume the
 * customer was contacted when they weren't.
 */
export async function sendInvoiceEmail(db: Db, actor: Actor, orderRequestId: string): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()

  const [order] = await db.select().from(orderRequests).where(eq(orderRequests.id, orderRequestId)).limit(1)
  if (!order) throw new OrderRequestNotFoundError()
  if (order.status !== 'confirmed') throw new ForbiddenError('Only a confirmed order can be invoiced')
  if (!order.shopifyDraftOrderId) {
    throw new ForbiddenError('This order has no Shopify draft order yet — sync it first')
  }

  const email = await resolveOrderEmail(db, order)
  const invoiced = await getAdminCommerceAdapter().sendDraftOrderInvoice(order.shopifyDraftOrderId, {
    to: email,
  })
  if (invoiced.invoiceUrl) {
    await db
      .update(orderRequests)
      .set({ invoiceUrl: invoiced.invoiceUrl })
      .where(eq(orderRequests.id, orderRequestId))
  }

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: 'ncc_send_invoice_email',
    resourceType: 'order_request',
    resourceId: orderRequestId,
    detail: { to: email },
  })
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
