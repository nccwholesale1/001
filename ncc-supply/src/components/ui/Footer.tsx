import { Container } from './Layout'
import { Logo } from './Logo'

/**
 * Design system §7 "Footer": bg-ink text-ink-foreground, 4-column grid at
 * md, muted copy at /70, fine print at /50. No staff-facing link is ever
 * placed here (PRD §5.2 / §6.22) — /staff/* is never linked from public
 * navigation at all.
 */
const FOOTER_COLUMNS = [
  {
    heading: 'Shop',
    links: [
      { label: 'All Categories', href: '/categories' },
      { label: 'Search', href: '/search' },
      { label: 'Bulk Order', href: '/bulk-order' },
    ],
  },
  {
    heading: 'Ordering',
    links: [
      { label: 'How to Order', href: '/how-to-order' },
      { label: 'Request a Quote', href: '/quote' },
      { label: 'Returns', href: '/returns' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Help / Report an Issue', href: '/support' },
      { label: 'Company Sign In', href: '/auth' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-ink-foreground">
      <Container className="grid gap-10 py-14 md:grid-cols-4">
        <div className="flex flex-col gap-3">
          {/* h-8 matches the logo's own height; the column headings below are
              pinned to the same height so every column's body copy starts on
              the same line instead of the brand column sitting 12px lower. */}
          <div className="flex h-8 items-center">
            <Logo variant="white" />
          </div>
          <p className="max-w-xs text-sm text-ink-foreground/70">
            Trade pricing on mobile and device accessories and repair parts. Available to order —
            NCC reviews and confirms every order before checkout.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.heading} className="flex flex-col gap-3">
            <span className="flex h-8 items-center text-sm font-semibold uppercase tracking-wide text-ink-foreground/70">
              {column.heading}
            </span>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-ink-foreground/70 hover:text-ink-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-ink-foreground/10 py-6">
        <Container className="flex flex-col gap-2 text-xs text-ink-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} NCC Supply. All rights reserved.</span>
          <span>Available to order — NCC reviews and confirms every order before checkout.</span>
        </Container>
      </div>
    </footer>
  )
}
