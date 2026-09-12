import { SearchX } from 'lucide-react'
import { RouterLink } from '../ui/Link'
import { Button } from '../ui/Button'
import { Container } from '../ui/Layout'
import { Icon } from '../ui/Icon'

export function AppNotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-20 text-center">
      <Icon icon={SearchX} decorative size="lg" className="text-muted-foreground" />
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Button asChild>
        <RouterLink to="/">Back to home</RouterLink>
      </Button>
    </Container>
  )
}
