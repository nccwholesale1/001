import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Disclosure } from './Disclosure'

describe('Disclosure', () => {
  it('is closed by default and opens on click of the summary', async () => {
    render(<Disclosure summary="Question?">Answer text.</Disclosure>)
    const details = screen.getByText('Answer text.').closest('details')
    expect(details).not.toHaveAttribute('open')

    await userEvent.click(screen.getByText('Question?'))
    expect(details).toHaveAttribute('open')
  })

  it('honours defaultOpen', () => {
    render(
      <Disclosure summary="Already open" defaultOpen>
        Visible content.
      </Disclosure>,
    )
    const details = screen.getByText('Visible content.').closest('details')
    expect(details).toHaveAttribute('open')
  })

  it('the summary is keyboard-focusable via Tab', async () => {
    // Native <summary> Enter/Space-to-toggle is provided by the browser itself,
    // not by this component, and jsdom doesn't implement that native behaviour
    // (a known jsdom gap, not a bug here) — verified manually in a real browser
    // per PHASE_HANDOFF.md's breakpoint/keyboard check instead.
    render(<Disclosure summary="Keyboard question">Keyboard answer.</Disclosure>)
    await userEvent.tab()
    const summary = screen.getByText('Keyboard question').closest('summary')
    expect(summary).toHaveFocus()
  })
})
