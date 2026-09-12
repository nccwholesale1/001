import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getCurrentBuyerSummary } from '../../server/buyers/server-functions'
import {
  decideOrderApproval,
  getMyOrderDetail,
  listMyOrders,
  reorder,
} from '../../server/orders/server-functions'
import type { OrderRequestSummary, OrderRequestView } from '../../server/orders/order-view'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/StatusChip'
import { ORDER_STATUS_DISPLAY, OrderRequestDetail } from '../../components/ui/OrderRequestDetail'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export const Route = createFileRoute('/account/orders')({
  loader: async () => {
    const [orders, summary] = await Promise.all([listMyOrders(), getCurrentBuyerSummary()])
    return { orders, isAdmin: summary?.role === 'company_admin' }
  },
  head: () => ({ meta: [{ title: 'Orders · NCC Supply' }] }),
  component: AccountOrdersRoute,
})

function AccountOrdersRoute() {
  const { orders: initialOrders, isAdmin } = Route.useLoaderData()
  const [orders, setOrders] = useState<OrderRequestSummary[]>(initialOrders)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailById, setDetailById] = useState<Record<string, OrderRequestView>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorById, setErrorById] = useState<Record<string, string>>({})
  const [reorderedId, setReorderedId] = useState<string | null>(null)

  const getDetail = useServerFn(getMyOrderDetail)
  const decide = useServerFn(decideOrderApproval)
  const doReorder = useServerFn(reorder)
  const refreshOrders = useServerFn(listMyOrders)

  async function toggleExpand(orderId: string) {
    if (expandedId === orderId) {
      setExpandedId(null)
      return
    }
    setExpandedId(orderId)
    if (!detailById[orderId]) {
      const view = await getDetail({ data: { orderRequestId: orderId } })
      if (view) setDetailById((prev) => ({ ...prev, [orderId]: view }))
    }
  }

  async function handleDecision(orderId: string, decision: 'approve' | 'reject') {
    setBusyId(orderId)
    setErrorById((prev) => ({ ...prev, [orderId]: '' }))
    try {
      await decide({ data: { orderRequestId: orderId, decision } })
      setOrders(await refreshOrders())
      setDetailById((prev) => {
        const next = { ...prev }
        delete next[orderId]
        return next
      })
      setExpandedId(null)
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [orderId]: err instanceof Error ? err.message : 'Could not record that decision.',
      }))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReorder(orderId: string) {
    setBusyId(orderId)
    try {
      await doReorder({ data: { orderRequestId: orderId } })
      setReorderedId(orderId)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Orders</h1>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const detail = detailById[order.id]
            const expanded = expandedId === order.id
            const canDecide = isAdmin && order.status === 'awaiting_company_approval'

            return (
              <div key={order.id} className="surface-card rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(order.id)}
                    className="text-left text-sm font-semibold text-foreground hover:underline"
                  >
                    Order {order.id.slice(0, 8)}
                    {isAdmin && order.buyerName ? ` · ${order.buyerName}` : ''}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {formatPrice(order.subtotalPence)}
                    </span>
                    <StatusChip
                      tone={ORDER_STATUS_DISPLAY[order.status]?.tone ?? 'info'}
                      label={ORDER_STATUS_DISPLAY[order.status]?.label ?? order.status}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleReorder(order.id)}
                      disabled={busyId === order.id}
                    >
                      {reorderedId === order.id
                        ? 'Added'
                        : busyId === order.id
                          ? 'Adding…'
                          : 'Reorder'}
                    </Button>
                  </div>
                </div>

                {expanded && detail ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <OrderRequestDetail order={detail} bare />
                    {canDecide ? (
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Button
                          onClick={() => handleDecision(order.id, 'approve')}
                          disabled={busyId === order.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleDecision(order.id, 'reject')}
                          disabled={busyId === order.id}
                        >
                          Reject
                        </Button>
                        {errorById[order.id] ? (
                          <p role="alert" className="text-sm text-destructive">
                            {errorById[order.id]}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
