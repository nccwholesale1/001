import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCurrentActor } from '../../server/buyers/buyer-session'
import { db } from '../../server/db/client'
import { buildOrderRequestView, getOrderRequestViewForActor, type OrderRequestView } from '../../server/orders/order-view'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { Button } from '../../components/ui/Button'
import { Container, Section } from '../../components/ui/Layout'
import { OrderRequestDetail } from '../../components/ui/OrderRequestDetail'

/**
 * Dual access, same as the guest/buyer split used across the rest of the
 * order flow: a guest brings `?token=`, a signed-in buyer brings their own
 * session and no token at all. Either way the caller can't tell "wrong
 * token"/"not your order"/"doesn't exist" apart — all three land on the
 * same not-found rendering, matching PRD rule 5's no-enumeration contract.
 */
const checkoutQuerySchema = z.object({ orderId: z.string().min(1), token: z.string().optional() }).strict()

const getCheckoutView = createServerFn({ method: 'GET' })
  .validator(checkoutQuerySchema.parse)
  .handler(async ({ data }): Promise<OrderRequestView | null> => {
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'order_request')
      if (!verification || verification.resourceId !== data.orderId) return null
      return buildOrderRequestView(db, data.orderId)
    }

    const actor = await getCurrentActor(db)
    if (!actor) return null
    try {
      return await getOrderRequestViewForActor(db, actor, data.orderId)
    } catch {
      return null
    }
  })

const checkoutSearchSchema = z.object({ token: z.string().optional() })

/**
 * PRD §6.7/rule 4: "/checkout/:id returns the customer to the order view
 * unless the order status is confirmed." Guarded in the loader itself —
 * unconfirmed and not-found both redirect/404 before any payment-option UI
 * ever renders.
 */
export const Route = createFileRoute('/checkout/$id')({
  validateSearch: checkoutSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const order = await getCheckoutView({ data: { orderId: params.id, token: deps.token } })
    if (!order) throw notFound()
    if (order.status !== 'confirmed') {
      throw redirect(
        deps.token
          ? { to: '/order/$id', params: { id: params.id }, search: { token: deps.token } }
          : { to: '/account/orders' },
      )
    }
    return order
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }, { title: 'Checkout · NCC Supply' }] }),
  notFoundComponent: CheckoutNotFound,
  component: CheckoutRoute,
})

function CheckoutNotFound() {
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

function CheckoutRoute() {
  const order = Route.useLoaderData()

  return (
    <OrderRequestDetail
      order={order}
      actions={
        <div className="surface-card flex flex-col gap-4 rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground">How would you like to pay?</h2>
          <p className="text-sm text-muted-foreground">
            No card details are collected here — choose invoice payment or cash on delivery.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {order.invoiceUrl ? (
              <Button asChild>
                <a href={order.invoiceUrl} target="_blank" rel="noreferrer">
                  Pay by invoice
                </a>
              </Button>
            ) : (
              <Button disabled>Invoice link not ready yet</Button>
            )}
            <CashOnDeliveryButton />
          </div>
        </div>
      }
    />
  )
}

function CashOnDeliveryButton() {
  return (
    <details className="w-full sm:w-auto">
      <summary className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary sm:w-auto [&::-webkit-details-marker]:hidden">
        Cash on delivery
      </summary>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground">
        No online payment needed — NCC will confirm cash on delivery when your order arrives.
      </p>
    </details>
  )
}
