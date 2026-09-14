import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

const CATEGORIES = [
  { slug: 'chargers', title: 'Chargers' },
  { slug: 'screens', title: 'Screens' },
]

describe('Header', () => {
  it('always shows the Help entry point, never only in the footer', () => {
    render(<Header categories={CATEGORIES} />)
    expect(screen.getByRole('link', { name: /help/i })).toBeInTheDocument()
  })

  it('renders the provided category rail', () => {
    render(<Header categories={CATEGORIES} />)
    expect(screen.getByRole('link', { name: 'Chargers' })).toHaveAttribute(
      'href',
      '/category/chargers',
    )
  })

  it('toggles the mobile menu and closes on Escape, returning focus to the toggle', async () => {
    const user = userEvent.setup()
    render(<Header categories={CATEGORIES} />)

    const toggle = screen.getByRole('button', { name: /open menu/i })
    await user.click(toggle)
    expect(screen.getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveFocus()
  })

  it('renders no category rail when none are provided, without crashing', () => {
    render(<Header categories={[]} />)
    expect(screen.queryByRole('navigation', { name: 'Categories' })).not.toBeInTheDocument()
  })

  it('shows a basket badge with the real item count, defaulting to 0', () => {
    render(<Header categories={CATEGORIES} />)
    const basketLink = screen.getByRole('link', { name: /basket, 0 items/i })
    expect(basketLink).toBeInTheDocument()
    expect(basketLink).toHaveTextContent('0')
  })

  it('shows the exact count when the basket has items, singular vs plural', () => {
    const { rerender } = render(<Header categories={CATEGORIES} basketCount={1} />)
    expect(screen.getByRole('link', { name: /basket, 1 item\b/i })).toHaveTextContent('1')

    rerender(<Header categories={CATEGORIES} basketCount={7} />)
    expect(screen.getByRole('link', { name: /basket, 7 items/i })).toHaveTextContent('7')
  })
})
