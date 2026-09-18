import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Minus, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  getBasket,
  removeBasketLine,
  setReferringSalesRep,
  submitCurrentBasket,
  updateBasketLine,
} from '../server/basket/server-functions'
import type { BasketView } from '../server/basket/basket'
import { getCurrentBuyerSummary } from '../server/buyers/server-functions'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Container, Section } from '../components/ui/Layout'

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

export const Route = createFileRoute('/basket')({
  ssr: false,
  loader: async () => {
    const [basket, buyer] = await Promise.all([getBasket(), getCurrentBuyerSummary()])
    return { basket, isBuyer: buyer !== null }
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Basket · NCC Supply' }],
  }),
  component: BasketRoute,
})

function BasketRoute() {
  const { basket: initialBasket, isBuyer } = Route.useLoaderData()
  const [basket, setBasket] = useState<BasketView>(initialBasket)
  const [contactEmail, setContactEmail] = useState('')
  const [contactName, setContactName] = useState('')
  const [salesRepId, setSalesRepId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busyLineId, setBusyLineId] = useState<string | null>(null)

  const updateLine = useServerFn(updateBasketLine)
  const removeLine = useServerFn(removeBasketLine)
  const submit = useServerFn(submitCurrentBasket)
  const doSetReferringSalesRep = useServerFn(setReferringSalesRep)
  const router = useRouter()

  const hasUnavailableLines = basket.lines.some((line) => !line.available)

  async function handleQuantityChange(lineId: string, quantity: number) {
    if (quantity < 1) return
    setBusyLineId(lineId)
    try {
      setBasket(await updateLine({ data: { lineId, quantity } }))
      router.invalidate() // refreshes the header's basket count badge
    } finally {
      setBusyLineId(null)
    }
  }

  async function handleRemove(lineId: string) {
    setBusyLineId(lineId)
    try {
      setBasket(await removeLine({ data: { lineId } }))
      router.invalidate() // refreshes the header's basket count badge
    } finally {
      setBusyLineId(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      // Recorded on the basket first, because submit copies it onto the order
      // request from there (see submit-order-request.ts) rather than taking it
      // as a submission field.
      if (salesRepId.trim()) {
        await doSetReferringSalesRep({ data: { referringSalesRepId: salesRepId.trim() } })
      }
      const result = await submit({
        data: isBuyer
          ? {}
          : {
              contactEmail: contactEmail.trim() || undefined,
              contactName: contactName.trim() || undefined,
            },
      })
      if (result.kind === 'buyer') {
        window.location.href = '/account/orders'
      } else {
        const params = new URLSearchParams({ orderId: result.orderRequestId, token: result.token })
        window.location.href = `/order-submitted?${params.toString()}`
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Could not submit your basket right now. Please try again.',
      )
      setSubmitting(false)
    }
  }

  return (
    <Section>
      <Container className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Basket</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review your lines, then submit for NCC to review — no payment is taken here.
          </p>
        </div>

        {basket.lines.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">Your basket is empty.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              <a href="/categories" className="text-primary hover:underline">
                Browse categories
              </a>{' '}
              to find what you need.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4">
              {basket.lines.map((line) =>
                line.available ? (
                  <div
                    key={line.id}
                    className="surface-card flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center"
                    aria-busy={busyLineId === line.id}
                  >
                    <div className="flex items-center gap-4">
                      <div className="sky-gradient grid-mesh h-16 w-16 shrink-0 rounded-lg" />
                      <div className="flex flex-1 flex-col gap-1">
                        <span className="text-sm font-semibold text-foreground">{line.title}</span>
                        <span className="text-xs text-muted-foreground">SKU {line.sku}</span>
                        <span className="text-sm text-foreground">
                          {formatPrice(line.price.amountPence)} ea
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="flex items-center gap-1 rounded-lg border border-border">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${line.title}`}
                          disabled={busyLineId === line.id || line.quantity <= 1}
                          onClick={() => handleQuantityChange(line.id, line.quantity - 1)}
                          className="p-2 text-foreground/70 hover:bg-secondary disabled:opacity-40"
                        >
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span aria-live="polite" className="w-8 text-center text-sm font-medium">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${line.title}`}
                          disabled={busyLineId === line.id}
                          onClick={() => handleQuantityChange(line.id, line.quantity + 1)}
                          className="p-2 text-foreground/70 hover:bg-secondary disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="w-20 text-right text-sm font-semibold text-foreground">
                        {formatPrice(line.lineTotalPence)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${line.title} from basket`}
                        disabled={busyLineId === line.id}
                        onClick={() => handleRemove(line.id)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={line.id}
                    className="flex items-center gap-4 rounded-xl border border-destructive/30 bg-card p-4"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">SKU {line.sku}</p>
                      <p className="text-xs text-destructive">
                        No longer available — remove it to continue.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(line.id)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary"
                    >
                      Remove
                    </button>
                  </div>
                ),
              )}
            </div>

            <div className="flex flex-col gap-6">
              <div className="surface-card rounded-xl p-5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-semibold text-foreground">
                    {formatPrice(basket.subtotalPence)}
                  </span>
                </div>
                <p className="mt-3 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                  Delivery is confirmed by NCC after review — it is not shown here.
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="surface-card flex flex-col gap-4 rounded-xl p-5"
              >
                {isBuyer ? (
                  <p className="text-sm text-muted-foreground">
                    Submitting sends this to your company admin for approval before it reaches
                    NCC.
                  </p>
                ) : (
                  <>
                    <Field
                      label="Email"
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      helpText="Your private order link will reference this contact."
                    />
                    <Field
                      label="Name"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                    />
                    <Field
                      label="Sales rep ID (optional)"
                      value={salesRepId}
                      onChange={(event) => setSalesRepId(event.target.value)}
                      helpText="If an NCC sales rep referred you, enter their ID so your order is credited to them."
                    />
                  </>
                )}
                {submitError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                ) : null}
                <Button type="submit" disabled={submitting || hasUnavailableLines}>
                  {submitting ? 'Submitting…' : 'Submit basket'}
                </Button>
                {hasUnavailableLines ? (
                  <p className="text-xs text-destructive">
                    Remove unavailable items before submitting.
                  </p>
                ) : null}
              </form>
            </div>
          </div>
        )}
      </Container>
    </Section>
  )
}
