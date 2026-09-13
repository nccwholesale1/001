import type { ReactNode } from 'react'
import type { ReturnView } from '../../server/returns/return-view'
import { Container, Section } from './Layout'
import { StatusChip } from './StatusChip'

export const RETURN_STATUS_DISPLAY: Record<string, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  requested: { label: 'Requested', tone: 'info' },
  under_review: { label: 'Under Review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'success' },
  replacement_sent: { label: 'Replacement Sent', tone: 'success' },
}

const REASON_LABELS: Record<string, string> = {
  damaged: 'Damaged',
  wrong_item: 'Wrong item',
  no_longer_needed: 'No longer needed',
  other: 'Other',
}

export interface ReturnDetailProps {
  ret: ReturnView
  actions?: ReactNode
  bare?: boolean
}

export function ReturnDetail({ ret, actions, bare = false }: ReturnDetailProps) {
  const body = (
    <div className={bare ? 'flex flex-col gap-6' : 'mx-auto flex max-w-2xl flex-col gap-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={bare ? 'text-lg font-semibold text-foreground' : 'text-2xl font-semibold text-foreground'}>
          Return status
        </h1>
        <StatusChip
          tone={RETURN_STATUS_DISPLAY[ret.status]?.tone ?? 'info'}
          label={RETURN_STATUS_DISPLAY[ret.status]?.label ?? ret.status}
        />
      </div>

      {ret.status === 'requested' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          Your return request has been received — no refund or replacement is confirmed yet.
        </p>
      ) : null}
      {ret.status === 'under_review' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          NCC is reviewing this return.
        </p>
      ) : null}
      {ret.status === 'rejected' && ret.rejectionReason ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          Not approved: {ret.rejectionReason}
        </p>
      ) : null}
      {ret.status === 'approved' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          Approved — NCC will {ret.resolution === 'replacement' ? 'send a replacement' : 'process a refund'} shortly.
        </p>
      ) : null}
      {ret.status === 'refunded' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Your refund has been processed.</p>
      ) : null}
      {ret.status === 'replacement_sent' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">Your replacement has been sent.</p>
      ) : null}

      <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Reason: {REASON_LABELS[ret.reason] ?? ret.reason}
        </h2>
        {ret.note ? <p className="text-sm text-muted-foreground">"{ret.note}"</p> : null}
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {ret.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{line.title}</span>
              <span className="text-muted-foreground">
                SKU {line.sku} · qty {line.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

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
