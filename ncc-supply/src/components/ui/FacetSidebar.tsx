import { Check, Square, X } from 'lucide-react'
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

/**
 * Design system §5.2 "Facet sidebar" / "Filter bar". Every control is a
 * plain link, not a JS-driven checkbox/select — facet state lives entirely
 * in the URL (PRD §6.3: "shareable and crawlable"), so filtering works
 * with no client JS at all and search engines can follow every combination
 * directly.
 */
export function FacetSidebar({
  groups,
  appliedChips,
  clearAllHref,
  sortOptions,
  resultCount,
}: FacetSidebarProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort</span>
          <span className="flex overflow-hidden rounded-lg border border-border">
            {sortOptions.map((option) => (
              <a
                key={option.value}
                href={option.href}
                aria-current={option.active ? 'true' : undefined}
                className={
                  option.active
                    ? 'sky-gradient px-3 py-1.5 text-xs font-semibold'
                    : 'px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-secondary'
                }
              >
                {option.label}
              </a>
            ))}
          </span>
        </label>
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

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No filters available for these results.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <fieldset key={group.attribute} className="flex flex-col gap-2">
              <legend className="text-sm font-semibold text-foreground">{group.attribute}</legend>
              {group.options.map((option) => (
                <a
                  key={option.value}
                  href={option.href}
                  className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground/80 hover:bg-secondary"
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
          ))}
        </div>
      )}
    </div>
  )
}
