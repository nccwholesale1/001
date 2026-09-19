import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentStaff } from '../../server/staff/server-functions'
import { listStaffOrders } from '../../server/staff/order-console-server-functions'
import { listStaffQuotes } from '../../server/quotes/staff-quote-server-functions'
import { listStaffReturns } from '../../server/returns/staff-return-server-functions'
import { listStaffSupportTickets } from '../../server/support/staff-support-server-functions'
import { Container, Section } from '../../components/ui/Layout'
import { StaffNav } from '../../components/ui/StaffNav'

/**
 * Every queue already applies its own least-privilege filtering (rule 17) —
 * a sales rep's lists only ever contain their assigned companies — so these
 * counts are derived from the same data the rep is allowed to see, never
 * from a privileged aggregate query that would leak the real totals.
 */
interface QueueCard {
  label: string
  href: string
  waiting: number
  total: number
  /** What "waiting" means for this queue, so a number is never ambiguous. */
  waitingLabel: string
}

const dashboard = async (): Promise<{ queues: QueueCard[] }> => {
  const [orders, quotes, returns, tickets] = await Promise.all([
    listStaffOrders(),
    listStaffQuotes(),
    listStaffReturns(),
    listStaffSupportTickets(),
  ])

  return {
    queues: [
      {
        label: 'Orders',
        href: '/staff/orders',
        waiting: orders.filter((o) => o.status === 'awaiting_ncc_review').length,
        total: orders.length,
        waitingLabel: 'awaiting NCC review',
      },
      {
        label: 'Quotes',
        href: '/staff/quotes',
        waiting: quotes.filter((q) => q.status === 'requested').length,
        total: quotes.length,
        waitingLabel: 'awaiting a price',
      },
      {
        label: 'Returns',
        href: '/staff/returns',
        waiting: returns.filter((r) => r.status === 'requested' || r.status === 'under_review').length,
        total: returns.length,
        waitingLabel: 'awaiting a decision',
      },
      {
        label: 'Support',
        href: '/staff/support',
        waiting: tickets.filter((t) => t.status === 'open' || t.status === 'awaiting_ncc' || t.status === 'escalated')
          .length,
        total: tickets.length,
        waitingLabel: 'awaiting a reply',
      },
    ],
  }
}

/**
 * The staff console's landing page. Until this existed, signing in left
 * staff on a route with nothing on it and no indication of which queue
 * needed them — every section was reachable only by knowing its URL.
 */
export const Route = createFileRoute('/staff/')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: async () => {
    const staff = await getCurrentStaff()
    const { queues } = await dashboard()
    return { queues, isNccAdmin: staff?.role === 'ncc_admin' }
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Staff Dashboard · NCC Supply' }],
  }),
  component: StaffDashboardRoute,
})

function StaffDashboardRoute() {
  const { queues, isNccAdmin } = Route.useLoaderData()
  const totalWaiting = queues.reduce((sum, queue) => sum + queue.waiting, 0)

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <StaffNav />

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Staff dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {totalWaiting === 0
              ? 'Nothing is waiting on you right now.'
              : `${totalWaiting} item${totalWaiting === 1 ? '' : 's'} waiting on you.`}
            {isNccAdmin ? '' : ' Showing only the companies assigned to you.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {queues.map((queue) => (
            <a
              key={queue.href}
              href={queue.href}
              className="surface-card flex flex-col gap-1 rounded-xl p-5 no-underline hover:no-underline"
            >
              <span className="text-sm font-semibold text-foreground">{queue.label}</span>
              <span
                className={
                  queue.waiting > 0
                    ? 'text-3xl font-semibold text-primary'
                    : 'text-3xl font-semibold text-muted-foreground'
                }
              >
                {queue.waiting}
              </span>
              <span className="text-xs text-muted-foreground">{queue.waitingLabel}</span>
              <span className="mt-2 text-xs text-muted-foreground">
                {queue.total} total
              </span>
            </a>
          ))}
        </div>

        {!isNccAdmin ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Your access is read-only. Approving orders, pricing quotes and deciding returns are NCC admin actions.
          </p>
        ) : null}
      </Container>
    </Section>
  )
}
