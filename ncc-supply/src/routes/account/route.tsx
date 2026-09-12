import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getCurrentBuyerSummary } from '../../server/buyers/server-functions'
import { Container, Section } from '../../components/ui/Layout'

const NAV_LINK_CLASS =
  'rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary'

export const Route = createFileRoute('/account')({
  loader: async () => {
    const summary = await getCurrentBuyerSummary()
    if (!summary) throw redirect({ to: '/auth' })
    return summary
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  component: AccountLayout,
})

function AccountLayout() {
  const summary = Route.useLoaderData()
  const isAdmin = summary.role === 'company_admin'

  return (
    <Section>
      <Container className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-1">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">{summary.companyName}</p>
            <p className="text-xs text-muted-foreground">
              {summary.buyerName} · {isAdmin ? 'Company admin' : 'Buyer'}
            </p>
          </div>
          <a href="/account" className={NAV_LINK_CLASS}>
            Dashboard
          </a>
          <a href="/account/orders" className={NAV_LINK_CLASS}>
            Orders
          </a>
          {isAdmin ? (
            <a href="/account/users" className={NAV_LINK_CLASS}>
              Users
            </a>
          ) : null}
          <a href="/account/pricing" className={NAV_LINK_CLASS}>
            Pricing
          </a>
        </aside>
        <div>
          <Outlet />
        </div>
      </Container>
    </Section>
  )
}
