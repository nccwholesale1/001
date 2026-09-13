import type { ReactNode } from 'react'
import type { QuoteView } from '../../server/quotes/quote-view'
import { Container, Section } from './Layout'
import { StatusChip } from './StatusChip'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export const QUOTE_STATUS_DISPLAY: Record<string, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  requested: { label: 'Requested', tone: 'info' },
  quoted: { label: 'Quoted', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  expired: { label: 'Expired', tone: 'danger' },
}

export interface QuoteDetailProps {
  quote: QuoteView
  /** "Accept Quote" control, shown only when the caller has decided it's appropriate (quoted, not expired). */
  actions?: ReactNode
  bare?: boolean
}

export function QuoteDetail({ quote, actions, bare = false }: QuoteDetailProps) {
  const allPriced = quote.lines.length > 0 && quote.lines.every((line) => line.quotedUnitPricePence !== null)
  const subtotalPence = allPriced
    ? quote.lines.reduce((sum, line) => sum + (line.quotedUnitPricePence ?? 0) * line.requestedQuantity, 0)
    : null

  const body = (
    <div className={bare ? 'flex flex-col gap-6' : 'mx-auto flex max-w-2xl flex-col gap-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={bare ? 'text-lg font-semibold text-foreground' : 'text-2xl font-semibold text-foreground'}>
          Quote status
        </h1>
        <StatusChip
          tone={QUOTE_STATUS_DISPLAY[quote.status]?.tone ?? 'info'}
          label={QUOTE_STATUS_DISPLAY[quote.status]?.label ?? quote.status}
        />
      </div>

      {quote.status === 'requested' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          NCC is preparing pricing for this request — no availability or price is confirmed yet.
        </p>
      ) : null}
      {quote.status === 'quoted' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          NCC has priced this quote{quote.expiresAt ? ` — valid until ${new Date(quote.expiresAt).toLocaleDateString()}` : ''}.
          Accept it to submit it for review as an order.
        </p>
      ) : null}
      {quote.status === 'expired' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          This quote has expired. Submit a new request if you'd still like these lines priced.
        </p>
      ) : null}
      {quote.status === 'accepted' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          This quote was accepted and is now an order awaiting review.
        </p>
      ) : null}

      <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
        {quote.lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium text-foreground">{line.title}</p>
              <p className="text-xs text-muted-foreground">SKU {line.sku}</p>
            </div>
            <div className="text-right">
              <p className="text-foreground">
                {line.requestedQuantity}{' '}
                × {line.quotedUnitPricePence !== null ? formatPrice(line.quotedUnitPricePence) : 'Pricing pending'}
              </p>
            </div>
          </div>
        ))}
        {subtotalPence !== null ? (
          <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
            <span>Subtotal (ex VAT)</span>
            <span>{formatPrice(subtotalPence)}</span>
          </div>
        ) : null}
      </div>

      {quote.guestContactEmail || quote.guestContactName ? (
        <div className="text-sm text-muted-foreground">
          <p>Contact: {quote.guestContactName ?? '—'}</p>
          <p>{quote.guestContactEmail ?? ''}</p>
        </div>
      ) : null}

      {quote.referringSalesRepId ? (
        <p className="text-sm text-muted-foreground">
          Referred by sales rep: <span className="font-medium text-foreground">{quote.referringSalesRepId}</span>
        </p>
      ) : null}

      {actions}
    </div>
  )

  if (bare) return body
  return (
    <Section>
      <Container>{body}</Container>
    </Section>
  )
}
