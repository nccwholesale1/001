import { Check, ChevronDown, Square, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from './Icon'

export interface FacetOptionView {
  value: string
  count: number
  active: boolean
  /** Toggles this value on/off, preserving every other active filter/sort/query param. */
  href: string
}

export interface FacetGroupView {
  attribute: string
  options: FacetOptionView[]
}

export interface AppliedChipView {
  attribute: string
  value: string
  /** Removes just this one filter. */
  href: string
}

export interface SortOptionView {
  value: string
  label: string
  href: string
  active: boolean
}

export interface FacetSidebarProps {
  groups: FacetGroupView[]
  appliedChips: AppliedChipView[]
  clearAllHref: string | null
  sortOptions: SortOptionView[]
  resultCount: number
}

const pillTriggerClasses =
  'inline-flex list-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground marker:content-none hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden'

/**
 * Every dropdown is a native <details>/<summary> — same zero-JS, fully
 * keyboard-operable disclosure primitive already used for the FAQ
 * accordion (see Disclosure.tsx). No JS means no "only one open at a
 * time"/click-outside-to-close coordination between dropdowns; that's an
 * accepted tradeoff for keeping every filter a plain link with no client
 * JS required (facet state lives entirely in the URL — shareable and
 * crawlable, PRD §6.3).
 */
function FilterDropdown({ label, badge, children }: { label: string; badge?: number; children: ReactNode }) {
  return (
    <details className="group relative">
      <summary className={pillTriggerClasses}>
        {label}
        {badge ? (
          <span className="sky-gradient inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold">
            {badge}
          </span>
        ) : null}
        <Icon
          icon={ChevronDown}
          size="sm"
          className="text-muted-foreground transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="surface-card absolute left-0 z-20 mt-2 min-w-56 rounded-lg p-2">{children}</div>
    </details>
  )
}

/**
 * Filter bar — a compact row of dropdown pills (one per facet attribute,
 * plus sort) that wraps naturally at any width, replacing the previous
 * fixed-width sidebar + full-screen mobile sheet with one layout for every
 * breakpoint. Every option is still a plain link (no client JS needed for
 * filtering to work) and every group still supports multiple simultaneous
 * selections — only the chrome changed, not the underlying facet
 * mechanics.
 */
export function FacetSidebar({
  groups,
  appliedChips,
  clearAllHref,
  sortOptions,
  resultCount,
}: FacetSidebarProps) {
  const activeSort = sortOptions.find((option) => option.active)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {groups.map((group) => {
          const activeCount = group.options.filter((option) => option.active).length
          return (
            <FilterDropdown key={group.attribute} label={group.attribute} badge={activeCount || undefined}>
              <fieldset className="flex flex-col gap-0.5">
                <legend className="sr-only">{group.attribute}</legend>
                {group.options.map((option) => (
                  <a
                    key={option.value}
                    href={option.href}
                    className="flex items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-secondary"
                  >
                    <Icon
                      icon={option.active ? Check : Square}
                      size="sm"
                      className={option.active ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <span className="flex-1">{option.value}</span>
                    <span className="text-xs text-muted-foreground">{option.count}</span>
                  </a>
                ))}
              </fieldset>
            </FilterDropdown>
          )
        })}

        {sortOptions.length > 0 ? (
          <FilterDropdown label={`Sort: ${activeSort?.label ?? sortOptions[0]?.label ?? ''}`}>
            <div className="flex flex-col gap-0.5">
              {sortOptions.map((option) => (
                <a
                  key={option.value}
                  href={option.href}
                  aria-current={option.active ? 'true' : undefined}
                  className={cn(
                    'whitespace-nowrap rounded-md px-2 py-1.5 text-sm',
                    option.active ? 'bg-secondary font-semibold text-foreground' : 'text-foreground/80 hover:bg-secondary',
                  )}
                >
                  {option.label}
                </a>
              ))}
            </div>
          </FilterDropdown>
        ) : null}

        <span className="ml-auto text-sm text-muted-foreground">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>

      {appliedChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {appliedChips.map((chip) => (
            <a
              key={`${chip.attribute}:${chip.value}`}
              href={chip.href}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
            >
              {chip.attribute}: {chip.value}
              <Icon icon={X} size="sm" className="h-3 w-3" />
            </a>
          ))}
          {clearAllHref ? (
            <a href={clearAllHref} className="text-xs font-medium text-primary hover:underline">
              Clear all
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
