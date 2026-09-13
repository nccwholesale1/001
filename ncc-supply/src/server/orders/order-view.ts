import { eq, inArray } from 'drizzle-orm'
import { canViewCompanyResource, isCompanyAdmin, ForbiddenError, type Actor } from '../auth/authorization'
import type { Db } from '../db/client'
import { buyerUsers, orderRequestLines, orderRequests, type OrderRequestStatus } from '../db/schema'
import { addLine } from '../basket/basket'
import { getOrCreateBuyerBasketId } from '../basket/session'
import { getCatalogueAdapter } from '../integrations/shopify'

export interface OrderRequestLineView {
  id: string
  sku: string
  title: string
  requestedQuantity: number
  confirmedQuantity: number | null
  unitPricePence: number
}

export interface OrderRequestView {
  id: string
  status: OrderRequestStatus
  buyerUserId: string | null
  guestContactEmail: string | null
  guestContactName: string | null
  cancelledReason: string | null
  deliveryPence: number | null
  vatPence: number | null
  finalTotalPence: number | null
  /** Staff-only in practice (never rendered on the guest/buyer views) — real once ADMIN_COMMERCE_ADAPTER=live. */
  invoiceUrl: string | null
  shopifyDraftOrderId: string | null
  internalNotes: string | null
  /** Self-reported by the customer at submission (e.g. from the Bulk Order page) — a lead-attribution hint for staff, never an authorization credential. */
  referringSalesRepId: string | null
  lines: OrderRequestLineView[]
}

/**
 * Pure DB-fetch for one order request's detail — shared by the guest
 * token-gated route (routes/order/$id.tsx) and the buyer/admin
 * session-gated one (routes/account/orders.tsx), since PRD §6.11 requires
 * "the same detail shown in §6.7" on both. Authorization is each caller's
 * job (token verification vs. `canViewCompanyResource`) — this function
 * itself trusts whatever id it's given.
 */
export async function buildOrderRequestView(db: Db, orderRequestId: string): Promise<OrderRequestView | null> {
  const [orderRequest] = await db
    .select()
    .from(orderRequests)
    .where(eq(orderRequests.id, orderRequestId))
    .limit(1)
  if (!orderRequest) return null

  const rows = await db
    .select()
    .from(orderRequestLines)
    .where(eq(orderRequestLines.orderRequestId, orderRequest.id))
  const adapter = getCatalogueAdapter()
  const lines = await Promise.all(
    rows.map(async (row) => {
      const product = await adapter.getProduct(row.sku)
      return {
        id: row.id,
        sku: row.sku,
        title: product?.title ?? row.sku,
        requestedQuantity: row.requestedQuantity,
        confirmedQuantity: row.confirmedQuantity,
        unitPricePence: row.unitPricePence,
      }
    }),
  )

  return {
    id: orderRequest.id,
    status: orderRequest.status,
    buyerUserId: orderRequest.buyerUserId,
    guestContactEmail: orderRequest.guestContactEmail,
    guestContactName: orderRequest.guestContactName,
    cancelledReason: orderRequest.cancelledReason,
    deliveryPence: orderRequest.deliveryPence,
    vatPence: orderRequest.vatPence,
    finalTotalPence: orderRequest.finalTotalPence,
    invoiceUrl: orderRequest.invoiceUrl,
    shopifyDraftOrderId: orderRequest.shopifyDraftOrderId,
    internalNotes: orderRequest.internalNotes,
    referringSalesRepId: orderRequest.referringSalesRepId,
    lines,
  }
}

async function companyIdForOrderRequest(db: Db, buyerUserId: string | null): Promise<string | null> {
  if (!buyerUserId) return null
  const [buyer] = await db
    .select({ companyId: buyerUsers.companyId })
    .from(buyerUsers)
    .where(eq(buyerUsers.id, buyerUserId))
    .limit(1)
  return buyer?.companyId ?? null
}

/**
 * Session-gated equivalent of the guest route's token check: `null` for
 * "doesn't exist" and a thrown `ForbiddenError` for "exists but you can't
 * see it" are deliberately different here (unlike the guest path's
 * uniform-null no-enumeration contract) — an authenticated actor's own
 * access boundary is already established by their session, so there's no
 * enumeration risk to guard against the way an anonymous token-bearer
 * needs.
 */
export async function getOrderRequestViewForActor(
  db: Db,
  actor: Actor,
  orderRequestId: string,
): Promise<OrderRequestView | null> {
  const [orderRequest] = await db
    .select({ id: orderRequests.id, buyerUserId: orderRequests.buyerUserId })
    .from(orderRequests)
    .where(eq(orderRequests.id, orderRequestId))
    .limit(1)
  if (!orderRequest) return null

  const companyId = await companyIdForOrderRequest(db, orderRequest.buyerUserId)
  if (!canViewCompanyResource(actor, { companyId, ownerBuyerUserId: orderRequest.buyerUserId })) {
    throw new ForbiddenError()
  }

  return buildOrderRequestView(db, orderRequestId)
}

export interface OrderRequestSummary {
  id: string
  status: OrderRequestStatus
  createdAt: string
  buyerName: string | null
  lineCount: number
  subtotalPence: number
}

/**
 * PRD §6.11: a plain buyer sees only their own orders; a company admin sees
 * every order placed under the company. Reuses `canViewCompanyResource`
 * indirectly by construction (the query itself is already scoped per role)
 * rather than filtering a full table scan in application code.
 */
export async function listOrderRequestsForActor(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }>,
): Promise<OrderRequestSummary[]> {
  const buyerIds = isCompanyAdmin(actor)
    ? (
        await db
          .select({ id: buyerUsers.id })
          .from(buyerUsers)
          .where(eq(buyerUsers.companyId, actor.companyId))
      ).map((row) => row.id)
    : [actor.buyerUserId]

  if (buyerIds.length === 0) return []

  const orders = await db
    .select()
    .from(orderRequests)
    .where(inArray(orderRequests.buyerUserId, buyerIds))

  const buyers = await db
    .select({ id: buyerUsers.id, name: buyerUsers.name })
    .from(buyerUsers)
    .where(inArray(buyerUsers.id, buyerIds))
  const buyerNameById = new Map(buyers.map((buyer) => [buyer.id, buyer.name]))

  const summaries: OrderRequestSummary[] = []
  for (const order of orders) {
    const lines = await db
      .select({ requestedQuantity: orderRequestLines.requestedQuantity, unitPricePence: orderRequestLines.unitPricePence })
      .from(orderRequestLines)
      .where(eq(orderRequestLines.orderRequestId, order.id))
    summaries.push({
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      buyerName: order.buyerUserId ? (buyerNameById.get(order.buyerUserId) ?? null) : null,
      lineCount: lines.length,
      subtotalPence: lines.reduce((sum, line) => sum + line.unitPricePence * line.requestedQuantity, 0),
    })
  }

  return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

/**
 * PRD §6.11 "Reorder" — duplicates a past order's lines into a fresh basket
 * via the existing `addLine` (never a bespoke copy path, so the same
 * SKU-availability/quantity rules apply). Uses confirmed quantity where one
 * was set (what was actually supplied) and falls back to what was
 * originally requested otherwise.
 */
export async function reorderIntoBasket(
  db: Db,
  actor: Extract<Actor, { kind: 'buyer' }>,
  orderRequestId: string,
): Promise<void> {
  const view = await getOrderRequestViewForActor(db, actor, orderRequestId)
  if (!view) throw new ForbiddenError('Order not found')

  const basketId = await getOrCreateBuyerBasketId(db, actor.buyerUserId)
  for (const line of view.lines) {
    const quantity = line.confirmedQuantity ?? line.requestedQuantity
    if (quantity > 0) await addLine(db, basketId, line.sku, quantity)
  }
}
