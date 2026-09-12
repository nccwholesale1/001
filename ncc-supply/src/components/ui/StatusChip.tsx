import { AlertCircle, CheckCircle2, CircleDot, Clock, XCircle } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'

/**
 * Status communication must never rely on colour alone (PRD §10). Every
 * tone pairs a token colour with a distinct icon shape, so shape carries
 * the meaning as much as colour does.
 */
export const statusChipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-secondary text-secondary-foreground',
        info: 'border-primary/30 bg-accent text-accent-foreground',
        success: 'border-primary/30 bg-sky-soft text-foreground',
        warning: 'border-destructive/30 bg-destructive/10 text-destructive',
        danger: 'border-destructive/40 bg-destructive/15 text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const toneIcon = {
  neutral: CircleDot,
  info: Clock,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: XCircle,
} as const

export interface StatusChipProps extends VariantProps<typeof statusChipVariants> {
  label: string
  className?: string
}

export function StatusChip({ tone = 'neutral', label, className }: StatusChipProps) {
  const Icon = toneIcon[tone ?? 'neutral']
  return (
    <span className={cn(statusChipVariants({ tone }), className)}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}
