import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import { getCurrentStaff } from '../../../server/staff/server-functions'
import {
  getQuoteCustomerLink,
  getStaffQuoteDetail,
  issueStaffQuote,
} from '../../../server/quotes/staff-quote-server-functions'
import { Button } from '../../../components/ui/Button'
import { Container, Section } from '../../../components/ui/Layout'
import { StatusChip } from '../../../components/ui/StatusChip'
import { QUOTE_STATUS_DISPLAY } from '../../../components/ui/QuoteDetail'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function poundsToPence(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export const Route = createFileRoute('/staff/quote/$id')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: async ({ params }) => {
    const staff = await getCurrentStaff()
    let quote
    try {
      quote = await getStaffQuoteDetail({ data: { quoteId: params.id } })
    } catch {
      throw redirect({ to: '/staff/quotes' })
    }
    if (!quote) throw notFound()
    return { quote, isNccAdmin: staff?.role === 'ncc_admin' }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Quote Review · NCC Staff' }] }),
  component: StaffQuoteDetailRoute,
})

function StaffQuoteDetailRoute() {
  const { quote: initialQuote, isNccAdmin } = Route.useLoaderData()
  const [quote, setQuote] = useState(initialQuote)
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      quote.lines.map((line) => [
        line.id,
        line.quotedUnitPricePence !== null ? String(line.quotedUnitPricePence / 100) : '',
      ]),
    ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const issue = useServerFn(issueStaffQuote)
  const fetchCustomerLink = useServerFn(getQuoteCustomerLink)
  const refreshDetail = useServerFn(getStaffQuoteDetail)

  const subtotalPence = useMemo(
    () => quote.lines.reduce((sum, line) => sum + poundsToPence(prices[line.id] ?? '0') * line.requestedQuantity, 0),
    [quote.lines, prices],
  )

  const canPrice = isNccAdmin && quote.status === 'requested'

  async function refresh() {
    const fresh = await refreshDetail({ data: { quoteId: quote.id } })
    if (fresh) setQuote(fresh)
  }

  async function handleIssue() {
    setBusy(true)
    setError(null)
    try {
      await issue({
        data: {
          quoteId: quote.id,
          lines: quote.lines.map((line) => ({
            quoteLineId: line.id,
            quotedUnitPricePence: poundsToPence(prices[line.id] ?? '0'),
          })),
        },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue this quote.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await fetchCustomerLink({ data: { quoteId: quote.id } })
      if (!url) {
        setError('This quote has no guest link — it belongs to a signed-in company buyer.')
        return
      }
      await navigator.clipboard.writeText(`${window.location.origin}${url}`)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a customer link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Quote {quote.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              {quote.buyerUserId
                ? 'Company buyer quote'
                : quote.guestContactEmail
                  ? `Guest · ${quote.guestContactEmail}`
                  : 'Guest · no contact details provided'}
            </p>
          </div>
          <StatusChip
            tone={QUOTE_STATUS_DISPLAY[quote.status]?.tone ?? 'info'}
            label={QUOTE_STATUS_DISPLAY[quote.status]?.label ?? quote.status}
          />
        </div>

        {!isNccAdmin ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Read-only — only an NCC admin can price or issue this quote.
          </p>
        ) : null}

        <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lines</h2>
          {quote.lines.map((line) => (
            <div
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{line.title}</p>
                <p className="text-xs text-muted-foreground">
                  SKU {line.sku} · requested {line.requestedQuantity}
                </p>
              </div>
              {canPrice ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground" htmlFor={`price-${line.id}`}>
                    Unit price (£)
                  </label>
                  <input
                    id={`price-${line.id}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={prices[line.id] ?? ''}
                    onChange={(event) => setPrices((prev) => ({ ...prev, [line.id]: event.target.value }))}
                    className="w-24 rounded-lg border border-input bg-card px-2 py-1 text-sm"
                  />
                </div>
              ) : (
                <p className="text-sm text-foreground">
                  {line.quotedUnitPricePence !== null ? `${formatPrice(line.quotedUnitPricePence)} ea` : 'Not yet priced'}
                </p>
              )}
            </div>
          ))}
        </div>

        {canPrice ? (
          <div className="surface-card flex flex-col gap-4 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Issue Quote</h2>
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
              <span>Subtotal (ex VAT)</span>
              <span>{formatPrice(subtotalPence)}</span>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button onClick={handleIssue} disabled={busy} className="w-fit">
              {busy ? 'Issuing…' : 'Issue quote'}
            </Button>
          </div>
        ) : null}

        {quote.status !== 'requested' && isNccAdmin ? (
          <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
            <Button variant="secondary" onClick={handleCopyLink} disabled={busy} className="w-fit">
              {linkCopied ? 'Copied!' : 'Copy customer link'}
            </Button>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Container>
    </Section>
  )
}
