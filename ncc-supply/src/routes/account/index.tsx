import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getCurrentBuyerSummary } from '../../server/buyers/server-functions'
import { listMyOrders, reorder } from '../../server/orders/server-functions'
import type { OrderRequestSummary } from '../../server/orders/order-view'
import { Button } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/StatusChip'
import { ORDER_STATUS_DISPLAY } from '../../components/ui/OrderRequestDetail'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export const Route = createFileRoute('/account/')({
  loader: async () => {
    const [orders, summary] = await Promise.all([listMyOrders(), getCurrentBuyerSummary()])
    return { orders, isAdmin: summary?.role === 'company_admin' }
  },
  head: () => ({ meta: [{ title: 'Account · NCC Supply' }] }),
  component: AccountDashboard,
})

function AccountDashboard() {
  const { orders, isAdmin } = Route.useLoaderData()
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [reorderedId, setReorderedId] = useState<string | null>(null)
  const doReorder = useServerFn(reorder)

  const openOrders = orders.filter((order) => order.status !== 'confirmed' && order.status !== 'cancelled')
  const pendingApprovals = orders.filter((order) => order.status === 'awaiting_company_approval')
  const recent = orders.slice(0, 5)

  async function handleReorder(orderId: string) {
    setReorderingId(orderId)
    try {
      await doReorder({ data: { orderRequestId: orderId } })
      setReorderedId(orderId)
    } finally {
      setReorderingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="surface-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Open orders</p>
          <p className="text-3xl font-semibold text-foreground">{openOrders.length}</p>
        </div>
        {isAdmin ? (
          <div className="surface-card rounded-xl p-5">
            <p className="text-sm text-muted-foreground">Pending your approval</p>
            <p className="text-3xl font-semibold text-foreground">{pendingApprovals.length}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <a href="/account/orders" className="text-sm font-medium text-primary hover:underline">
          View all orders
        </a>
        {isAdmin ? (
          <a href="/account/users" className="text-sm font-medium text-primary hover:underline">
            Manage users
          </a>
        ) : null}
        <a href="/account/pricing" className="text-sm font-medium text-primary hover:underline">
          Pricing
        </a>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recent orders</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No orders yet.{' '}
            <a href="/categories" className="text-primary hover:underline">
              Browse the catalogue
            </a>{' '}
            to get started.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {recent.map((order: OrderRequestSummary) => (
              <div
                key={order.id}
                className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Order {order.id.slice(0, 8)}
                    {isAdmin && order.buyerName ? ` · ${order.buyerName}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.lineCount} line{order.lineCount === 1 ? '' : 's'} ·{' '}
                    {formatPrice(order.subtotalPence)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip
                    tone={ORDER_STATUS_DISPLAY[order.status]?.tone ?? 'info'}
                    label={ORDER_STATUS_DISPLAY[order.status]?.label ?? order.status}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => handleReorder(order.id)}
                    disabled={reorderingId === order.id}
                  >
                    {reorderedId === order.id
                      ? 'Added'
                      : reorderingId === order.id
                        ? 'Adding…'
                        : 'Reorder'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
