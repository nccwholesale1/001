import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { env } from '../../server/env'
import { mintFixtureIdToken } from '../../server/integrations/shopify/fixture-customer-account-adapter'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Container, Section } from '../../components/ui/Layout'

const fixtureLoginSearchSchema = z.object({ state: z.string(), redirect_uri: z.string() })

const buildFixtureRedirect = createServerFn({ method: 'POST' })
  .validator(
    z.object({ email: z.string().email(), redirectUri: z.string(), state: z.string() }).parse,
  )
  .handler(async ({ data }) => {
    if (env.CUSTOMER_ACCOUNT_ADAPTER !== 'fixture') {
      throw new Error('Fixture login is disabled — CUSTOMER_ACCOUNT_ADAPTER is not "fixture".')
    }
    const code = await mintFixtureIdToken(data.email)
    const url = new URL(data.redirectUri)
    url.searchParams.set('code', code)
    url.searchParams.set('state', data.state)
    return { url: url.toString() }
  })

/**
 * Simulates Shopify's hosted customer login for local dev/test only — see
 * fixture-customer-account-adapter.ts. Guarded twice: `beforeLoad` 404s
 * outright when the live adapter is selected, and the server function above
 * refuses to mint a token in that case too, so this can never become a real
 * sign-in bypass in a live-configured environment.
 */
export const Route = createFileRoute('/dev/fixture-shopify-login')({
  validateSearch: fixtureLoginSearchSchema,
  beforeLoad: () => {
    if (env.CUSTOMER_ACCOUNT_ADAPTER !== 'fixture') throw notFound()
  },
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Fixture Shopify Login (dev)' },
    ],
  }),
  component: FixtureLoginRoute,
})

function FixtureLoginRoute() {
  const { state, redirect_uri: redirectUri } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const { url } = await buildFixtureRedirect({ data: { email: email.trim(), redirectUri, state } })
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue.')
      setPending(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="rounded-lg border border-dashed border-border bg-secondary p-3 text-center text-xs text-muted-foreground">
          Dev-only fixture — simulates Shopify's hosted customer login. Never reachable when
          CUSTOMER_ACCOUNT_ADAPTER=live.
        </div>
        <h1 className="text-center text-2xl font-semibold text-foreground">Sign in to NCC Supply</h1>
        <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-4 rounded-xl p-5">
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || !email.trim()}>
            {pending ? 'Continuing…' : 'Continue'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
