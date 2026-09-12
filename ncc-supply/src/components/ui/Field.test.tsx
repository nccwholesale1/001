import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from './Field'

describe('Field', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Field label="Email address" />)
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('links help text via aria-describedby', () => {
    render(<Field label="Company name" helpText="As shown on your invoice." />)
    const input = screen.getByLabelText('Company name')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('As shown on your invoice.')
  })

  it('marks the field invalid and surfaces the error as an alert', () => {
    render(<Field label="Order reference" error="Not found." />)
    const input = screen.getByLabelText('Order reference')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Not found.')
  })

  it('disabled field cannot receive input', () => {
    render(<Field label="Disabled field" disabled defaultValue="locked" />)
    expect(screen.getByLabelText('Disabled field')).toBeDisabled()
  })
})
