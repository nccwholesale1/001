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
        <h1 className="text-3xl font-semibold text-foreground">Sign In or Create a Company Account</h1>
        <p className="text-sm text-muted-foreground">
          One step, no password to remember — verify your work email and we'll take you to the
          right place. New here? The same button starts your company's account. Already set up?
          It signs you straight in, and it's also how an invited teammate accepts their invite.
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
          A company account keeps every order in one place, adds teammates with company-level
          approval, and remembers your details for repeat ordering. Just need one order right now?{' '}
          <a href="/" className="font-medium text-primary hover:underline">
            Order as a guest
          </a>{' '}
          — no account needed.
        </p>
      </Container>
    </Section>
  )
}
