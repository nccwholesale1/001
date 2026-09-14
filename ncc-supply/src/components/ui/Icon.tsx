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
  strokeWidth?: number
}

type LabelledProps = {
  icon: LucideIcon
  decorative: false
  label: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  strokeWidth?: number
}

export type IconProps = DecorativeProps | LabelledProps

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-12 w-12',
}

/**
 * Lucide's own default (2) is drawn for icons at typical 16-20px inline
 * sizes — stretched up to `lg` (48px) it reads as thick/clunky rather than
 * clean. Thinner at that size by default; still overridable per call site.
 */
const defaultStrokeWidth = {
  sm: 2,
  md: 2,
  lg: 1.5,
}

export function Icon({
  icon: LucideIconComponent,
  decorative = true,
  label,
  className,
  size = 'sm',
  strokeWidth,
}: IconProps) {
  const resolvedStrokeWidth = strokeWidth ?? defaultStrokeWidth[size]
  if (decorative) {
    return (
      <LucideIconComponent
        aria-hidden="true"
        strokeWidth={resolvedStrokeWidth}
        className={cn(sizeClasses[size], className)}
      />
    )
  }
  return (
    <LucideIconComponent
      role="img"
      aria-label={label}
      strokeWidth={resolvedStrokeWidth}
      className={cn(sizeClasses[size], className)}
    />
  )
}
