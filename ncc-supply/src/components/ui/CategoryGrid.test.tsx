import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CategoryGrid } from './CategoryGrid'

const CATEGORIES = [
  { slug: 'chargers', title: 'Chargers', description: '', lineCount: 12, thumbnail: null },
  { slug: 'screens', title: 'Screens', description: '', lineCount: 4, thumbnail: null },
]

describe('CategoryGrid', () => {
  it('renders every category with a real line count, not a fabricated one', () => {
    render(<CategoryGrid categories={CATEGORIES} />)
    expect(screen.getByText('12 lines')).toBeInTheDocument()
    expect(screen.getByText('4 lines')).toBeInTheDocument()
  })

  it('filters tiles by the search box', async () => {
    const user = userEvent.setup()
    render(<CategoryGrid categories={CATEGORIES} />)

    await user.type(screen.getByPlaceholderText(/search categories/i), 'charg')

    expect(screen.getByRole('link', { name: /chargers/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /screens/i })).not.toBeInTheDocument()
  })

  it('shows an honest empty state instead of fake tiles when nothing matches', async () => {
    const user = userEvent.setup()
    render(<CategoryGrid categories={CATEGORIES} />)

    await user.type(screen.getByPlaceholderText(/search categories/i), 'nonexistent')

    expect(screen.getByText(/no categories found/i)).toBeInTheDocument()
  })
})
