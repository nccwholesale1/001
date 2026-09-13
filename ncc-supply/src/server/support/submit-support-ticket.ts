import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import { storeAttachment } from '../attachments/attachments'
import type { Db } from '../db/client'
import { returns, supportTicketMessages, supportTickets } from '../db/schema'
import { getOrderRequestViewForActor } from '../orders/order-view'
import { getReturnViewForActor } from '../returns/return-view'
import { issueGuestToken, verifyGuestToken } from '../tokens/token-service'
import type { SupportTicketRequestInput } from '../validation/commands'

export class UnverifiedReferenceError extends Error {
  constructor() {
    super("We couldn't verify that order or return reference — check the link and try again")
    this.name = 'UnverifiedReferenceError'
  }
}

export type SubmitSupportTicketInput = SupportTicketRequestInput

export type SubmitSupportTicketResult =
  | { kind: 'guest'; ticketId: string; token: string }
  | { kind: 'buyer'; ticketId: string }

/**
 * The order/return reference is optional (PRD §6.18) — when given, it's
 * verified so a ticket can't misattribute itself to a resource the
 * submitter doesn't actually own; when omitted, this is simply a no-op
 * (a general account/site complaint needs no reference at all).
 */
async function assertReferenceOwnership(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }> | null,
  input: SubmitSupportTicketInput,
): Promise<void> {
  if (input.orderRequestId) {
    if (actor) {
      const view = await getOrderRequestViewForActor(db, actor, input.orderRequestId)
      if (!view) throw new UnverifiedReferenceError()
    } else {
      if (!input.referenceToken) throw new UnverifiedReferenceError()
      const verification = await verifyGuestToken(db, input.referenceToken, 'order_request')
      if (!verification || verification.resourceId !== input.orderRequestId) throw new UnverifiedReferenceError()
    }
  }

  if (input.returnId) {
    if (actor) {
      const view = await getReturnViewForActor(db, actor, input.returnId)
      if (!view) throw new UnverifiedReferenceError()
    } else {
      if (!input.referenceToken) throw new UnverifiedReferenceError()
      const verification = await verifyGuestToken(db, input.referenceToken, 'return')
      if (!verification || verification.resourceId !== input.returnId) throw new UnverifiedReferenceError()
    }
  }
}

export async function submitSupportTicket(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }> | null,
  input: SubmitSupportTicketInput,
): Promise<SubmitSupportTicketResult> {
  await assertReferenceOwnership(db, actor, input)
  // A return's own reasoning references an order it can't see without staff — but a ticket referencing only a returnId, not the orderRequestId, still needs the order relationship recorded for staff context.
  const resolvedOrderRequestId = input.orderRequestId ?? (input.returnId ? await orderRequestIdForReturn(db, input.returnId) : null)

  const ticketId = randomUUID()
  await db.insert(supportTickets).values({
    id: ticketId,
    buyerUserId: actor?.buyerUserId ?? null,
    guestContactEmail: actor ? null : (input.contactEmail ?? null),
    category: input.category,
    orderRequestId: resolvedOrderRequestId,
    returnId: input.returnId ?? null,
    status: 'open',
  })

  const messageId = randomUUID()
  await db.insert(supportTicketMessages).values({
    id: messageId,
    supportTicketId: ticketId,
    authorBuyerUserId: actor?.buyerUserId ?? null,
    isInternalNote: false,
    message: input.message,
  })

  if (input.attachment) {
    await storeAttachment(db, 'support_ticket_message', messageId, input.attachment)
  }

  await recordAuditEvent(db, {
    actorType: actor ? 'buyer' : 'guest',
    actorId: actor?.buyerUserId ?? null,
    action: 'submit_support_ticket',
    resourceType: 'support_ticket',
    resourceId: ticketId,
    detail: { category: input.category },
  })

  if (actor) return { kind: 'buyer', ticketId }
  const { token } = await issueGuestToken(db, 'support_ticket', ticketId)
  return { kind: 'guest', ticketId, token }
}

async function orderRequestIdForReturn(db: Db, returnId: string): Promise<string | null> {
  const [ret] = await db.select({ orderRequestId: returns.orderRequestId }).from(returns).where(eq(returns.id, returnId)).limit(1)
  return ret?.orderRequestId ?? null
}
