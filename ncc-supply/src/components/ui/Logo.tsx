import { cn } from '../../lib/cn'

export interface LogoProps {
  /** 'blue' for a light background (header), 'white' for a dark one (footer). */
  variant?: 'blue' | 'white'
  className?: string
}

/** The real NCC wordmark — replaces the plain-text "NCC Supply" stand-in everywhere a logo is shown. */
export function Logo({ variant = 'blue', className }: LogoProps) {
  return (
    <img
      src={variant === 'white' ? '/logo-white.svg' : '/logo-blue.svg'}
      alt="NCC Supply"
      className={cn('h-8 w-auto', className)}
    />
  )
}
