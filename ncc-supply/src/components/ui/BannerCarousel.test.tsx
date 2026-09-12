import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { BannerCarousel } from './BannerCarousel'

const slides = [
  { title: 'Slide one' },
  { title: 'Slide two' },
  { title: 'Slide three' },
]

describe('BannerCarousel', () => {
  it('renders the first slide initially and announces position', () => {
    render(<BannerCarousel slides={slides} />)
    expect(screen.getByRole('heading', { name: 'Slide one' })).toBeInTheDocument()
    expect(screen.getByText('Slide 1 of 3')).toBeInTheDocument()
  })

  it('advances to the next slide on next-button click, and wraps around', async () => {
    render(<BannerCarousel slides={slides} />)
    const next = screen.getByRole('button', { name: 'Next slide' })

    await userEvent.click(next)
    expect(screen.getByRole('heading', { name: 'Slide two' })).toBeInTheDocument()

    await userEvent.click(next)
    await userEvent.click(next)
    expect(screen.getByRole('heading', { name: 'Slide one' })).toBeInTheDocument()
  })

  it('jumps to a slide via its dot indicator, with aria-current on the active one', async () => {
    render(<BannerCarousel slides={slides} />)
    const dot3 = screen.getByRole('button', { name: 'Go to slide 3' })
    await userEvent.click(dot3)
    expect(screen.getByRole('heading', { name: 'Slide three' })).toBeInTheDocument()
    expect(dot3).toHaveAttribute('aria-current', 'true')
  })

  it('supports left/right arrow keys', async () => {
    render(<BannerCarousel slides={slides} />)
    const region = screen.getByRole('region', { name: 'Featured' })
    region.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('heading', { name: 'Slide two' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('heading', { name: 'Slide one' })).toBeInTheDocument()
  })

  it('renders no prev/next/dots when there is only one slide', () => {
    render(<BannerCarousel slides={[{ title: 'Only slide' }]} />)
    expect(screen.queryByRole('button', { name: 'Next slide' })).not.toBeInTheDocument()
  })

  it('renders nothing for an empty slide list rather than throwing', () => {
    const { container } = render(<BannerCarousel slides={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
