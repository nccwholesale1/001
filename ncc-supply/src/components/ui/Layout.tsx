import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Shared max-width container — design system §6: every section uses this, no narrower one-offs. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto max-w-7xl px-4', className)} {...props} />
}

/** Section band with the standard vertical rhythm (py-20, hero py-24) and optional sky-tinted alternation. */
export function Section({
  className,
  tinted = false,
  ...props
}: HTMLAttributes<HTMLElement> & { tinted?: boolean }) {
  return (
    <section
      className={cn('py-20', tinted && 'bg-sky-soft/50', className)}
      {...props}
    />
  )
}

/** Category/product-style responsive grid — design system §6. */
export function ResponsiveGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-4', className)} {...props} />
  )
}
