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
  /** A real photo (never a fabricated stock image) as a full-bleed background with a dark scrim, instead of the plain gradient — e.g. a category's own/representative catalogue image. */
  imageUrl?: string
}

function CtaLink({
  cta,
  variant,
  onImage,
}: {
  cta: BannerCta
  variant: 'primary' | 'secondary'
  onImage: boolean
}) {
  const className = cn(
    'inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
    variant === 'primary'
      ? 'sky-gradient shimmer-sweep hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:hover:translate-y-0'
      : onImage
        ? 'border border-ink-foreground/20 bg-ink-foreground/5 text-ink-foreground hover:-translate-y-0.5 hover:bg-ink-foreground/10 active:translate-y-0'
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
  imageUrl,
}: BannerProps) {
  const { ref: parallaxRef, offset } = useParallax(0.18)
  const onImage = Boolean(imageUrl)

  return (
    <div
      ref={variant === 'hero' && !onImage ? parallaxRef : undefined}
      className={cn(
        'relative overflow-hidden',
        onImage ? 'bg-ink' : 'hero-gradient',
        variant === 'hero' ? 'rounded-none' : 'rounded-xl',
        className,
      )}
    >
      {onImage ? (
        <>
          <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-ink/20" />
        </>
      ) : variant === 'hero' ? (
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
          <span
            className={cn(
              'w-fit rounded-full px-3 py-1 text-xs font-semibold tracking-wide shadow-sm backdrop-blur-sm',
              onImage
                ? 'border border-ink-foreground/15 bg-ink-foreground/10 text-ink-foreground'
                : 'border border-primary/25 bg-card/80 text-primary',
            )}
          >
            {eyebrow}
          </span>
        ) : null}
        <h1
          className={cn(
            'max-w-3xl font-semibold leading-[1.05] tracking-tight',
            onImage ? 'text-ink-foreground' : 'text-foreground',
            variant === 'hero' ? 'text-4xl md:text-6xl' : 'text-2xl md:text-3xl',
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              'max-w-2xl text-base md:text-lg',
              onImage ? 'text-ink-foreground/70' : 'text-muted-foreground',
            )}
          >
            {description}
          </p>
        ) : null}
        {primaryCta || secondaryCta ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {primaryCta ? <CtaLink cta={primaryCta} variant="primary" onImage={onImage} /> : null}
            {secondaryCta ? <CtaLink cta={secondaryCta} variant="secondary" onImage={onImage} /> : null}
          </div>
        ) : null}
        {children}
      </Container>
    </div>
  )
}
