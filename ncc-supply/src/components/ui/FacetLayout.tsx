import type { ReactNode } from 'react'
import { FacetSidebar, type FacetSidebarProps } from './FacetSidebar'

export interface FacetLayoutProps extends FacetSidebarProps {
  /** The results grid + pagination — rendered below the filter bar. */
  children: ReactNode
}

/**
 * Collection/search listing shell. Previously a fixed-width sidebar at
 * `lg`+ and a separate full-screen mobile sheet below it — replaced with
 * one compact, wrapping filter bar (`FacetSidebar`) that reads the same at
 * every breakpoint, matching the reference site's pattern rather than
 * maintaining two layouts for the same controls.
 */
export function FacetLayout({ children, ...facetProps }: FacetLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
      <FacetSidebar {...facetProps} />
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}
