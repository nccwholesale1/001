import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentStaff } from '../../server/staff/server-functions'
import { listStaffQuotes } from '../../server/quotes/staff-quote-server-functions'
import { StatusChip } from '../../components/ui/StatusChip'
import { QUOTE_STATUS_DISPLAY } from '../../components/ui/QuoteDetail'
import { Container, Section } from '../../components/ui/Layout'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/** PRD §6.14 "Staff: quote queue" — mirrors /staff/orders exactly: ncc_admin (full) or sales_rep (read-only, assigned companies only). */
export const Route = createFileRoute('/staff/quotes')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: () => listStaffQuotes(),
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Quote Queue · NCC Staff' }] }),
  component: StaffQuotesRoute,
})

function StaffQuotesRoute() {
  const quoteList = Route.useLoaderData()

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-foreground">Quote Queue</h1>
        {quoteList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quote requests yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {quoteList.map((quote) => (
              <a
                key={quote.id}
                href={`/staff/quote/${quote.id}`}
                className="surface-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 no-underline hover:no-underline"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Quote {quote.id.slice(0, 8)}
                    {quote.buyerName ? ` · ${quote.buyerName}` : ' · Guest'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {quote.lineCount} line{quote.lineCount === 1 ? '' : 's'}
                    {quote.subtotalPence !== null ? ` · ${formatPrice(quote.subtotalPence)}` : ' · not yet priced'} ·{' '}
                    requested {new Date(quote.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip
                  tone={QUOTE_STATUS_DISPLAY[quote.status]?.tone ?? 'info'}
                  label={QUOTE_STATUS_DISPLAY[quote.status]?.label ?? quote.status}
                />
              </a>
            ))}
          </div>
        )}
      </Container>
    </Section>
  )
}
