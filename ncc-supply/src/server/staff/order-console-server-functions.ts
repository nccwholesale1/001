import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { orderRequests } from '../db/schema'
import { getOrderRequestViewForActor, type OrderRequestSummary, type OrderRequestView } from '../orders/order-view'
import {
  cancelOrder,
  confirmOrder,
  getGuestOrderLink,
  retryShopifySync,
  sendInvoiceEmail,
} from '../orders/ncc-approval'
import { listOrderRequestsForStaff } from '../orders/staff-queue'
import { cancelOrderSchema, nccApprovalSchema } from '../validation/commands'
import { requireStaffActor } from './staff-session'

export const listStaffOrders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OrderRequestSummary[]> => {
    const actor = await requireStaffActor(db)
    return listOrderRequestsForStaff(db, actor)
  },
)

const orderRequestIdSchema = z.object({ orderRequestId: z.string().min(1) })

/**
 * `shopifySyncError` is deliberately not a field on `OrderRequestView`: that
 * same type is serialised to customers on `/order/:id` and `/checkout/:id`,
 * and a raw Shopify error message is internal diagnostic text. It is added
 * here, after the view's own authorization has already run.
 */
export interface StaffOrderDetail extends OrderRequestView {
  shopifySyncError: string | null
}

export const getStaffOrderDetail = createServerFn({ method: 'GET' })
  .validator(orderRequestIdSchema.parse)
  .handler(async ({ data }): Promise<StaffOrderDetail | null> => {
    const actor = await requireStaffActor(db)
    const view = await getOrderRequestViewForActor(db, actor, data.orderRequestId)
    if (!view) return null

    const [row] = await db
      .select({ shopifySyncError: orderRequests.shopifySyncError })
      .from(orderRequests)
      .where(eq(orderRequests.id, data.orderRequestId))
      .limit(1)

    return { ...view, shopifySyncError: row?.shopifySyncError ?? null }
  })

export const sendOrderInvoiceEmail = createServerFn({ method: 'POST' })
  .validator(orderRequestIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await sendInvoiceEmail(db, actor, data.orderRequestId)
  })

export const approveOrder = createServerFn({ method: 'POST' })
  .validator(nccApprovalSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await confirmOrder(db, actor, data)
  })

export const cancelStaffOrder = createServerFn({ method: 'POST' })
  .validator(cancelOrderSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await cancelOrder(db, actor, data)
  })

export const retryOrderShopifySync = createServerFn({ method: 'POST' })
  .validator(orderRequestIdSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireStaffActor(db)
    await retryShopifySync(db, actor, data.orderRequestId)
  })

export const getOrderCustomerLink = createServerFn({ method: 'POST' })
  .validator(orderRequestIdSchema.parse)
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const actor = await requireStaffActor(db)
    const url = await getGuestOrderLink(db, actor, data.orderRequestId)
    return { url }
  })
