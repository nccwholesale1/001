import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { completeLogin } from '../server/buyers/server-functions'
import { Container, Section } from '../components/ui/Layout'

const callbackSearchSchema = z.object({ code: z.string().optional(), state: z.string().optional() })

/**
 * The real HTTPS callback route `customer-account-adapter.ts` (Phase 3) has
 * been waiting for since Shopify never accepts a localhost redirect_uri.
 * `completeLogin` does the actual work (state check, token exchange, id_token
 * verification, buyer matching); this route only decides where to send the
 * browser next based on the outcome.
 */
export const Route = createFileRoute('/auth-callback')({
  validateSearch: callbackSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    if (!deps.code || !deps.state) return { outcome: 'invalid_state' as const }

    const result = await completeLogin({ data: { code: deps.code, state: deps.state } })
    if (result.outcome === 'signed_in') throw redirect({ to: '/account' })
    if (result.outcome === 'pending_registration') throw redirect({ to: '/register' })
    return result
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }, { title: 'Signing In · NCC Supply' }] }),
  component: AuthCallbackRoute,
})

function AuthCallbackRoute() {
  const result = Route.useLoaderData()
  const message =
    result.outcome === 'removed'
      ? "Your access to this account has been removed. Contact your company admin if you think that's a mistake."
      : 'Your sign-in link is invalid or has expired. Please try signing in again.'

  return (
    <Section>
      <Container className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Sign-In Unsuccessful</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <a href="/auth" className="text-sm font-medium text-primary hover:underline">
          Back to sign in
        </a>
      </Container>
    </Section>
  )
}
