import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import {
  beginLogin,
  getPendingRegistration,
  submitCompanyRegistration,
} from '../server/buyers/server-functions'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Container, Section } from '../components/ui/Layout'

export const Route = createFileRoute('/register')({
  loader: () => getPendingRegistration(),
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Register Your Company · NCC Supply' }],
  }),
  component: RegisterRoute,
})

function RegisterRoute() {
  const pending = Route.useLoaderData()
  const begin = useServerFn(beginLogin)
  const submitRegistration = useServerFn(submitCompanyRegistration)
  const [companyName, setCompanyName] = useState('')
  const [adminName, setAdminName] = useState('')
  const [salesRepId, setSalesRepId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  async function handleSignInFirst() {
    setSigningIn(true)
    try {
      const { url } = await begin()
      window.location.href = url
    } catch {
      setSigningIn(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await submitRegistration({
        data: {
          companyName: companyName.trim(),
          adminName: adminName.trim(),
          referringSalesRepId: salesRepId.trim() || undefined,
        },
      })
      window.location.href = '/account'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not register your company right now.')
      setSubmitting(false)
    }
  }

  if (!pending) {
    return (
      <Section>
        <Container className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Register your company</h1>
          <p className="text-sm text-muted-foreground">
            First, verify your work email — the same sign-in company buyers use.
          </p>
          <Button onClick={handleSignInFirst} disabled={signingIn}>
            {signingIn ? 'Redirecting…' : 'Continue with email'}
          </Button>
        </Container>
      </Section>
    )
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-md flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Register your company</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {pending.email}.</p>
        </div>
        <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-4 rounded-xl p-5">
          <Field
            label="Company name"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <Field
            label="Your name"
            required
            value={adminName}
            onChange={(event) => setAdminName(event.target.value)}
          />
          <Field
            label="Sales Rep ID (optional)"
            value={salesRepId}
            onChange={(event) => setSalesRepId(event.target.value)}
            placeholder="e.g. EMP-042"
            helpText="Were you referred by an NCC sales rep? Add their ID and we'll credit them."
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting || !companyName.trim() || !adminName.trim()}>
            {submitting ? 'Creating…' : 'Create company account'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
