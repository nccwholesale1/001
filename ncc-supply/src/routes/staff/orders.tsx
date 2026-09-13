import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentStaff } from '../../server/staff/server-functions'
import { listStaffOrders } from '../../server/staff/order-console-server-functions'
import { StatusChip } from '../../components/ui/StatusChip'
import { ORDER_STATUS_DISPLAY } from '../../components/ui/OrderRequestDetail'
import { Container, Section } from '../../components/ui/Layout'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/** PRD §6.9 "Staff console" — queue sorted by submission time, ncc_admin (full) or sales_rep (read-only, assigned companies only). */
export const Route = createFileRoute('/staff/orders')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: () => listStaffOrders(),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Order Queue · NCC Staff' }] }),
  component: StaffOrdersRoute,
})

function StaffOrdersRoute() {
  const orders = Route.useLoaderData()

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-foreground">Order Queue</h1>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No order requests yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <a
                key={order.id}
                href={`/staff/order/${order.id}`}
                className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 no-underline hover:no-underline"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Order {order.id.slice(0, 8)}
                    {order.buyerName ? ` · ${order.buyerName}` : ' · Guest'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.lineCount} line{order.lineCount === 1 ? '' : 's'} · {formatPrice(order.subtotalPence)} ·{' '}
                    submitted {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip
                  tone={ORDER_STATUS_DISPLAY[order.status]?.tone ?? 'info'}
                  label={ORDER_STATUS_DISPLAY[order.status]?.label ?? order.status}
                />
              </a>
            ))}
          </div>
        )}
      </Container>
    </Section>
  )
}
