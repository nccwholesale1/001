import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import { getCurrentStaff } from '../../../server/staff/server-functions'
import {
  approveOrder,
  cancelStaffOrder,
  getOrderCustomerLink,
  getStaffOrderDetail,
  retryOrderShopifySync,
} from '../../../server/staff/order-console-server-functions'
import { Button } from '../../../components/ui/Button'
import { Field, TextareaField } from '../../../components/ui/Field'
import { Container, Section } from '../../../components/ui/Layout'
import { StatusChip } from '../../../components/ui/StatusChip'
import { ORDER_STATUS_DISPLAY } from '../../../components/ui/OrderRequestDetail'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

function poundsToPence(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

export const Route = createFileRoute('/staff/order/$id')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: async ({ params }) => {
    const staff = await getCurrentStaff()
    // A sales rep outside this order's company gets ForbiddenError, not a
    // rendered view — sent back to the queue they can actually see rather
    // than the generic error boundary (they're an authenticated staff
    // member, not an anonymous guest, so there's no enumeration concern in
    // being straightforward here, unlike the guest-token uniform-null rule).
    let order
    try {
      order = await getStaffOrderDetail({ data: { orderRequestId: params.id } })
    } catch {
      throw redirect({ to: '/staff/orders' })
    }
    if (!order) throw notFound()
    return { order, isNccAdmin: staff?.role === 'ncc_admin' }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Order Review · NCC Staff' }] }),
  component: StaffOrderDetailRoute,
})

function StaffOrderDetailRoute() {
  const { order: initialOrder, isNccAdmin } = Route.useLoaderData()
  const [order, setOrder] = useState(initialOrder)
  const [confirmedQuantities, setConfirmedQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.lines.map((line) => [line.id, line.confirmedQuantity ?? line.requestedQuantity])),
  )
  const [deliveryInput, setDeliveryInput] = useState(order.deliveryPence !== null ? String(order.deliveryPence / 100) : '0')
  const [internalNotes, setInternalNotes] = useState(order.internalNotes ?? '')
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const approve = useServerFn(approveOrder)
  const cancel = useServerFn(cancelStaffOrder)
  const retrySync = useServerFn(retryOrderShopifySync)
  const fetchCustomerLink = useServerFn(getOrderCustomerLink)
  const refreshDetail = useServerFn(getStaffOrderDetail)

  const subtotalPence = useMemo(
    () => order.lines.reduce((sum, line) => sum + line.unitPricePence * (confirmedQuantities[line.id] ?? 0), 0),
    [order.lines, confirmedQuantities],
  )
  const deliveryPence = poundsToPence(deliveryInput)
  // Prices are VAT-inclusive, so VAT is never added on top (PRD §14 A2).
  const finalTotalPence = subtotalPence + deliveryPence

  const canDecide = isNccAdmin && order.status === 'awaiting_ncc_review'
  const needsShopifySync = order.status === 'confirmed' && (!order.shopifyDraftOrderId || !order.invoiceUrl)

  async function refresh() {
    const fresh = await refreshDetail({ data: { orderRequestId: order.id } })
    if (fresh) setOrder(fresh)
  }

  async function handleApprove() {
    setBusy(true)
    setError(null)
    try {
      await approve({
        data: {
          orderRequestId: order.id,
          lines: order.lines.map((line) => ({
            orderRequestLineId: line.id,
            confirmedQuantity: confirmedQuantities[line.id] ?? 0,
          })),
          deliveryPence,
          finalTotalPence,
          internalNotes: internalNotes.trim() || undefined,
        },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve this order.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setError('A cancellation reason is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await cancel({ data: { orderRequestId: order.id, reason: cancelReason.trim() } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this order.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRetrySync() {
    setBusy(true)
    setError(null)
    try {
      await retrySync({ data: { orderRequestId: order.id } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync to Shopify.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await fetchCustomerLink({ data: { orderRequestId: order.id } })
      if (!url) {
        setError('This order has no guest link — it belongs to a signed-in company buyer.')
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

  const canMutate = isNccAdmin && order.status !== 'cancelled'

  return (
    <Section>
      <Container className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Order {order.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              {order.buyerUserId
                ? 'Company buyer order'
                : order.guestContactEmail
                  ? `Guest · ${order.guestContactEmail}`
                  : 'Guest · no contact details provided'}
            </p>
          </div>
          <StatusChip
            tone={ORDER_STATUS_DISPLAY[order.status]?.tone ?? 'info'}
            label={ORDER_STATUS_DISPLAY[order.status]?.label ?? order.status}
          />
        </div>

        {!isNccAdmin ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Read-only — only an NCC admin can approve, cancel, or sync this order.
          </p>
        ) : null}

        {order.status === 'awaiting_company_approval' ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Still waiting on the buyer's own company admin — not yet ready for NCC review.
          </p>
        ) : null}

        {order.cancelledReason ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            Cancelled: {order.cancelledReason}
          </p>
        ) : null}

        <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lines</h2>
          {order.lines.map((line) => (
            <div key={line.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-foreground">{line.title}</p>
                <p className="text-xs text-muted-foreground">
                  SKU {line.sku} · {formatPrice(line.unitPricePence)} ea · requested {line.requestedQuantity}
                </p>
              </div>
              {canDecide ? (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground" htmlFor={`qty-${line.id}`}>
                    Confirmed qty
                  </label>
                  <input
                    id={`qty-${line.id}`}
                    type="number"
                    min={0}
                    max={line.requestedQuantity}
                    value={confirmedQuantities[line.id] ?? 0}
                    onChange={(event) =>
                      setConfirmedQuantities((prev) => ({
                        ...prev,
                        [line.id]: Math.max(0, Math.min(line.requestedQuantity, Number(event.target.value) || 0)),
                      }))
                    }
                    className="w-20 rounded-lg border border-input bg-card px-2 py-1 text-sm"
                  />
                </div>
              ) : (
                <p className="text-sm text-foreground">
                  {line.confirmedQuantity !== null ? `Confirmed ${line.confirmedQuantity}` : 'Not yet confirmed'}
                </p>
              )}
            </div>
          ))}
        </div>

        {canDecide ? (
          <div className="surface-card flex flex-col gap-4 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Confirm Order</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Delivery (£)" inputMode="decimal" value={deliveryInput} onChange={(e) => setDeliveryInput(e.target.value)} />
            </div>
            <TextareaField
              label="Internal notes"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              helpText="Staff-only — never shown to the customer."
            />
            <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
              <span>Final total</span>
              <span>{formatPrice(finalTotalPence)}</span>
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleApprove} disabled={busy}>
                {busy ? 'Approving…' : 'Approve'}
              </Button>
            </div>
          </div>
        ) : null}

        {order.status === 'confirmed' ? (
          <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Confirmed totals</h2>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Delivery</span>
              <span>{formatPrice(order.deliveryPence ?? 0)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
              <span>Final total</span>
              <span>{formatPrice(order.finalTotalPence ?? 0)}</span>
            </div>
            {order.internalNotes ? (
              <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">Notes: {order.internalNotes}</p>
            ) : null}

            {needsShopifySync ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">Shopify sync incomplete — no draft order/invoice yet.</p>
                {isNccAdmin ? (
                  <Button variant="secondary" className="mt-2" onClick={handleRetrySync} disabled={busy}>
                    {busy ? 'Retrying…' : 'Retry Shopify sync'}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-foreground">
                Invoice link:{' '}
                <a href={order.invoiceUrl ?? '#'} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  {order.invoiceUrl}
                </a>
              </p>
            )}
          </div>
        ) : null}

        {canMutate ? (
          <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleCopyLink} disabled={busy}>
                {linkCopied ? 'Copied!' : 'Copy customer link'}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field
                label="Cancellation reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="max-w-xs"
              />
              <Button variant="secondary" onClick={handleCancel} disabled={busy}>
                Cancel order
              </Button>
            </div>
          </div>
        ) : null}

        {error && !canDecide ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </Container>
    </Section>
  )
}
