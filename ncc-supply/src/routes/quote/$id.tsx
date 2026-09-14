import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { z } from 'zod'
import { getCurrentActor } from '../../server/buyers/buyer-session'
import { db } from '../../server/db/client'
import { acceptQuote } from '../../server/quotes/quote-pricing'
import { buildQuoteView, getQuoteViewForActor, type QuoteView } from '../../server/quotes/quote-view'
import { verifyGuestToken } from '../../server/tokens/token-service'
import { Button } from '../../components/ui/Button'
import { Container, Section } from '../../components/ui/Layout'
import { QuoteDetail } from '../../components/ui/QuoteDetail'

const quoteIdTokenSchema = z.object({ quoteId: z.string().min(1), token: z.string().optional() }).strict()

/** Dual access, mirroring `checkout/$id.tsx::getCheckoutView` exactly. */
const getQuoteDetailView = createServerFn({ method: 'GET' })
  .validator(quoteIdTokenSchema.parse)
  .handler(async ({ data }): Promise<QuoteView | null> => {
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'quote')
      if (!verification || verification.resourceId !== data.quoteId) return null
      return buildQuoteView(db, data.quoteId)
    }

    const actor = await getCurrentActor(db)
    if (!actor) return null
    try {
      return await getQuoteViewForActor(db, actor, data.quoteId)
    } catch {
      return null
    }
  })

/**
 * Authorization here is identical to the view above (decision 8) — a caller
 * who couldn't load the view can't accept it either, so this re-runs the
 * exact same check rather than trusting a client-side "I'm allowed" claim.
 */
const acceptQuoteAction = createServerFn({ method: 'POST' })
  .validator(quoteIdTokenSchema.parse)
  .handler(async ({ data }): Promise<{ orderRequestId: string; token?: string } | null> => {
    if (data.token) {
      const verification = await verifyGuestToken(db, data.token, 'quote')
      if (!verification || verification.resourceId !== data.quoteId) return null
      return acceptQuote(db, data.quoteId)
    }

    const actor = await getCurrentActor(db)
    if (!actor) return null
    try {
      await getQuoteViewForActor(db, actor, data.quoteId)
    } catch {
      return null
    }
    return acceptQuote(db, data.quoteId)
  })

const quoteDetailSearchSchema = z.object({ token: z.string().optional() })

export const Route = createFileRoute('/quote/$id')({
  validateSearch: quoteDetailSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const quote = await getQuoteDetailView({ data: { quoteId: params.id, token: deps.token } })
    if (!quote) throw notFound()
    return { quote, token: deps.token }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }, { title: 'Quote Status · NCC Supply' }] }),
  notFoundComponent: QuoteNotFound,
  component: QuoteStatusRoute,
})

function QuoteNotFound() {
  return (
    <Section>
      <Container className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-foreground">We Couldn't Find That Quote</h1>
        <p className="text-sm text-muted-foreground">
          The link may be incorrect, expired, or no longer valid. If you have a support query,{' '}
          <a href="/support" className="text-primary hover:underline">
            contact NCC
          </a>
          .
        </p>
      </Container>
    </Section>
  )
}

function QuoteStatusRoute() {
  const { quote, token } = Route.useLoaderData()
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const doAccept = useServerFn(acceptQuoteAction)

  const canAccept =
    quote.status === 'quoted' &&
    quote.lines.length > 0 &&
    quote.lines.every((line) => line.quotedUnitPricePence !== null)

  async function handleAccept() {
    setAccepting(true)
    setError(null)
    try {
      const result = await doAccept({ data: { quoteId: quote.id, token } })
      if (!result) {
        setError('Could not accept this quote — it may have just expired. Refresh and try again.')
        setAccepting(false)
        return
      }
      if (result.token) {
        const params = new URLSearchParams({ orderId: result.orderRequestId, token: result.token })
        window.location.href = `/order-submitted?${params.toString()}`
      } else {
        window.location.href = '/account/orders'
      }
    } catch {
      setError('Could not accept this quote right now. Please try again.')
      setAccepting(false)
    }
  }

  return (
    <QuoteDetail
      quote={quote}
      actions={
        canAccept ? (
          <div className="surface-card flex flex-col gap-3 rounded-xl p-5">
            <p className="text-sm text-muted-foreground">
              Accepting sends this in for NCC's standard order review — no payment is taken now.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={handleAccept} disabled={accepting} className="w-fit">
              {accepting ? 'Accepting…' : 'Accept quote'}
            </Button>
          </div>
        ) : null
      }
    />
  )
}
