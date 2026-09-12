import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SearchBar } from './SearchBar'

const SUGGESTIONS = {
  products: [{ sku: 'NCC-SCR-001', title: 'Screen Protector' }],
  collections: [],
}

describe('SearchBar', () => {
  it('shows typeahead suggestions after typing past the minimum length', async () => {
    const user = userEvent.setup()
    const onSuggest = vi.fn().mockResolvedValue(SUGGESTIONS)
    render(<SearchBar onSuggest={onSuggest} />)

    await user.type(screen.getByRole('combobox'), 'screen')

    expect(await screen.findByRole('option', { name: /screen protector/i })).toBeInTheDocument()
    expect(onSuggest).toHaveBeenCalledWith('screen')
  })

  it('ArrowDown highlights the first suggestion, and Enter activates its link', async () => {
    const user = userEvent.setup()
    const onSuggest = vi.fn().mockResolvedValue(SUGGESTIONS)
    render(<SearchBar onSuggest={onSuggest} />)

    await user.type(screen.getByRole('combobox'), 'screen')
    const option = await screen.findByRole('option', { name: /screen protector/i })
    const link = option.querySelector('a') as HTMLAnchorElement
    const clickSpy = vi.spyOn(link, 'click')

    await user.keyboard('{ArrowDown}')
    expect(option).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Enter}')
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('Escape closes the dropdown', async () => {
    const user = userEvent.setup()
    const onSuggest = vi.fn().mockResolvedValue(SUGGESTIONS)
    render(<SearchBar onSuggest={onSuggest} />)

    await user.type(screen.getByRole('combobox'), 'screen')
    await screen.findByRole('listbox')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not query for a term shorter than the minimum length', async () => {
    const user = userEvent.setup()
    const onSuggest = vi.fn().mockResolvedValue(SUGGESTIONS)
    render(<SearchBar onSuggest={onSuggest} />)

    await user.type(screen.getByRole('combobox'), 'a')

    expect(onSuggest).not.toHaveBeenCalled()
  })
})
