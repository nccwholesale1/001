import { createLink } from '@tanstack/react-router'
import { forwardRef } from 'react'
import type { AnchorHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Text-link style per design system §7 "Tertiary/link" — underline-offset,
 * hover underline, visible focus ring. Wraps TanStack Router's Link so
 * internal navigation stays type-safe; use `plain` for external URLs.
 */
const baseLinkClasses =
  'text-foreground/80 underline-offset-4 hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const RouterLinkBase = createLink('a')

export const RouterLink = forwardRef<
  HTMLAnchorElement,
  React.ComponentPropsWithoutRef<typeof RouterLinkBase>
>(({ className, ...props }, ref) => (
  <RouterLinkBase ref={ref} className={cn(baseLinkClasses, className)} {...props} />
))
RouterLink.displayName = 'RouterLink'

export const ExternalLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement>
>(({ className, target, rel, ...props }, ref) => (
  // eslint-disable-next-line jsx-a11y/anchor-has-content -- content always arrives via {...props}.children; jsx-a11y can't see through the spread on this pass-through wrapper.
  <a
    ref={ref}
    className={cn(baseLinkClasses, className)}
    target={target ?? '_blank'}
    rel={rel ?? 'noopener noreferrer'}
    {...props}
  />
))
ExternalLink.displayName = 'ExternalLink'
