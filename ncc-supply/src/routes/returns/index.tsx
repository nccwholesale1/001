import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { getCurrentActor } from '../../server/buyers/buyer-session'
import { db } from '../../server/db/client'
import { buildOrderRequestView, getOrderRequestViewForActor, type OrderRequestView } from '../../server/orders/order-view'
import { submitReturn } from '../../server/returns/server-functions'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { RETURN_REASONS } from '../../server/validation/commands'
import { fileToBase64 } from '../../lib/file-to-base64'
import { Button } from '../../components/ui/Button'
import { Field, TextareaField } from '../../components/ui/Field'
import { Container, Section } from '../../components/ui/Layout'

const REASON_LABELS: Record<(typeof RETURN_REASONS)[number], string> = {
  damaged: 'Damaged',
  wrong_item: 'Wrong item',
  no_longer_needed: 'No longer needed',
  other: 'Other',
}

const orderForReturnQuerySchema = z.object({ orderId: z.string().min(1), token: z.string().optional() }).strict()

/** Dual access, mirroring `checkout/$id.tsx::getCheckoutView` — a return is always reached with confirmed-order context. */
const getOrderForReturn = createServerFn({ method: 'GET' })
  .validator(orderForReturnQuerySchema.parse)
  .handler(async ({ data }): Promise<OrderRequestView | null> => {
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'order_request')
      if (!verification || verification.resourceId !== data.orderId) return null
      return buildOrderRequestView(db, data.orderId)
    }
    const actor = await getCurrentActor(db)
    if (!actor) return null
    try {
      return await getOrderRequestViewForActor(db, actor, data.orderId)
    } catch {
      return null
    }
  })

const returnsSearchSchema = z.object({ orderId: z.string().min(1), token: z.string().optional() })

export const Route = createFileRoute('/returns/')({
  validateSearch: returnsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const order = await getOrderForReturn({ data: { orderId: deps.orderId, token: deps.token } })
    if (!order || order.status !== 'confirmed') throw notFound()
    return { order, token: deps.token }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }, { title: 'Request a Return · NCC Supply' }] }),
  notFoundComponent: ReturnsNotFound,
  component: ReturnsRequestRoute,
})

function ReturnsNotFound() {
  return (
    <Section>
      <Container className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-foreground">We Couldn't Request a Return Here</h1>
        <p className="text-sm text-muted-foreground">
          Returns can only be requested from a confirmed order's own status page — the link may be
          incorrect, or this order isn't confirmed yet. If you have a question,{' '}
          <a href="/support" className="text-primary hover:underline">
            contact NCC
          </a>
          .
        </p>
      </Container>
    </Section>
  )
}

function ReturnsRequestRoute() {
  const { order, token } = Route.useLoaderData()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<(typeof RETURN_REASONS)[number]>('damaged')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSubmit = useServerFn(submitReturn)

  function toggleLine(lineId: string, maxQuantity: number, checked: boolean) {
    setQuantities((prev) => {
      const next = { ...prev }
      if (checked) next[lineId] = maxQuantity
      else delete next[lineId]
      return next
    })
  }

  function setLineQuantity(lineId: string, quantity: number, maxQuantity: number) {
    setQuantities((prev) => ({ ...prev, [lineId]: Math.max(1, Math.min(maxQuantity, quantity)) }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const lines = Object.entries(quantities).map(([orderRequestLineId, quantity]) => ({ orderRequestLineId, quantity }))
    if (lines.length === 0) {
      setError('Select at least one line to return.')
      return
    }

    setSubmitting(true)
    try {
      const attachment = file ? { filename: file.name, base64: await fileToBase64(file) } : undefined
      const result = await doSubmit({
        data: { orderRequestId: order.id, reason, note: note.trim() || undefined, lines, attachment, orderToken: token },
      })
      window.location.href =
        result.kind === 'guest'
          ? `/returns/${result.returnId}?token=${encodeURIComponent(result.token)}`
          : `/returns/${result.returnId}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your return request. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-2xl flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Request a Return</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is a request, not an automatic refund — NCC reviews every return before anything
            is refunded or replaced.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">Which Lines Are You Returning?</h2>
            {order.lines.map((line) => {
              const maxQuantity = line.confirmedQuantity ?? line.requestedQuantity
              const checked = line.id in quantities
              return (
                <div key={line.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleLine(line.id, maxQuantity, event.target.checked)}
                    />
                    <span>
                      {line.title} <span className="text-muted-foreground">(SKU {line.sku})</span>
                    </span>
                  </label>
                  {checked ? (
                    <input
                      type="number"
                      min={1}
                      max={maxQuantity}
                      value={quantities[line.id]}
                      onChange={(event) => setLineQuantity(line.id, Number(event.target.value), maxQuantity)}
                      className="w-20 rounded-lg border border-input bg-card px-2 py-1 text-sm"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">of {maxQuantity}</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="return-reason">
              Reason
            </label>
            <select
              id="return-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof RETURN_REASONS)[number])}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {RETURN_REASONS.map((value) => (
                <option key={value} value={value}>
                  {REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <TextareaField
            label="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything else NCC should know"
          />

          <Field
            label="Photo (optional)"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            helpText="JPEG, PNG, WebP or GIF, up to 5MB."
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Submitting…' : 'Submit return request'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
