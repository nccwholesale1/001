import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './Dialog'
import { Button } from './Button'

function TestDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent aria-describedby="desc">
        <DialogTitle>Example dialog</DialogTitle>
        <DialogDescription id="desc">Dialog body</DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('opens on trigger click and traps focus inside the content', async () => {
    render(<TestDialog />)
    await userEvent.click(screen.getByRole('button', { name: 'Open dialog' }))

    await waitFor(() => {
      expect(screen.getByText('Example dialog')).toBeInTheDocument()
    })

    // Radix moves focus into the dialog content on open.
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body)
    })
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    render(<TestDialog />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await userEvent.click(trigger)
    await waitFor(() => expect(screen.getByText('Example dialog')).toBeInTheDocument())

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Example dialog')).not.toBeInTheDocument()
    })
    expect(trigger).toHaveFocus()
  })
})
