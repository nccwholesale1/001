import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { beginLogin } from '../server/buyers/server-functions'
import { Button } from '../components/ui/Button'
import { Container, Section } from '../components/ui/Layout'

export const Route = createFileRoute('/auth')({
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex' }, { title: 'Sign In · NCC Supply' }],
  }),
  component: AuthRoute,
})

function AuthRoute() {
  const begin = useServerFn(beginLogin)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setPending(true)
    setError(null)
    try {
      const { url } = await begin()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start sign-in. Please try again.')
      setPending(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Company buyers sign in with their work email — no password to remember. If you've been
          invited to a company account, signing in is also how you accept that invite.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button onClick={handleSignIn} disabled={pending}>
          {pending ? 'Redirecting…' : 'Continue with email'}
        </Button>
        <p className="text-sm text-muted-foreground">
          No account yet? Signing in for the first time lets you register a new company.
        </p>
      </Container>
    </Section>
  )
}
