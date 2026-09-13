import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useParallax } from '../../lib/use-parallax'
import { Container } from './Layout'

/**
 * Full-width banner block — design system §7 "Product banner (hero / promo /
 * category top)". Background is gradient only (hero-gradient), no grid-mesh
 * overlay — an explicit change from the design doc's original "hero-gradient
 * + grid-mesh at 40% opacity" spec, per business direction 2026-09-12.
 * grid-mesh remains available as a utility for other decorative use; it's
 * just not part of the banner treatment any more.
 *
 * `variant="hero"` is the full-bleed homepage/top-of-page treatment;
 * `variant="compact"` is the smaller in-page/category-top promo card.
 * Reused for both today; whether the homepage uses this directly or via
 * BannerCarousel is a later decision (see BannerCarousel.tsx).
 */
export interface BannerCta {
  label: string
  href?: string
  onClick?: () => void
}

export interface BannerProps {
  eyebrow?: string
  title: ReactNode
  description?: string
  primaryCta?: BannerCta
  secondaryCta?: BannerCta
  variant?: 'hero' | 'compact'
  className?: string
  children?: ReactNode
}

function CtaLink({ cta, variant }: { cta: BannerCta; variant: 'primary' | 'secondary' }) {
  const className = cn(
    'inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
    variant === 'primary'
      ? 'sky-gradient shimmer-sweep hover:scale-[1.03] active:scale-95 motion-reduce:hover:scale-100'
      : 'glow-hover border border-border bg-card/80 text-foreground hover:bg-secondary hover:-translate-y-0.5 active:translate-y-0',
  )
  if (cta.href) {
    return (
      <a href={cta.href} className={className}>
        {cta.label}
      </a>
    )
  }
  return (
    <button type="button" onClick={cta.onClick} className={className}>
      {cta.label}
    </button>
  )
}

export function Banner({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  variant = 'hero',
  className,
  children,
}: BannerProps) {
  const { ref: parallaxRef, offset } = useParallax(0.18)

  return (
    <div
      ref={variant === 'hero' ? parallaxRef : undefined}
      className={cn(
        'hero-gradient relative overflow-hidden',
        variant === 'hero' ? 'rounded-none' : 'rounded-xl',
        className,
      )}
    >
      {variant === 'hero' ? (
        <div
          aria-hidden="true"
          className="grid-mesh pointer-events-none absolute inset-0 opacity-60"
          style={{ transform: `translateY(${offset}px)` }}
        />
      ) : null}
      <Container
        className={cn(
          'relative flex flex-col gap-5',
          variant === 'hero' ? 'min-h-[320px] justify-center py-24 md:min-h-[420px]' : 'py-10',
        )}
      >
        {eyebrow ? (
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </span>
        ) : null}
        <h1
          className={cn(
            'max-w-3xl font-semibold leading-[1.05] tracking-tight text-foreground',
            variant === 'hero' ? 'text-4xl md:text-6xl' : 'text-2xl md:text-3xl',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-base text-muted-foreground md:text-lg">{description}</p>
        ) : null}
        {primaryCta || secondaryCta ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {primaryCta ? <CtaLink cta={primaryCta} variant="primary" /> : null}
            {secondaryCta ? <CtaLink cta={secondaryCta} variant="secondary" /> : null}
          </div>
        ) : null}
        {children}
      </Container>
    </div>
  )
}
