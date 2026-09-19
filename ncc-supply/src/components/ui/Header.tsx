import { LifeBuoy, LogOut, Menu, Search, ShoppingBasket, User, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ClientOnly } from '../ClientOnly'
import { CategoryRail } from './CategoryRail'
import { Icon } from './Icon'
import { Container } from './Layout'
import { Logo } from './Logo'
import { cn } from '../../lib/cn'

const SignOutButton = lazy(async () => {
  const module = await import('./SignOutButton')
  return { default: module.SignOutButton }
})

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
  basketCount?: number
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
  // Contact is deliberately absent: no /contact route exists, so the link
  // 404'd. It returns when the admin dashboard ships. /support covers
  // customer queries in the meantime.
]

const iconLinkClasses =
  'rounded-lg p-2 text-foreground/80 transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function Header({ categories = [], buyer = null, basketCount = 0 }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

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
        Every line available to order — NCC confirms stock and delivery before you pay.
      </div>

      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="/" className="rounded-sm no-underline hover:no-underline">
          <Logo />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
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
          <a
            href="/basket"
            aria-label={`Basket, ${basketCount} ${basketCount === 1 ? 'item' : 'items'}`}
            className="glow-hover flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/5 px-2.5 py-2 text-primary transition-colors hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Icon icon={ShoppingBasket} />
            <span className="hidden text-sm font-semibold sm:inline">Basket</span>
            <span
              className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold transition-colors',
                basketCount > 0 ? 'sky-gradient' : 'bg-card text-primary',
              )}
            >
              {basketCount}
            </span>
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
            <ClientOnly
              fallback={
                <button
                  type="button"
                  disabled
                  aria-label="Sign out"
                  className={cn(iconLinkClasses, 'hidden sm:inline-flex')}
                >
                  <Icon icon={LogOut} />
                </button>
              }
            >
              <Suspense
                fallback={
                  <button
                    type="button"
                    disabled
                    aria-label="Sign out"
                    className={cn(iconLinkClasses, 'hidden sm:inline-flex')}
                  >
                    <Icon icon={LogOut} />
                  </button>
                }
              >
                <SignOutButton className={cn(iconLinkClasses, 'hidden sm:inline-flex')}>
                  <Icon icon={LogOut} />
                </SignOutButton>
              </Suspense>
            </ClientOnly>
          ) : null}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className={cn(iconLinkClasses, 'lg:hidden')}
          >
            <Icon icon={mobileOpen ? X : Menu} />
          </button>
        </div>
      </Container>

      {categories.length > 0 ? (
        <div className="hidden border-t border-border/60 md:block">
          <Container>
            <CategoryRail categories={categories} />
          </Container>
        </div>
      ) : null}

      {mobileOpen ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border/60 lg:hidden">
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
              <Suspense fallback={null}>
                <SignOutButton className="rounded-md px-2 py-2 text-left text-sm font-medium text-foreground hover:bg-secondary">
                  Sign out
                </SignOutButton>
              </Suspense>
            ) : null}
          </Container>
        </nav>
      ) : null}
    </header>
  )
}
