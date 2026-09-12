import { cn } from '../../lib/cn'

/**
 * Route-transition loading indicator. A plain spinner, not a skeleton of
 * fake content — CLAUDE.md rule 20 forbids anything that could look like
 * real inventory/data while it's still loading.
 */
export function AppPending({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-h-[40vh] items-center justify-center py-20', className)}
    >
      <span className="sr-only">Loading…</span>
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none motion-reduce:border-t-border"
      />
    </div>
  )
}
