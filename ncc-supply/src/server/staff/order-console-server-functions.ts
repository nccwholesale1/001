import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '../db/client'
import { getOrderRequestViewForActor, type OrderRequestSummary, type OrderRequestView } from '../orders/order-view'
import { cancelOrder, confirmOrder, getGuestOrderLink, retryShopifySync } from '../orders/ncc-approval'
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

export const getStaffOrderDetail = createServerFn({ method: 'GET' })
  .validator(orderRequestIdSchema.parse)
  .handler(async ({ data }): Promise<OrderRequestView | null> => {
    const actor = await requireStaffActor(db)
    return getOrderRequestViewForActor(db, actor, data.orderRequestId)
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
