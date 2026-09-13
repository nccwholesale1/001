import type { ReactNode } from 'react'
import type { OrderRequestView } from '../../server/orders/order-view'
import { Container, Section } from './Layout'
import { StatusChip } from './StatusChip'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export const ORDER_STATUS_DISPLAY: Record<string, { label: string; tone: 'info' | 'success' | 'danger' }> = {
  awaiting_company_approval: { label: 'Awaiting Company Approval', tone: 'info' },
  awaiting_ncc_review: { label: 'Awaiting NCC Review', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
}

export interface OrderRequestDetailProps {
  order: OrderRequestView
  /** e.g. "Placed by Jane Doe" on a company admin's all-orders view — omitted on a buyer's own view. */
  placedByLabel?: string
  /** Approve/reject controls, shown only to a company admin on a pending order. */
  actions?: ReactNode
  /** Wrap in the page's own Section/Container (the guest order-status page) vs. render bare (an already-wrapped table row). */
  bare?: boolean
}

export function OrderRequestDetail({ order, placedByLabel, actions, bare = false }: OrderRequestDetailProps) {
  const subtotalPence = order.lines.reduce(
    (sum, line) => sum + line.unitPricePence * (line.confirmedQuantity ?? line.requestedQuantity),
    0,
  )

  const body = (
    <div className={bare ? 'flex flex-col gap-6' : 'mx-auto flex max-w-2xl flex-col gap-6'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={bare ? 'text-lg font-semibold text-foreground' : 'text-2xl font-semibold text-foreground'}>
          Order status
        </h1>
        <StatusChip
          tone={ORDER_STATUS_DISPLAY[order.status]?.tone ?? 'info'}
          label={ORDER_STATUS_DISPLAY[order.status]?.label ?? order.status}
        />
      </div>

      {placedByLabel ? <p className="text-sm text-muted-foreground">{placedByLabel}</p> : null}

      {order.status === 'awaiting_company_approval' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          Waiting on your company admin's approval before this reaches NCC — no payment is needed
          yet.
        </p>
      ) : null}
      {order.status === 'awaiting_ncc_review' ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          NCC is reviewing your order. Quantities, delivery and VAT will be confirmed here — no
          payment is needed until then.
        </p>
      ) : null}
      {order.status === 'cancelled' && order.cancelledReason ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
          {order.cancelledReason}
        </p>
      ) : null}

      <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
        {order.lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between gap-4 text-sm">
            <div>
              <p className="font-medium text-foreground">{line.title}</p>
              <p className="text-xs text-muted-foreground">SKU {line.sku}</p>
            </div>
            <div className="text-right">
              <p className="text-foreground">
                {line.confirmedQuantity !== null ? (
                  <>
                    <span className="text-muted-foreground line-through">{line.requestedQuantity}</span>{' '}
                    {line.confirmedQuantity}
                  </>
                ) : (
                  line.requestedQuantity
                )}{' '}
                × {formatPrice(line.unitPricePence)}
              </p>
            </div>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
          <span>Subtotal (ex VAT)</span>
          <span>{formatPrice(subtotalPence)}</span>
        </div>
        {order.deliveryPence !== null || order.vatPence !== null ? (
          <>
            {order.deliveryPence !== null ? (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery</span>
                <span>{formatPrice(order.deliveryPence)}</span>
              </div>
            ) : null}
            {order.vatPence !== null ? (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>VAT</span>
                <span>{formatPrice(order.vatPence)}</span>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Delivery and VAT will be confirmed by NCC.</p>
        )}
        {order.finalTotalPence !== null ? (
          <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
            <span>Final total</span>
            <span>{formatPrice(order.finalTotalPence)}</span>
          </div>
        ) : null}
      </div>

      {order.guestContactEmail || order.guestContactName ? (
        <div className="text-sm text-muted-foreground">
          <p>Contact: {order.guestContactName ?? '—'}</p>
          <p>{order.guestContactEmail ?? ''}</p>
        </div>
      ) : null}

      {order.referringSalesRepId ? (
        <p className="text-sm text-muted-foreground">
          Referred by sales rep: <span className="font-medium text-foreground">{order.referringSalesRepId}</span>
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
