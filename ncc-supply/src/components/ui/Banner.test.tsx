import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from './Banner'

describe('Banner', () => {
  it('renders the heading, description, and both CTAs', () => {
    render(
      <Banner
        eyebrow="Lorem ipsum"
        title="Trade parts, ordered right"
        description="Available to order across the full catalogue."
        primaryCta={{ label: 'Shop chargers', href: '/category/chargers' }}
        secondaryCta={{ label: 'How it works', href: '/how-to-order' }}
      />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Trade parts, ordered right' })).toBeInTheDocument()
    expect(screen.getByText(/Available to order/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Shop chargers' })).toHaveAttribute('href', '/category/chargers')
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/how-to-order')
  })

  it('renders a button (not a link) CTA when no href is given, and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Banner title="Promo" primaryCta={{ label: 'Notify me', onClick }} />)
    const button = screen.getByRole('button', { name: 'Notify me' })
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies gradient-only background, never grid-mesh, per the 2026-09-12 banner styling decision', () => {
    const { container } = render(<Banner title="Compact promo" variant="compact" />)
    const root = container.firstElementChild
    expect(root?.className).toMatch(/hero-gradient/)
    expect(root?.className).not.toMatch(/grid-mesh/)
  })

  it('hero variant uses the larger min-height treatment, compact does not', () => {
    const { container: hero } = render(<Banner title="Hero" variant="hero" />)
    const { container: compact } = render(<Banner title="Compact" variant="compact" />)
    expect(hero.innerHTML).toMatch(/min-h-\[320px\]/)
    expect(compact.innerHTML).not.toMatch(/min-h-\[320px\]/)
  })
})
