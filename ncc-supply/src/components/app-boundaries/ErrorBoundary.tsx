import type { ErrorComponentProps } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Container } from '../ui/Layout'
import { Icon } from '../ui/Icon'

/** Root error boundary. Never claims stock/delivery/pricing detail it doesn't have (CLAUDE.md rule 10). */
export function AppErrorBoundary({ error, reset }: ErrorComponentProps) {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <Icon icon={AlertTriangle} decorative size="lg" className="text-destructive" />
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        We hit an unexpected error loading this page. You can try again, or contact us if it
        keeps happening.
      </p>
      {import.meta.env.DEV ? (
        <pre className="max-w-full overflow-x-auto rounded-lg border border-border bg-secondary p-3 text-left text-xs text-muted-foreground">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      ) : null}
      <Button type="button" onClick={() => reset()}>
        Try again
      </Button>
    </Container>
  )
}
