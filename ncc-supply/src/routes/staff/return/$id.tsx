import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getCurrentStaff } from '../../../server/staff/server-functions'
import {
  beginStaffReturnReview,
  decideStaffReturn,
  getReturnCustomerLink,
  getStaffReturnDetail,
  markStaffReturnOutcome,
} from '../../../server/returns/staff-return-server-functions'
import { getAttachmentDataUrl } from '../../../server/attachments/server-functions'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import { Container, Section } from '../../../components/ui/Layout'
import { StatusChip } from '../../../components/ui/StatusChip'
import { RETURN_STATUS_DISPLAY } from '../../../components/ui/ReturnDetail'

const REASON_LABELS: Record<string, string> = {
  damaged: 'Damaged',
  wrong_item: 'Wrong item',
  no_longer_needed: 'No longer needed',
  other: 'Other',
}

export const Route = createFileRoute('/staff/return/$id')({
  beforeLoad: async () => {
    const staff = await getCurrentStaff()
    if (!staff) throw redirect({ to: '/staff-login' })
  },
  loader: async ({ params }) => {
    const staff = await getCurrentStaff()
    let ret
    try {
      ret = await getStaffReturnDetail({ data: { returnId: params.id } })
    } catch {
      throw redirect({ to: '/staff/returns' })
    }
    if (!ret) throw notFound()
    return { ret, isNccAdmin: staff?.role === 'ncc_admin' }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Return Review · NCC Staff' }] }),
  component: StaffReturnDetailRoute,
})

function StaffReturnDetailRoute() {
  const { ret: initialReturn, isNccAdmin } = Route.useLoaderData()
  const [ret, setRet] = useState(initialReturn)
  const [resolution, setResolution] = useState<'refund' | 'replacement'>('refund')
  const [rejectionReason, setRejectionReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)

  const beginReview = useServerFn(beginStaffReturnReview)
  const decide = useServerFn(decideStaffReturn)
  const markOutcome = useServerFn(markStaffReturnOutcome)
  const fetchCustomerLink = useServerFn(getReturnCustomerLink)
  const fetchAttachment = useServerFn(getAttachmentDataUrl)
  const refreshDetail = useServerFn(getStaffReturnDetail)

  async function refresh() {
    const fresh = await refreshDetail({ data: { returnId: ret.id } })
    if (fresh) setRet(fresh)
  }

  async function handleBeginReview() {
    setBusy(true)
    setError(null)
    try {
      await beginReview({ data: { returnId: ret.id } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start review.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDecision(decision: 'approve' | 'reject') {
    if (decision === 'reject' && !rejectionReason.trim()) {
      setError('A rejection reason is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await decide({
        data: {
          returnId: ret.id,
          decision,
          resolution: decision === 'approve' ? resolution : undefined,
          rejectionReason: decision === 'reject' ? rejectionReason.trim() : undefined,
        },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that decision.')
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkOutcome(outcome: 'refunded' | 'replacement_sent') {
    setBusy(true)
    setError(null)
    try {
      await markOutcome({ data: { returnId: ret.id, outcome } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record that outcome.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink() {
    setBusy(true)
    setError(null)
    try {
      const { url } = await fetchCustomerLink({ data: { returnId: ret.id } })
      if (!url) {
        setError('This return has no guest link — it belongs to a signed-in company buyer.')
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

  async function handleViewAttachment() {
    if (!ret.attachmentId) return
    const result = await fetchAttachment({ data: { attachmentId: ret.attachmentId } })
    if (result) setAttachmentUrl(result.dataUrl)
  }

  const canBeginReview = isNccAdmin && ret.status === 'requested'
  const canDecide = isNccAdmin && ret.status === 'under_review'
  const canMarkOutcome = isNccAdmin && ret.status === 'approved'

  return (
    <Section>
      <Container className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Return {ret.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              Order <a href={`/staff/order/${ret.orderRequestId}`} className="text-primary hover:underline">
                {ret.orderRequestId.slice(0, 8)}
              </a>{' '}
              · {REASON_LABELS[ret.reason] ?? ret.reason}
            </p>
          </div>
          <StatusChip
            tone={RETURN_STATUS_DISPLAY[ret.status]?.tone ?? 'info'}
            label={RETURN_STATUS_DISPLAY[ret.status]?.label ?? ret.status}
          />
        </div>

        {!isNccAdmin ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            Read-only — only an NCC admin can review this return.
          </p>
        ) : null}

        <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lines</h2>
          {ret.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">{line.title}</span>
              <span className="text-muted-foreground">
                SKU {line.sku} · qty {line.quantity}
              </span>
            </div>
          ))}
          {ret.note ? <p className="border-t border-border pt-3 text-sm text-muted-foreground">Note: "{ret.note}"</p> : null}
          {ret.attachmentId ? (
            <div className="border-t border-border pt-3">
              {attachmentUrl ? (
                <img src={attachmentUrl} alt="Attached to this return" className="max-w-xs rounded-lg border border-border" />
              ) : (
                <button type="button" onClick={handleViewAttachment} className="text-sm font-medium text-primary hover:underline">
                  View attached photo
                </button>
              )}
            </div>
          ) : null}
        </div>

        {canBeginReview ? (
          <Button onClick={handleBeginReview} disabled={busy} className="w-fit">
            {busy ? 'Starting…' : 'Start review'}
          </Button>
        ) : null}

        {canDecide ? (
          <div className="surface-card flex flex-col gap-4 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Decision</h2>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Resolution if approved</span>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={resolution === 'refund'} onChange={() => setResolution('refund')} />
                  Refund
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={resolution === 'replacement'} onChange={() => setResolution('replacement')} />
                  Replacement
                </label>
              </div>
            </div>
            <Field
              label="Rejection reason (required to reject)"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleDecision('approve')} disabled={busy}>
                Approve
              </Button>
              <Button variant="secondary" onClick={() => handleDecision('reject')} disabled={busy}>
                Reject
              </Button>
            </div>
          </div>
        ) : null}

        {ret.status === 'approved' ? (
          <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Approved — {ret.resolution === 'replacement' ? 'Replacement' : 'Refund'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Process the {ret.resolution} in Shopify, then confirm it here so the customer's status
              page reflects it.
            </p>
            {canMarkOutcome ? (
              <div className="flex flex-wrap gap-3">
                {ret.resolution === 'replacement' ? (
                  <Button onClick={() => handleMarkOutcome('replacement_sent')} disabled={busy}>
                    Mark replacement sent
                  </Button>
                ) : (
                  <Button onClick={() => handleMarkOutcome('refunded')} disabled={busy}>
                    Mark refunded
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {isNccAdmin ? (
          <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Actions</h2>
            <Button variant="secondary" onClick={handleCopyLink} disabled={busy} className="w-fit">
              {linkCopied ? 'Copied!' : 'Copy customer link'}
            </Button>
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
