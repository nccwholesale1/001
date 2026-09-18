import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Container, Section } from '../components/ui/Layout'

const orderSubmittedSearchSchema = z.object({
  orderId: z.string().min(1),
  token: z.string().min(1),
})

export const Route = createFileRoute('/order-submitted')({
  validateSearch: orderSubmittedSearchSchema,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Order Submitted · NCC Supply' }],
  }),
  component: OrderSubmittedRoute,
})

function OrderSubmittedRoute() {
  const { orderId, token } = Route.useSearch()
  const statusHref = `/order/${orderId}?token=${encodeURIComponent(token)}`

  return (
    <Section>
      <Container className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold text-foreground">
          Your Order Request Has Been Submitted
        </h1>
        <p className="text-sm text-muted-foreground">
          No payment has been taken. NCC will review your order, confirm quantities and delivery,
          and you'll be able to pay only once it's confirmed.
        </p>
        <div className="surface-card w-full rounded-xl p-6">
          <p className="text-sm font-semibold text-foreground">Save your private order link</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the only way to check your order's status — it isn't emailed automatically in
            this phase, so bookmark it now.
          </p>
          <a
            href={statusHref}
            className="mt-3 block break-all rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-primary hover:underline"
          >
            {statusHref}
          </a>
        </div>
        <a
          href="/"
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to home
        </a>
      </Container>
    </Section>
  )
}
