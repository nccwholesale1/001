import type { ReactNode } from 'react'
import type { SupportTicketView } from '../../server/support/support-view'
import { Container, Section } from './Layout'
import { StatusChip } from './StatusChip'

export const SUPPORT_STATUS_DISPLAY: Record<string, { label: string; tone: 'info' | 'success' | 'danger' | 'warning' }> = {
  open: { label: 'Open', tone: 'info' },
  awaiting_ncc: { label: 'Awaiting NCC', tone: 'info' },
  awaiting_customer: { label: 'Awaiting You', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
  escalated: { label: 'Escalated', tone: 'danger' },
}

const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order issue',
  account_issue: 'Account issue',
  site_issue: 'Site issue',
  other: 'Other',
}

export interface SupportTicketDetailProps {
  ticket: SupportTicketView
  /** The reply form / decision controls — differs per viewer (customer reply box, staff reply + internal note + resolve/escalate). */
  actions?: ReactNode
  bare?: boolean
}

/** Same visual family as OrderRequestDetail/ReturnDetail/QuoteDetail — a status header plus a body, here a message timeline instead of line items (PRD §6.19 "mirrors the return status view closely"). */
export function SupportTicketDetail({ ticket, actions, bare = false }: SupportTicketDetailProps) {
  const body = (
    <div className={bare ? 'flex flex-col gap-6' : 'mx-auto flex max-w-2xl flex-col gap-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={bare ? 'text-lg font-semibold text-foreground' : 'text-2xl font-semibold text-foreground'}>
          {CATEGORY_LABELS[ticket.category] ?? ticket.category}
        </h1>
        <StatusChip
          tone={SUPPORT_STATUS_DISPLAY[ticket.status]?.tone ?? 'info'}
          label={SUPPORT_STATUS_DISPLAY[ticket.status]?.label ?? ticket.status}
        />
      </div>

      <div role="log" aria-live="polite" className="flex flex-col gap-3">
        {ticket.messages.map((message) => (
          <div
            key={message.id}
            className={
              message.isInternalNote
                ? 'surface-card rounded-xl border border-dashed border-border bg-card p-4'
                : message.from === 'staff'
                  ? 'surface-card rounded-xl p-4'
                  : 'surface-card rounded-xl bg-secondary p-4'
            }
          >
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {message.isInternalNote
                  ? `Internal note${message.authorName ? ` · ${message.authorName}` : ''}`
                  : message.from === 'staff'
                    ? (message.authorName ?? 'NCC Support')
                    : 'You'}
              </span>
              <span>{new Date(message.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{message.message}</p>
          </div>
        ))}
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
