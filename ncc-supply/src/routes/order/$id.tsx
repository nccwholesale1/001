import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '../../server/db/client'
import { buildOrderRequestView, type OrderRequestView } from '../../server/orders/order-view'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { Container, Section } from '../../components/ui/Layout'
import { OrderRequestDetail } from '../../components/ui/OrderRequestDetail'

/**
 * Returns `null` uniformly for a missing token, wrong token, expired
 * token, revoked token, or a nonexistent order id — the caller can't tell
 * these apart, matching `verifyGuestToken`'s own no-enumeration contract
 * (CLAUDE.md rule 16, PRD rule 5).
 */
const getOrderRequestView = createServerFn({ method: 'GET' })
  .validator((input: { orderId: string; token: string }) => input)
  .handler(async ({ data }): Promise<OrderRequestView | null> => {
    const verification = await verifyGuestToken(db, data.token, 'order_request')
    if (!verification || verification.resourceId !== data.orderId) return null
    return buildOrderRequestView(db, data.orderId)
  })

const orderSearchSchema = z.object({ token: z.string().optional() })

export const Route = createFileRoute('/order/$id')({
  validateSearch: orderSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => {
    if (!deps.token) return null
    return getOrderRequestView({ data: { orderId: params.id, token: deps.token } })
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Order Status · NCC Supply' }],
  }),
  component: OrderStatusRoute,
})

function OrderStatusRoute() {
  const order = Route.useLoaderData()

  if (!order) {
    return (
      <Section>
        <Container className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h1 className="text-2xl font-semibold text-foreground">We couldn't find that order</h1>
          <p className="text-sm text-muted-foreground">
            The link may be incorrect, expired, or no longer valid. If you have a support query,{' '}
            <a href="/support" className="text-primary hover:underline">
              contact NCC
            </a>
            .
          </p>
        </Container>
      </Section>
    )
  }

  return <OrderRequestDetail order={order} />
}
