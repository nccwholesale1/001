import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders children and responds to click', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Add to basket</Button>)
    const button = screen.getByRole('button', { name: 'Add to basket' })
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is keyboard-focusable and shows a visible focus ring class', async () => {
    render(<Button>Focus me</Button>)
    const button = screen.getByRole('button', { name: 'Focus me' })
    await userEvent.tab()
    expect(button).toHaveFocus()
    expect(button.className).toMatch(/focus-visible:ring-2/)
  })

  it('disabled button is not focusable and does not fire onClick', async () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('secondary and tertiary variants render without the sky-gradient class', () => {
    render(
      <>
        <Button variant="secondary">Secondary</Button>
        <Button variant="tertiary">Tertiary</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Secondary' }).className).not.toMatch(/sky-gradient/)
    expect(screen.getByRole('button', { name: 'Tertiary' }).className).not.toMatch(/sky-gradient/)
  })

  it('reduced-motion: primary variant declares a motion-reduce override on the hover transform', () => {
    render(<Button>Primary</Button>)
    const button = screen.getByRole('button', { name: 'Primary' })
    expect(button.className).toMatch(/motion-reduce:hover:scale-100/)
  })
})
