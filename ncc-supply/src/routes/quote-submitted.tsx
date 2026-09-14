import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Container, Section } from '../components/ui/Layout'

const quoteSubmittedSearchSchema = z.object({
  quoteId: z.string().min(1),
  token: z.string().min(1),
})

export const Route = createFileRoute('/quote-submitted')({
  validateSearch: quoteSubmittedSearchSchema,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Quote Requested · NCC Supply' }],
  }),
  component: QuoteSubmittedRoute,
})

function QuoteSubmittedRoute() {
  const { quoteId, token } = Route.useSearch()
  const statusHref = `/quote/${quoteId}?token=${encodeURIComponent(token)}`

  return (
    <Section>
      <Container className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Your Quote Request Has Been Sent</h1>
        <p className="text-sm text-muted-foreground">
          NCC will price each line and get back to you here — no availability or price is
          confirmed until then.
        </p>
        <div className="surface-card w-full rounded-xl p-6">
          <p className="text-sm font-semibold text-foreground">Save your private quote link</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This is the only way to check your quote's status — bookmark it now.
          </p>
          <a
            href={statusHref}
            className="mt-3 block break-all rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-primary hover:underline"
          >
            {statusHref}
          </a>
        </div>
      </Container>
    </Section>
  )
}
