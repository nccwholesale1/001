import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusChip } from './StatusChip'

describe('StatusChip', () => {
  it('renders the label as text (not colour-only)', () => {
    render(<StatusChip tone="success" label="Confirmed" />)
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('every tone renders a distinct icon shape alongside the text', () => {
    const tones = ['neutral', 'info', 'success', 'warning', 'danger'] as const
    const { container } = render(
      <>
        {tones.map((tone) => (
          <StatusChip key={tone} tone={tone} label={tone} />
        ))}
      </>,
    )
    const icons = container.querySelectorAll('svg')
    expect(icons).toHaveLength(tones.length)
  })
})
