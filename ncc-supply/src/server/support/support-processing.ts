import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { ForbiddenError, isNccAdmin, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import { storeAttachment, type AttachmentInput } from '../attachments/attachments'
import type { Db } from '../db/client'
import { supportTicketMessages, supportTickets } from '../db/schema'
import { transitionSupportTicket, type SupportTicketAction } from '../domain/status'
import { issueGuestToken } from '../tokens/token-service'
import type { StaffSupportReplyInput } from '../validation/commands'

export class SupportTicketNotFoundError extends Error {
  constructor() {
    super('Support ticket not found')
    this.name = 'SupportTicketNotFoundError'
  }
}

export interface CustomerReplyInput {
  message: string
  attachment?: AttachmentInput
}

/**
 * Authorization here mirrors quote acceptance (decision 8, Phase 9):
 * whoever the caller already confirmed can *view* this ticket (guest token
 * or `getSupportTicketViewForActor`) can reply to it, so this takes no
 * actor and trusts the id it's given. Replying to a `resolved` ticket
 * implicitly reopens it — `transitionSupportTicket`'s own table has no
 * `customer_reply` action from `resolved`, only `reopen`, and both land on
 * `awaiting_ncc` either way, so picking the right action for the current
 * status is enough; no separate "reopen" button is needed. A customer
 * can't reply while `open` or `escalated` (no such transition exists) —
 * the UI only shows the reply box when the current status actually allows
 * one, rather than ever attempting an invalid transition.
 */
export async function replyAsCustomer(
  db: Db,
  ticketId: string,
  buyerUserId: string | null,
  input: CustomerReplyInput,
): Promise<void> {
  const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1)
  if (!ticket) throw new SupportTicketNotFoundError()

  const actionType: SupportTicketAction['type'] = ticket.status === 'resolved' ? 'reopen' : 'customer_reply'
  const nextStatus = transitionSupportTicket(ticket.status, { type: actionType })

  const messageId = randomUUID()
  await db.insert(supportTicketMessages).values({
    id: messageId,
    supportTicketId: ticketId,
    authorBuyerUserId: buyerUserId,
    isInternalNote: false,
    message: input.message,
  })
  if (input.attachment) await storeAttachment(db, 'support_ticket_message', messageId, input.attachment)

  await db.update(supportTickets).set({ status: nextStatus }).where(eq(supportTickets.id, ticketId))

  await recordAuditEvent(db, {
    actorType: buyerUserId ? 'buyer' : 'guest',
    actorId: buyerUserId,
    action: 'customer_reply_support_ticket',
    resourceType: 'support_ticket',
    resourceId: ticketId,
  })
}

export type StaffReplyInput = StaffSupportReplyInput

/**
 * NCC-admin-only, mirroring order approval / quote pricing — a sales rep
 * is read-only everywhere (`canMutateCompanyResource`'s own rule), which
 * applies here too even though this module doesn't reuse that function
 * directly (a support ticket reply isn't a company-scoped resource
 * mutation the same shape as approve/reject, but the same access
 * boundary applies). An internal note never changes the customer-visible
 * status — nothing was actually sent to the customer.
 */
export async function replyAsStaff(db: Db, actor: Actor, input: StaffReplyInput): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()

  const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, input.ticketId)).limit(1)
  if (!ticket) throw new SupportTicketNotFoundError()

  const messageId = randomUUID()
  await db.insert(supportTicketMessages).values({
    id: messageId,
    supportTicketId: input.ticketId,
    authorStaffUserId: actor.staffUserId,
    isInternalNote: input.isInternalNote,
    message: input.message,
  })
  if (input.attachment) await storeAttachment(db, 'support_ticket_message', messageId, input.attachment)

  if (!input.isInternalNote) {
    const nextStatus = transitionSupportTicket(ticket.status, { type: 'ncc_reply' })
    await db.update(supportTickets).set({ status: nextStatus }).where(eq(supportTickets.id, input.ticketId))
  }

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: input.isInternalNote ? 'add_support_internal_note' : 'ncc_reply_support_ticket',
    resourceType: 'support_ticket',
    resourceId: input.ticketId,
  })
}

export async function resolveSupportTicket(db: Db, actor: Actor, ticketId: string): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1)
  if (!ticket) throw new SupportTicketNotFoundError()

  const nextStatus = transitionSupportTicket(ticket.status, { type: 'resolve' })
  await db.update(supportTickets).set({ status: nextStatus }).where(eq(supportTickets.id, ticketId))

  await recordAuditEvent(db, { actorType: 'staff', actorId: actor.staffUserId, action: 'resolve_support_ticket', resourceType: 'support_ticket', resourceId: ticketId })
}

export async function escalateSupportTicket(db: Db, actor: Actor, ticketId: string): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ticket] = await db.select({ status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1)
  if (!ticket) throw new SupportTicketNotFoundError()

  const nextStatus = transitionSupportTicket(ticket.status, { type: 'escalate' })
  await db.update(supportTickets).set({ status: nextStatus }).where(eq(supportTickets.id, ticketId))

  await recordAuditEvent(db, { actorType: 'staff', actorId: actor.staffUserId, action: 'escalate_support_ticket', resourceType: 'support_ticket', resourceId: ticketId })
}

/** Mirrors `orders/ncc-approval.ts::getGuestOrderLink` — guest tickets only. */
export async function getGuestSupportLink(db: Db, actor: Actor, ticketId: string): Promise<string | null> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ticket] = await db.select({ buyerUserId: supportTickets.buyerUserId }).from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1)
  if (!ticket) throw new SupportTicketNotFoundError()
  if (ticket.buyerUserId) return null

  const { token } = await issueGuestToken(db, 'support_ticket', ticketId)
  return `/support/${ticketId}?token=${encodeURIComponent(token)}`
}
