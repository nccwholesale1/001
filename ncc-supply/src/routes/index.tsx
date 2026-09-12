import { createFileRoute } from '@tanstack/react-router'
import { Container } from '../components/ui/Layout'
import { RouterLink } from '../components/ui/Link'

/**
 * Placeholder only — Phase 4 builds the real homepage from PRD §6.1.
 * Deliberately not styled as a finished page so it can never be mistaken
 * for real content (CLAUDE.md rule 20).
 */
export const Route = createFileRoute('/')({ component: IndexRoute })

function IndexRoute() {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-2xl font-semibold text-foreground">NCC Supply</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Application scaffold — homepage arrives in Phase 4.
      </p>
      {import.meta.env.DEV ? (
        <p className="mt-6 text-sm">
          <RouterLink to="/dev/components">View component preview →</RouterLink>
        </p>
      ) : null}
    </Container>
  )
}
