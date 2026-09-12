import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

/**
 * Lucide wrapper per design system §8: decorative icons get aria-hidden,
 * meaningful icons take a required accessible label. h-4 w-4 inline default,
 * override via `size`.
 */
type DecorativeProps = {
  icon: LucideIcon
  decorative?: true
  label?: never
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

type LabelledProps = {
  icon: LucideIcon
  decorative: false
  label: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export type IconProps = DecorativeProps | LabelledProps

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-12 w-12',
}

export function Icon({ icon: LucideIconComponent, decorative = true, label, className, size = 'sm' }: IconProps) {
  if (decorative) {
    return (
      <LucideIconComponent
        aria-hidden="true"
        className={cn(sizeClasses[size], className)}
      />
    )
  }
  return (
    <LucideIconComponent
      role="img"
      aria-label={label}
      className={cn(sizeClasses[size], className)}
    />
  )
}
