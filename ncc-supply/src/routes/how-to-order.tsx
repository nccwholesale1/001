import { createFileRoute } from '@tanstack/react-router'
import { PackageSearch, UserCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Container, Section } from '../components/ui/Layout'
import { OrderSteps } from '../components/ui/OrderSteps'

export const Route = createFileRoute('/how-to-order')({
  head: () => ({
    meta: [
      { title: 'How Ordering Works — Submit, Confirm, Pay · NCC Supply' },
      {
        name: 'description',
        content:
          'NCC works on a confirm-then-pay basis: submit your basket with no payment, NCC confirms quantities and delivery, and only then is checkout available.',
      },
    ],
  }),
  component: HowToOrderRoute,
})

/**
 * PRD §3 lists `/how-to-order` as the ordering workflow explainer; the copy
 * here restates PRD §4's flow and numbered rules only — no return window,
 * SLA, or other still-open policy is stated (DECISIONS.md "Still awaiting
 * business confirmation"). The five steps reuse `OrderSteps` rather than
 * restating the flow a second time, so the homepage and this page can never
 * drift apart.
 */
function HowToOrderRoute() {
  return (
    <>
      <Section>
        <Container className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">How ordering works</h1>
          <p className="max-w-3xl text-base text-muted-foreground">
            NCC works on a confirm-then-pay basis. You agree the full total, including delivery,
            before any money changes hands, and no card details are ever taken when you submit
            a basket.
          </p>
        </Container>
      </Section>

      <Section tinted className="pt-0">
        <Container className="flex flex-col gap-8 pt-20">
          <OrderSteps variant="full" columns={2} />
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-6">
          <div className="surface-card flex flex-col gap-3 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="sky-gradient flex h-10 w-10 items-center justify-center rounded-lg">
                <Icon icon={UserCheck} size="md" className="text-ink-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Buying on a company account
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              If you order under a company account, your basket goes to your own company
              administrator for approval before it reaches NCC — every time, on every order, whatever
              the value. You will see a clear pending-approval state while it waits. Guest orders
              skip only that company step; they still go through NCC review in exactly the same way.
            </p>
          </div>

          <div className="surface-card flex flex-col gap-3 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <div className="sky-gradient flex h-10 w-10 items-center justify-center rounded-lg">
                <Icon icon={PackageSearch} size="md" className="text-ink-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                What &ldquo;available to order&rdquo; means
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This site never displays live inventory counts. A line marked available to order is one
              NCC actively supplies — the quantity we can fulfil is confirmed when your basket is
              reviewed. If a quantity cannot be met, NCC reduces or removes that line during review
              and you see the change on your order before anything is payable. Quantities are never
              silently increased.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="/categories">Start your basket</a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/bulk-order">Upload a bulk order</a>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
