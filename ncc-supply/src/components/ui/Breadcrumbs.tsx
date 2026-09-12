export interface Breadcrumb {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: Breadcrumb[]
}

/** Design system §6.2/6.4 "Breadcrumb". Plain anchors — see Header.tsx for why. */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href && !isLast ? (
                <a href={item.href} className="hover:text-primary hover:underline">
                  {item.label}
                </a>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-foreground">
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
