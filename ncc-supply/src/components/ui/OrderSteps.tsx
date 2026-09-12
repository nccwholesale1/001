import { Banknote, CheckCircle2, ClipboardCheck, Search, ShoppingBasket } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from './Icon'

interface Step {
  icon: LucideIcon
  label: string
  description: string
}

/**
 * Design system §5.2 "OrderSteps — five-step icon flow, compact and full
 * variants." Copy summarizes the actual flow/rules already defined in PRD
 * §4 (submit-then-NCC-confirms-then-pay) — not invented business policy.
 */
const STEPS: Step[] = [
  {
    icon: Search,
    label: 'Browse & Search',
    description: 'Find the parts you need across the full catalogue.',
  },
  {
    icon: ShoppingBasket,
    label: 'Add to Basket',
    description: 'Any quantity — no payment required yet.',
  },
  {
    icon: ClipboardCheck,
    label: 'Submit Your Order',
    description: 'We review it. No card details are taken.',
  },
  {
    icon: CheckCircle2,
    label: 'NCC Confirms',
    description: 'We confirm quantities, delivery and VAT.',
  },
  {
    icon: Banknote,
    label: 'Pay & Receive',
    description: 'Cash on delivery or invoice, once confirmed.',
  },
]

export interface OrderStepsProps {
  variant?: 'full' | 'compact'
}

export function OrderSteps({ variant = 'full' }: OrderStepsProps) {
  return (
    <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      {STEPS.map((step, index) => (
        <li
          key={step.label}
          className="rise-in group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          <div className="absolute inset-x-0 top-0 h-1 scale-x-0 rounded-t-xl bg-primary transition-transform duration-300 group-hover:scale-x-100" />
          <div className="sky-gradient flex h-10 w-10 items-center justify-center rounded-lg">
            <Icon icon={step.icon} size="md" className="text-ink-foreground" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Step {index + 1}
            </span>
            <p className="font-semibold text-foreground">{step.label}</p>
            {variant === 'full' ? (
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
