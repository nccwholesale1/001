const LINKS = [
  { label: 'Orders', href: '/staff/orders' },
  { label: 'Quotes', href: '/staff/quotes' },
  { label: 'Returns', href: '/staff/returns' },
  { label: 'Support', href: '/staff/support' },
  { label: 'Accounts', href: '/staff/accounts' },
  { label: 'Team', href: '/staff/team' },
]

/** Minimal cross-links between staff console sections — each staff page was previously an island with no way to reach the others. */
export function StaffNav() {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-4">
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {link.label}
        </a>
      ))}
    </nav>
  )
}
