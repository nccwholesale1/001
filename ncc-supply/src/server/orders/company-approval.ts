import { eq } from 'drizzle-orm'
import { canMutateCompanyResource, ForbiddenError, type Actor } from '../auth/authorization'
import { recordAuditEvent } from '../audit/audit-log'
import type { Db } from '../db/client'
import { buyerUsers, orderRequests } from '../db/schema'
import { transitionOrderRequest } from '../domain/status'
import type { CompanyApprovalDecisionInput } from '../validation/commands'

export class OrderRequestNotFoundError extends Error {
  constructor() {
    super('Order request not found')
    this.name = 'OrderRequestNotFoundError'
  }
}

/**
 * The company-admin approval step a guest basket skips (rule 6): moves an
 * order request out of `awaiting_company_approval` via the real guarded
 * `transitionOrderRequest` (../domain/status.ts) — a second attempt on an
 * already-decided order throws `InvalidTransitionError` rather than
 * double-applying, which is what makes a replayed approve/reject safe
 * without a separate idempotency wrapper (there's no side effect beyond
 * status/timestamp/audit-event to double-write).
 */
export async function decideCompanyApproval(
  db: Db,
  actor: Actor,
  input: CompanyApprovalDecisionInput,
): Promise<void> {
  const [orderRequest] = await db
    .select()
    .from(orderRequests)
    .where(eq(orderRequests.id, input.orderRequestId))
    .limit(1)
  if (!orderRequest) throw new OrderRequestNotFoundError()

  const companyId = orderRequest.buyerUserId
    ? ((
        await db
          .select({ companyId: buyerUsers.companyId })
          .from(buyerUsers)
          .where(eq(buyerUsers.id, orderRequest.buyerUserId))
          .limit(1)
      )[0]?.companyId ?? null)
    : null

  if (
    !canMutateCompanyResource(actor, {
      companyId,
      ownerBuyerUserId: orderRequest.buyerUserId,
    })
  ) {
    throw new ForbiddenError()
  }

  const nextStatus = transitionOrderRequest(orderRequest.status, {
    type: input.decision === 'approve' ? 'company_approve' : 'company_reject',
  })

  const actorBuyerId = actor.kind === 'buyer' ? actor.buyerUserId : null

  if (input.decision === 'approve') {
    await db
      .update(orderRequests)
      .set({
        status: nextStatus,
        companyApprovedByBuyerUserId: actorBuyerId,
        companyApprovedAt: new Date().toISOString(),
      })
      .where(eq(orderRequests.id, orderRequest.id))
  } else {
    await db
      .update(orderRequests)
      .set({
        status: nextStatus,
        cancelledReason: input.reason ?? 'Rejected by company admin',
      })
      .where(eq(orderRequests.id, orderRequest.id))
  }

  await recordAuditEvent(db, {
    actorType: 'buyer',
    actorId: actorBuyerId,
    action: input.decision === 'approve' ? 'company_approve_order' : 'company_reject_order',
    resourceType: 'order_request',
    resourceId: orderRequest.id,
    detail: input.reason ? { reason: input.reason } : undefined,
  })
}
