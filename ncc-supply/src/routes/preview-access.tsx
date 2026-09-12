import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { submitSiteAccess } from '../server/auth/site-access-server-functions'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Container, Section } from '../components/ui/Layout'

const previewAccessSearchSchema = z.object({ redirectTo: z.string().optional() })

export const Route = createFileRoute('/preview-access')({
  validateSearch: previewAccessSearchSchema,
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
      { title: 'Preview Access · NCC Supply' },
    ],
  }),
  component: PreviewAccessRoute,
})

function PreviewAccessRoute() {
  const { redirectTo } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = useServerFn(submitSiteAccess)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await submit({ data: { password } })
      if (result.ok) {
        window.location.href = redirectTo || '/'
      } else {
        setError('That password is incorrect.')
        setSubmitting(false)
      }
    } catch {
      setError('Could not verify that password right now. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Section>
      <Container className="mx-auto flex max-w-sm flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">NCC Supply — Preview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This site is still being built. Enter the preview password to continue.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-4 rounded-xl p-5">
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
          <Button type="submit" disabled={submitting || !password}>
            {submitting ? 'Checking…' : 'Continue'}
          </Button>
        </form>
      </Container>
    </Section>
  )
}
