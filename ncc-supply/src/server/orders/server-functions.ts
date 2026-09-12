import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireActor } from '../buyers/buyer-session'
import { db } from '../db/client'
import { companyApprovalDecisionSchema, reorderSchema } from '../validation/commands'
import { decideCompanyApproval } from './company-approval'
import {
  getOrderRequestViewForActor,
  listOrderRequestsForActor,
  reorderIntoBasket,
  type OrderRequestSummary,
  type OrderRequestView,
} from './order-view'

export const listMyOrders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OrderRequestSummary[]> => {
    const actor = await requireActor(db)
    return listOrderRequestsForActor(db, actor)
  },
)

const orderRequestIdSchema = z.object({ orderRequestId: z.string().min(1) })

export const getMyOrderDetail = createServerFn({ method: 'GET' })
  .validator(orderRequestIdSchema.parse)
  .handler(async ({ data }): Promise<OrderRequestView | null> => {
    const actor = await requireActor(db)
    return getOrderRequestViewForActor(db, actor, data.orderRequestId)
  })

export const decideOrderApproval = createServerFn({ method: 'POST' })
  .validator(companyApprovalDecisionSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireActor(db)
    await decideCompanyApproval(db, actor, data)
  })

export const reorder = createServerFn({ method: 'POST' })
  .validator(reorderSchema.parse)
  .handler(async ({ data }) => {
    const actor = await requireActor(db)
    await reorderIntoBasket(db, actor, data.orderRequestId)
  })
