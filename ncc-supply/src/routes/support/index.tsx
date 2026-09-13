import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { getCurrentBuyerSummary } from '../../server/buyers/server-functions'
import { submitSupportTicketFn } from '../../server/support/server-functions'
import { SUPPORT_TICKET_CATEGORIES } from '../../server/validation/commands'
import { fileToBase64 } from '../../lib/file-to-base64'
import { Button } from '../../components/ui/Button'
import { Field, TextareaField } from '../../components/ui/Field'
import { Container, Section } from '../../components/ui/Layout'

const CATEGORY_LABELS: Record<(typeof SUPPORT_TICKET_CATEGORIES)[number], string> = {
  order_issue: 'Order issue',
  account_issue: 'Account issue',
  site_issue: 'Site issue',
  other: 'Other',
}

const supportSearchSchema = z.object({
  orderRequestId: z.string().optional(),
  returnId: z.string().optional(),
  token: z.string().optional(),
})

export const Route = createFileRoute('/support/')({
  validateSearch: supportSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const buyer = await getCurrentBuyerSummary()
    return { isBuyer: buyer !== null, ...deps }
  },
  head: () => ({ meta: [{ title: 'Contact Support · NCC Supply' }] }),
  component: SupportRequestRoute,
})

function SupportRequestRoute() {
  const { isBuyer, orderRequestId, returnId, token } = Route.useLoaderData()
  const [category, setCategory] = useState<(typeof SUPPORT_TICKET_CATEGORIES)[number]>(
    orderRequestId ? 'order_issue' : 'other',
  )
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doSubmit = useServerFn(submitSupportTicketFn)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!message.trim()) {
      setError('Enter a message describing the issue.')
      return
    }

    setSubmitting(true)
    try {
      const attachment = file ? { filename: file.name, base64: await fileToBase64(file) } : undefined
      const result = await doSubmit({
        data: {
          category,
          orderRequestId,
          returnId,
          message: message.trim(),
          attachment,
          referenceToken: token,
          ...(isBuyer ? {} : { contactEmail: contactEmail.trim() || undefined }),
        },
      })
      window.location.href =
        result.kind === 'guest'
          ? `/support/${result.ticketId}?token=${encodeURIComponent(result.token)}`
          : `/support/${result.ticketId}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your message. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-2xl flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Contact Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Something gone wrong with an order, your account, or the site? Tell us here and we'll
            track it through to resolution — this is separate from general pre-purchase questions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="support-category">
              Category
            </label>
            <select
              id="support-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof SUPPORT_TICKET_CATEGORIES)[number])}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SUPPORT_TICKET_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <TextareaField
            label="Message"
            required
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe what's happened"
          />

          {!isBuyer ? (
            <Field
              label="Email (optional)"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              helpText="So NCC can follow up — your private status link works either way."
            />
          ) : null}

          <Field
            label="Attachment (optional)"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            helpText="Image or PDF, up to 5MB."
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={submitting} className="w-fit">
            {submitting ? 'Sending…' : 'Submit'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
