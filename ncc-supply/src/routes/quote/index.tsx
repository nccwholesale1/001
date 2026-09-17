import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { submitQuote } from '../../server/quotes/server-functions'
import { getCurrentBuyerSummary } from '../../server/buyers/server-functions'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Icon } from '../../components/ui/Icon'
import { Container, Section } from '../../components/ui/Layout'

interface DraftLine {
  sku: string
  quantity: string
}

function emptyLine(): DraftLine {
  return { sku: '', quantity: '1' }
}

export const Route = createFileRoute('/quote/')({
  ssr: false,
  loader: async () => {
    const buyer = await getCurrentBuyerSummary()
    return { isBuyer: buyer !== null }
  },
  head: () => ({
    meta: [{ title: 'Request a Quote · NCC Supply' }],
  }),
  component: QuoteRequestRoute,
})

function QuoteRequestRoute() {
  const { isBuyer } = Route.useLoaderData()
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [contactEmail, setContactEmail] = useState('')
  const [contactName, setContactName] = useState('')
  const [salesRepId, setSalesRepId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSubmit = useServerFn(submitQuote)

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const parsedLines = lines
      .map((line) => ({ sku: line.sku.trim(), quantity: Number(line.quantity) }))
      .filter((line) => line.sku.length > 0)

    if (parsedLines.length === 0) {
      setError('Add at least one SKU.')
      return
    }
    if (parsedLines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1)) {
      setError('Every quantity must be a positive whole number.')
      return
    }

    setSubmitting(true)
    try {
      const result = await doSubmit({
        data: {
          lines: parsedLines,
          ...(isBuyer
            ? {}
            : { contactEmail: contactEmail.trim() || undefined, contactName: contactName.trim() || undefined }),
          referringSalesRepId: salesRepId.trim() || undefined,
        },
      })
      if (result.kind === 'buyer') {
        window.location.href = `/quote/${result.quoteId}`
      } else {
        const params = new URLSearchParams({ quoteId: result.quoteId, token: result.token })
        window.location.href = `/quote-submitted?${params.toString()}`
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit your quote request right now. Please try again.',
      )
      setSubmitting(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-2xl flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Request a Quote</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us which lines and quantities you need pricing on — this isn't an order and
            doesn't confirm availability or price yet. NCC will follow up here once it's priced.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div key={index} className="flex items-end gap-3">
                <Field
                  label="SKU"
                  value={line.sku}
                  onChange={(event) => updateLine(index, { sku: event.target.value })}
                  placeholder="e.g. B1190001"
                  className="flex-1"
                />
                <Field
                  label="Quantity"
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  className="w-28"
                />
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={lines.length === 1}
                  aria-label="Remove line"
                  className="mb-1.5 rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Icon icon={X} size="sm" />
                </button>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addLine} className="w-fit">
              <Icon icon={Plus} size="sm" />
              Add another line
            </Button>
          </div>

          {!isBuyer ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                helpText="Your private quote link will reference this contact."
              />
              <Field
                label="Name"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </div>
          ) : null}

          <Field
            label="Sales Rep ID (optional)"
            value={salesRepId}
            onChange={(event) => setSalesRepId(event.target.value)}
            placeholder="e.g. EMP-042"
            helpText="Were you referred by an NCC sales rep? Add their ID and we'll credit them."
            className="max-w-xs"
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Sending…' : 'Request quote'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
