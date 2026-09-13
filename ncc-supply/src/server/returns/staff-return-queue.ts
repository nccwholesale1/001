import { eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, orderRequests, returnLines, returns } from '../db/schema'
import type { ReturnSummary } from './return-view'

/**
 * The `/staff/returns` queue (PRD §6.20): an NCC admin sees every return,
 * guest and company alike; a sales rep sees only returns whose parent
 * order's company is on their own assigned book, read-only, and never sees
 * a guest return at all — mirrors `orders/staff-queue.ts` exactly.
 */
export async function listReturnsForStaff(
  db: Db,
  actor: Extract<Actor, { kind: 'sales_rep' | 'ncc_admin' }>,
): Promise<ReturnSummary[]> {
  const rows = await db.select().from(returns)

  const orderIds = rows.map((row) => row.orderRequestId)
  const orders =
    orderIds.length > 0
      ? await db
          .select({ id: orderRequests.id, buyerUserId: orderRequests.buyerUserId })
          .from(orderRequests)
          .where(inArray(orderRequests.id, orderIds))
      : []
  const orderById = new Map(orders.map((order) => [order.id, order]))

  const buyerIds = orders.map((order) => order.buyerUserId).filter((id): id is string => id !== null)
  const buyers =
    buyerIds.length > 0
      ? await db
          .select({ id: buyerUsers.id, companyId: buyerUsers.companyId })
          .from(buyerUsers)
          .where(inArray(buyerUsers.id, buyerIds))
      : []
  const companyIdByBuyerId = new Map(buyers.map((buyer) => [buyer.id, buyer.companyId]))

  const visible = rows.filter((row) => {
    const order = orderById.get(row.orderRequestId)
    const companyId = order?.buyerUserId ? (companyIdByBuyerId.get(order.buyerUserId) ?? null) : null
    return canViewCompanyResource(actor, { companyId, ownerBuyerUserId: order?.buyerUserId ?? null })
  })

  const summaries: ReturnSummary[] = []
  for (const row of visible) {
    const lines = await db.select({ id: returnLines.id }).from(returnLines).where(eq(returnLines.returnId, row.id))
    summaries.push({
      id: row.id,
      orderRequestId: row.orderRequestId,
      status: row.status,
      createdAt: row.createdAt,
      reason: row.reason,
      lineCount: lines.length,
    })
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
