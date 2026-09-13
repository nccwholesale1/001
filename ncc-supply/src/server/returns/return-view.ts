import { and, eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, isCompanyAdmin, ForbiddenError, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import {
  attachments,
  buyerUsers,
  orderRequestLines,
  orderRequests,
  returnLines,
  returns,
  type ReturnStatus,
} from '../db/schema'
import { getCatalogueAdapter } from '../integrations/shopify'

export interface ReturnLineView {
  id: string
  orderRequestLineId: string
  sku: string
  title: string
  quantity: number
}

export interface ReturnView {
  id: string
  orderRequestId: string
  status: ReturnStatus
  reason: string
  note: string | null
  rejectionReason: string | null
  resolution: 'refund' | 'replacement' | null
  attachmentId: string | null
  lines: ReturnLineView[]
}

/**
 * Pure DB-fetch for one return's detail, mirroring
 * `orders/order-view.ts::buildOrderRequestView` — shared by the guest
 * token-gated route and the buyer/staff session-gated ones. Authorization
 * is each caller's job.
 */
export async function buildReturnView(db: Db, returnId: string): Promise<ReturnView | null> {
  const [ret] = await db.select().from(returns).where(eq(returns.id, returnId)).limit(1)
  if (!ret) return null

  const lineRows = await db.select().from(returnLines).where(eq(returnLines.returnId, returnId))
  const orderLineIds = lineRows.map((row) => row.orderRequestLineId)
  const orderLines =
    orderLineIds.length > 0
      ? await db.select().from(orderRequestLines).where(inArray(orderRequestLines.id, orderLineIds))
      : []
  const orderLineById = new Map(orderLines.map((line) => [line.id, line]))

  const adapter = getCatalogueAdapter()
  const lines = await Promise.all(
    lineRows.map(async (row) => {
      const orderLine = orderLineById.get(row.orderRequestLineId)
      const product = orderLine ? await adapter.getProduct(orderLine.sku) : null
      return {
        id: row.id,
        orderRequestLineId: row.orderRequestLineId,
        sku: orderLine?.sku ?? '',
        title: product?.title ?? orderLine?.sku ?? '',
        quantity: row.quantity,
      }
    }),
  )

  const [attachment] = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.ownerType, 'return'), eq(attachments.ownerId, returnId)))
    .limit(1)

  return {
    id: ret.id,
    orderRequestId: ret.orderRequestId,
    status: ret.status,
    reason: ret.reason,
    note: ret.note,
    rejectionReason: ret.rejectionReason,
    resolution: ret.resolution,
    attachmentId: attachment?.id ?? null,
    lines,
  }
}

/** A return has no contact fields of its own — company/owner scoping is always derived from its parent order. */
export async function companyAndOwnerForReturn(
  db: Db,
  orderRequestId: string,
): Promise<{ companyId: string | null; ownerBuyerUserId: string | null }> {
  const [order] = await db
    .select({ buyerUserId: orderRequests.buyerUserId })
    .from(orderRequests)
    .where(eq(orderRequests.id, orderRequestId))
    .limit(1)
  const ownerBuyerUserId = order?.buyerUserId ?? null
  if (!ownerBuyerUserId) return { companyId: null, ownerBuyerUserId: null }

  const [buyer] = await db
    .select({ companyId: buyerUsers.companyId })
    .from(buyerUsers)
    .where(eq(buyerUsers.id, ownerBuyerUserId))
    .limit(1)
  return { companyId: buyer?.companyId ?? null, ownerBuyerUserId }
}

export async function getReturnViewForActor(db: Db, actor: Actor, returnId: string): Promise<ReturnView | null> {
  const [ret] = await db
    .select({ id: returns.id, orderRequestId: returns.orderRequestId })
    .from(returns)
    .where(eq(returns.id, returnId))
    .limit(1)
  if (!ret) return null

  const { companyId, ownerBuyerUserId } = await companyAndOwnerForReturn(db, ret.orderRequestId)
  if (!canViewCompanyResource(actor, { companyId, ownerBuyerUserId })) throw new ForbiddenError()

  return buildReturnView(db, returnId)
}

export interface ReturnSummary {
  id: string
  orderRequestId: string
  status: ReturnStatus
  createdAt: string
  reason: string
  lineCount: number
}

async function toSummary(db: Db, ret: typeof returns.$inferSelect): Promise<ReturnSummary> {
  const lines = await db.select({ id: returnLines.id }).from(returnLines).where(eq(returnLines.returnId, ret.id))
  return {
    id: ret.id,
    orderRequestId: ret.orderRequestId,
    status: ret.status,
    createdAt: ret.createdAt,
    reason: ret.reason,
    lineCount: lines.length,
  }
}

/** PRD §6.11-equivalent: a plain buyer sees only their own; a company admin sees every return under the company. */
export async function listReturnsForActor(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }>,
): Promise<ReturnSummary[]> {
  const buyerIds = isCompanyAdmin(actor)
    ? (
        await db.select({ id: buyerUsers.id }).from(buyerUsers).where(eq(buyerUsers.companyId, actor.companyId))
      ).map((row) => row.id)
    : [actor.buyerUserId]
  if (buyerIds.length === 0) return []

  const orders = await db
    .select({ id: orderRequests.id })
    .from(orderRequests)
    .where(inArray(orderRequests.buyerUserId, buyerIds))
  const orderIds = orders.map((order) => order.id)
  if (orderIds.length === 0) return []

  const rows = await db.select().from(returns).where(inArray(returns.orderRequestId, orderIds))
  const summaries = await Promise.all(rows.map((row) => toSummary(db, row)))
  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
