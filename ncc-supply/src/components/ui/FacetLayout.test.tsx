import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FacetLayout } from './FacetLayout'

const GROUPS = [
  {
    attribute: 'Brand',
    options: [{ value: 'Anker', count: 3, active: false, href: '/category/chargers?filters=Brand:Anker' }],
  },
]

const SORT_OPTIONS = [{ value: 'relevance', label: 'Relevance', href: '/category/chargers', active: true }]

function renderLayout(appliedChips: Array<{ attribute: string; value: string; href: string }> = []) {
  return render(
    <FacetLayout
      groups={GROUPS}
      appliedChips={appliedChips}
      clearAllHref={appliedChips.length > 0 ? '/category/chargers' : null}
      sortOptions={SORT_OPTIONS}
      resultCount={12}
    >
      <p>Product grid placeholder</p>
    </FacetLayout>,
  )
}

describe('FacetLayout', () => {
  it('renders one filter bar (no separate mobile/desktop layout) with every facet group and sort as a dropdown', () => {
    renderLayout()
    // "Brand" appears twice by design — the visible summary label and the fieldset's sr-only legend naming it for assistive tech.
    expect(screen.getAllByText('Brand').length).toBe(2)
    expect(screen.getByText('Sort: Relevance')).toBeInTheDocument()
    expect(screen.getByText('Anker')).toBeInTheDocument()
    expect(screen.getByText('12 results')).toBeInTheDocument()
    expect(screen.getByText('Product grid placeholder')).toBeInTheDocument()
  })

  it('shows a count badge on a facet group only when it has active options', () => {
    const { container } = render(
      <FacetLayout
        groups={[
          {
            attribute: 'Brand',
            options: [{ value: 'Anker', count: 3, active: true, href: '/category/chargers' }],
          },
        ]}
        appliedChips={[{ attribute: 'Brand', value: 'Anker', href: '/category/chargers' }]}
        clearAllHref="/category/chargers"
        sortOptions={SORT_OPTIONS}
        resultCount={3}
      >
        <p>Product grid placeholder</p>
      </FacetLayout>,
    )
    const summary = screen.getAllByText('Brand').map((el) => el.closest('summary')).find(Boolean)
    expect(summary).toBeTruthy()
    expect(summary?.textContent).toContain('1')
    expect(container.querySelectorAll('details')).toHaveLength(2) // one per facet group, plus sort
  })

  it('renders applied-filter chips and a clear-all link', () => {
    renderLayout([{ attribute: 'Brand', value: 'Anker', href: '/category/chargers' }])
    expect(screen.getByRole('link', { name: /Brand: Anker/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clear all' })).toBeInTheDocument()
  })

  it('renders no facet dropdown at all when there are no filterable attributes', () => {
    render(
      <FacetLayout groups={[]} appliedChips={[]} clearAllHref={null} sortOptions={SORT_OPTIONS} resultCount={0}>
        <p>Product grid placeholder</p>
      </FacetLayout>,
    )
    expect(screen.queryByText('Brand')).not.toBeInTheDocument()
    expect(screen.getByText('Sort: Relevance')).toBeInTheDocument()
  })
})
