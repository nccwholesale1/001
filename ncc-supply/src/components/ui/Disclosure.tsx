import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Native <details>/<summary> per design system §7 FAQ spec — gives correct
 * disclosure semantics and keyboard behaviour for free, no ARIA needed.
 */
export interface DisclosureProps {
  summary: ReactNode
  children: ReactNode
  className?: string
  defaultOpen?: boolean
}

export function Disclosure({ summary, children, className, defaultOpen }: DisclosureProps) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group rounded-xl border border-border bg-card p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 open:border-primary/50 open:shadow-soft hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {summary}
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pt-3 text-sm text-muted-foreground">{children}</div>
    </details>
  )
}
