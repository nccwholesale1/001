import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { staffLogin } from '../server/staff/server-functions'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Container, Section } from '../components/ui/Layout'

/**
 * Internal-only — never linked from public navigation/footer (PRD §5.2,
 * CLAUDE.md rule "no staff route ever exposed"). Email or username in one
 * field, resolving to the same account (PRD acceptance criterion 18).
 */
export const Route = createFileRoute('/staff-login')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }, { title: 'Staff Sign In · NCC Supply' }],
  }),
  component: StaffLoginRoute,
})

function StaffLoginRoute() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const login = useServerFn(staffLogin)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login({ data: { identifier, password } })
      window.location.href = '/staff/orders'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in right now.')
      setSubmitting(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">NCC Staff Sign In</h1>
          <p className="mt-1 text-sm text-muted-foreground">Email or username, and your password.</p>
        </div>
        <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-4 rounded-xl p-5">
          <Field
            label="Email or username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <Field
            label="Password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting || !identifier || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
