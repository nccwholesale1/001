import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('renders the static sidebar (for lg+ viewports) without opening anything', () => {
    renderLayout()
    // Two copies of the same facet content exist for CSS-only breakpoint
    // switching (PRD §5.3) — the static aside is always in the DOM.
    expect(screen.getAllByText('Brand').length).toBeGreaterThan(0)
    expect(screen.getByText('Product grid placeholder')).toBeInTheDocument()
  })

  it('opens a full-screen sheet with the same filters when the mobile trigger is clicked', async () => {
    renderLayout()
    const trigger = screen.getByRole('button', { name: /Filters & Sort/i })
    await userEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Filters & Sort' })).toBeInTheDocument()
    })
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Anker')).toBeInTheDocument()
  })

  it('shows a count badge on the trigger when filters are applied', () => {
    renderLayout([{ attribute: 'Brand', value: 'Anker', href: '/category/chargers' }])
    const trigger = screen.getByRole('button', { name: /Filters & Sort/i })
    expect(within(trigger).getByText('1')).toBeInTheDocument()
  })
})
