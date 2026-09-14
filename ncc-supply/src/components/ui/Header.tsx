import { LifeBuoy, LogOut, Menu, Search, ShoppingBasket, User, X } from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { logout } from '../../server/buyers/server-functions'
import { Icon } from './Icon'
import { Container } from './Layout'
import { Logo } from './Logo'
import { cn } from '../../lib/cn'

export interface HeaderCategory {
  slug: string
  title: string
}

export interface HeaderBuyer {
  companyName: string
  role: 'buyer' | 'company_admin'
}

export interface HeaderProps {
  categories: HeaderCategory[]
  buyer?: HeaderBuyer | null
}

/**
 * Internal nav destinations that don't have a real route yet in this phase
 * use plain anchors rather than the type-safe RouterLink (which requires
 * the target to already exist in the generated route tree). `/categories`
 * and `/search` get built for real immediately after this phase in the
 * same session; the rest (`/how-to-order`, `/contact`, `/account`,
 * `/basket`, `/support`, `/auth`) are later phases' own scope.
 */
const PRIMARY_NAV = [
  { label: 'Categories', href: '/categories' },
  { label: 'Bulk Order', href: '/bulk-order' },
  { label: 'Request a Quote', href: '/quote' },
  { label: 'How to Order', href: '/how-to-order' },
  { label: 'Contact', href: '/contact' },
]

const iconLinkClasses =
  'rounded-lg p-2 text-foreground/80 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function Header({ categories, buyer = null }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const signOut = useServerFn(logout)

  async function handleSignOut() {
    await signOut()
    window.location.href = '/'
  }

  useEffect(() => {
    if (!mobileOpen) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="sky-gradient py-1.5 text-center text-xs font-medium text-ink-foreground">
        Trade pricing on chargers, batteries, screens and repair parts — Available to order.
      </div>

      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="/" className="rounded-sm no-underline hover:no-underline">
          <Logo />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {PRIMARY_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="nav-underline text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <a href="/search" aria-label="Search" className={iconLinkClasses}>
            <Icon icon={Search} />
          </a>
          <a
            href="/support"
            aria-label="Help / Report an issue"
            className={cn(iconLinkClasses, 'flex items-center gap-1.5')}
          >
            <Icon icon={LifeBuoy} />
            <span className="hidden text-sm font-medium sm:inline">Help</span>
          </a>
          <a href="/basket" aria-label="Basket" className={iconLinkClasses}>
            <Icon icon={ShoppingBasket} />
          </a>
          <a
            href={buyer ? '/account' : '/auth'}
            aria-label={buyer ? `Account — ${buyer.companyName}` : 'Sign in'}
            className={cn(iconLinkClasses, 'hidden items-center gap-1.5 sm:inline-flex')}
          >
            <Icon icon={User} />
            {buyer ? (
              <span className="hidden text-sm font-medium lg:inline">{buyer.companyName}</span>
            ) : null}
          </a>
          {buyer ? (
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className={cn(iconLinkClasses, 'hidden sm:inline-flex')}
            >
              <Icon icon={LogOut} />
            </button>
          ) : null}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className={cn(iconLinkClasses, 'md:hidden')}
          >
            <Icon icon={mobileOpen ? X : Menu} />
          </button>
        </div>
      </Container>

      {categories.length > 0 ? (
        <div className="hidden border-t border-border/60 md:block">
          <Container>
            <nav aria-label="Categories" className="flex gap-1 overflow-x-auto py-2">
              {categories.map((category) => (
                <a
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-sky-soft hover:text-primary"
                >
                  {category.title}
                </a>
              ))}
            </nav>
          </Container>
        </div>
      ) : null}

      {mobileOpen ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border/60 md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {PRIMARY_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {item.label}
              </a>
            ))}
            <a
              href={buyer ? '/account' : '/auth'}
              className="rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-secondary"
            >
              {buyer ? `Account — ${buyer.companyName}` : 'Sign in'}
            </a>
            {buyer ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md px-2 py-2 text-left text-sm font-medium text-foreground hover:bg-secondary"
              >
                Sign out
              </button>
            ) : null}
          </Container>
        </nav>
      ) : null}
    </header>
  )
}
