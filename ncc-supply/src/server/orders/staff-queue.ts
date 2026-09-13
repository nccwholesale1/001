import { eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, orderRequestLines, orderRequests } from '../db/schema'
import type { OrderRequestSummary } from './order-view'

/**
 * The `/staff/orders` queue (PRD §6.9): an NCC admin sees every order,
 * guest and company alike; a sales rep sees only orders whose company is on
 * their own assigned book, read-only, and — since `canViewCompanyResource`
 * treats a guest order's `companyId: null` as never assignable to anyone —
 * never sees a guest order at all. Reuses the same authorization function
 * as the buyer-facing queue (order-view.ts), not a re-derived rule.
 */
export async function listOrderRequestsForStaff(
  db: Db,
  actor: Extract<Actor, { kind: 'sales_rep' | 'ncc_admin' }>,
): Promise<OrderRequestSummary[]> {
  const orders = await db.select().from(orderRequests)

  const buyerIds = orders.map((order) => order.buyerUserId).filter((id): id is string => id !== null)
  const buyers =
    buyerIds.length > 0
      ? await db
          .select({ id: buyerUsers.id, name: buyerUsers.name, companyId: buyerUsers.companyId })
          .from(buyerUsers)
          .where(inArray(buyerUsers.id, buyerIds))
      : []
  const buyerById = new Map(buyers.map((buyer) => [buyer.id, buyer]))

  const visible = orders.filter((order) => {
    const buyer = order.buyerUserId ? buyerById.get(order.buyerUserId) : undefined
    const companyId = buyer?.companyId ?? null
    return canViewCompanyResource(actor, { companyId, ownerBuyerUserId: order.buyerUserId })
  })

  const summaries: OrderRequestSummary[] = []
  for (const order of visible) {
    const lines = await db
      .select({ requestedQuantity: orderRequestLines.requestedQuantity, unitPricePence: orderRequestLines.unitPricePence })
      .from(orderRequestLines)
      .where(eq(orderRequestLines.orderRequestId, order.id))
    const buyer = order.buyerUserId ? buyerById.get(order.buyerUserId) : undefined
    summaries.push({
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      buyerName: buyer?.name ?? null,
      lineCount: lines.length,
      subtotalPence: lines.reduce((sum, line) => sum + line.unitPricePence * line.requestedQuantity, 0),
    })
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
