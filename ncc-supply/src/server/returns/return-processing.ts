import { eq } from 'drizzle-orm'
import { ForbiddenError, isNccAdmin, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { orderRequests, returns } from '../db/schema'
import { transitionReturn } from '../domain/status'
import { issueGuestToken } from '../tokens/token-service'
import type { DecideReturnInput, MarkReturnOutcomeInput } from '../validation/commands'

export class ReturnNotFoundError extends Error {
  constructor() {
    super('Return not found')
    this.name = 'ReturnNotFoundError'
  }
}

export async function beginReturnReview(db: Db, actor: Actor, returnId: string): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ret] = await db.select({ status: returns.status }).from(returns).where(eq(returns.id, returnId)).limit(1)
  if (!ret) throw new ReturnNotFoundError()

  const nextStatus = transitionReturn(ret.status, { type: 'begin_review' })
  await db
    .update(returns)
    .set({ status: nextStatus, handledByStaffUserId: actor.staffUserId })
    .where(eq(returns.id, returnId))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: 'begin_return_review',
    resourceType: 'return',
    resourceId: returnId,
  })
}

/**
 * PRD §6.20: staff approve/reject with a reason, choosing refund vs. replacement on approval.
 *
 * No Shopify sync is attempted here. The real `returnApproveRequest` mutation
 * (verified against the live schema in Phase 3) approves an *existing*
 * Shopify Return object — one Shopify itself creates via its own native
 * return-request flow. A return filed through this app's own `/returns` form
 * has no such object, since nothing upstream creates one; a real attempt was
 * proven to fail every time against the live store (ADR-034), so calling it
 * unconditionally here would be a guaranteed-failing network call, not
 * genuine best-effort resilience. The app's own `approved` status is the
 * system of record regardless. Whether NCC wants a real Shopify-side Return
 * created (and what that would require) is an open business/architecture
 * question — see DECISIONS.md ADR-034 and PHASE_HANDOFF.md.
 */
export async function decideReturn(db: Db, actor: Actor, input: DecideReturnInput): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ret] = await db.select({ status: returns.status }).from(returns).where(eq(returns.id, input.returnId)).limit(1)
  if (!ret) throw new ReturnNotFoundError()

  if (input.decision === 'approve' && !input.resolution) {
    throw new Error('A resolution (refund or replacement) is required to approve a return')
  }
  if (input.decision === 'reject' && !input.rejectionReason) {
    throw new Error('A rejection reason is required')
  }

  const nextStatus = transitionReturn(ret.status, { type: input.decision === 'approve' ? 'approve' : 'reject' })

  await db
    .update(returns)
    .set({
      status: nextStatus,
      resolution: input.decision === 'approve' ? (input.resolution ?? null) : null,
      rejectionReason: input.decision === 'reject' ? (input.rejectionReason ?? null) : null,
      handledByStaffUserId: actor.staffUserId,
    })
    .where(eq(returns.id, input.returnId))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: input.decision === 'approve' ? 'approve_return' : 'reject_return',
    resourceType: 'return',
    resourceId: input.returnId,
    detail: { resolution: input.resolution, rejectionReason: input.rejectionReason },
  })
}

/** A manual staff confirmation that the real-world refund/replacement happened. */
export async function markReturnOutcome(db: Db, actor: Actor, input: MarkReturnOutcomeInput): Promise<void> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ret] = await db.select({ status: returns.status }).from(returns).where(eq(returns.id, input.returnId)).limit(1)
  if (!ret) throw new ReturnNotFoundError()

  const nextStatus = transitionReturn(ret.status, {
    type: input.outcome === 'refunded' ? 'mark_refunded' : 'mark_replacement_sent',
  })
  await db.update(returns).set({ status: nextStatus }).where(eq(returns.id, input.returnId))

  await recordAuditEvent(db, {
    actorType: 'staff',
    actorId: actor.staffUserId,
    action: `mark_return_${input.outcome}`,
    resourceType: 'return',
    resourceId: input.returnId,
  })
}

/** Mirrors `orders/ncc-approval.ts::getGuestOrderLink` — guest returns only, a fresh token minted on demand. */
export async function getGuestReturnLink(db: Db, actor: Actor, returnId: string): Promise<string | null> {
  if (!isNccAdmin(actor)) throw new ForbiddenError()
  const [ret] = await db
    .select({ orderRequestId: returns.orderRequestId })
    .from(returns)
    .where(eq(returns.id, returnId))
    .limit(1)
  if (!ret) throw new ReturnNotFoundError()

  const [order] = await db
    .select({ buyerUserId: orderRequests.buyerUserId })
    .from(orderRequests)
    .where(eq(orderRequests.id, ret.orderRequestId))
    .limit(1)
  if (order?.buyerUserId) return null

  const { token } = await issueGuestToken(db, 'return', returnId)
  return `/returns/${returnId}?token=${encodeURIComponent(token)}`
}
