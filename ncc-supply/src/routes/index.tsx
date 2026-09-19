import { createFileRoute } from '@tanstack/react-router'
import { PackageCheck, ShieldCheck, Truck } from 'lucide-react'
import { EMPTY_PUBLIC_CATALOGUE, fetchPublicCatalogue, type PublicCatalogueData } from '../lib/public-catalogue'
import { Banner } from '../components/ui/Banner'
import { CategoryGrid } from '../components/ui/CategoryGrid'
import { FAQ, HOME_FAQ_ITEMS } from '../components/ui/FAQ'
import { Icon } from '../components/ui/Icon'
import { Container, Section } from '../components/ui/Layout'
import { OrderSteps } from '../components/ui/OrderSteps'
import { ProductCard } from '../components/ui/ProductCard'
import { Reveal } from '../components/ui/Reveal'

const HOME_FAQ_STRUCTURED_DATA = HOME_FAQ_ITEMS.map((item) => ({
  '@type': 'Question',
  name: item.question,
  acceptedAnswer: { '@type': 'Answer', text: item.answer },
}))

export const Route = createFileRoute('/')({
  ssr: false,
  loader: async (): Promise<PublicCatalogueData> => {
    // Never call createServerFn or self-fetch during the document request —
    // on Vercel that becomes {"message":"HTTPError"} even with try/catch.
    if (typeof window === 'undefined') return EMPTY_PUBLIC_CATALOGUE
    return fetchPublicCatalogue()
  },
  head: () => ({
    meta: [
      {
        name: 'description',
        content:
          'NCC Supply — trade pricing on mobile and device accessories and repair parts. Available to order, guest or company account.',
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify([
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'NCC Supply',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'NCC Supply',
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: '/search?q={search_term_string}' },
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: HOME_FAQ_STRUCTURED_DATA,
          },
        ]),
      },
    ],
  }),
  component: IndexRoute,
})

const TRUST_STATS = [
  {
    icon: PackageCheck,
    label: 'Available to order',
    description: 'Every listed line, ready to request',
  },
  { icon: ShieldCheck, label: 'Reviewed before dispatch', description: 'NCC confirms every order' },
  { icon: Truck, label: 'No card details upfront', description: 'Pay only after confirmation' },
]

function IndexRoute() {
  const { collections, popularProducts, error } = Route.useLoaderData()
  const totalLines = collections.reduce((sum, collection) => sum + collection.lineCount, 0)
  // Never hardcode a specific category slug — real Shopify collection
  // handles (e.g. "wall-chargers") don't match the old fixture-era guesses
  // (e.g. "chargers"), as going live surfaced. First real collection with
  // at least one line, so the CTA never points at an empty category.
  const featuredCollection = collections.find((collection) => collection.lineCount > 0) ?? collections[0]

  return (
    <>
      <Banner
        eyebrow={`${totalLines}+ lines · Available to order`}
        title={
          <>
            Trade pricing on mobile accessories,{' '}
            <span className="text-gradient">without the wait.</span>
          </>
        }
        description="Order chargers, batteries, screens and repair parts as a guest or a company account — no card details until NCC confirms your order."
        primaryCta={
          featuredCollection
            ? { label: `Shop ${featuredCollection.title}`, href: `/category/${featuredCollection.slug}` }
            : { label: 'Browse All Categories', href: '/categories' }
        }
        secondaryCta={{ label: 'Browse All Categories', href: '/categories' }}
      >
        <a
          href="/how-to-order"
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          See how ordering works →
        </a>

        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-border/60 pt-6 sm:grid-cols-3">
          {TRUST_STATS.map((stat, index) => (
            <Reveal key={stat.label} delayMs={index * 80}>
              <div className="group glow-hover flex items-center gap-3 rounded-xl p-2 text-left transition-transform duration-300 hover:-translate-y-1">
                <Icon icon={stat.icon} size="lg" className="shrink-0 text-primary transition-transform duration-300 group-hover:scale-110" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{stat.label}</span>
                  <span className="text-xs text-muted-foreground">{stat.description}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Banner>

      <Section>
        <Container>
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl text-ink-foreground">
              {/* Brand marketing image supplied directly by NCC for this decorative band — not tied to any product record, so not gated by "real catalogue image only" the way product/category imagery is. */}
              <img
                src="/banner-earbuds.jpg"
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-ink/20" />
              <div className="relative z-10 flex min-h-[380px] max-w-xl flex-col justify-center gap-5 p-8 sm:p-12">
                <span className="w-fit rounded-full border border-ink-foreground/15 bg-ink-foreground/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm">
                  Confirm before you pay
                </span>
                <h2 className="text-2xl font-semibold sm:text-3xl">
                  Build one basket, let NCC confirm the rest
                </h2>
                <p className="text-sm text-ink-foreground/70 sm:text-base">
                  Submit lines from any category with no payment up front — NCC checks stock,
                  confirms delivery, and you approve the final total before anything is
                  charged.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <a
                    href="/categories"
                    className="sky-gradient shimmer-sweep inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:hover:translate-y-0"
                  >
                    Browse Catalogue
                  </a>
                  <a
                    href="/how-to-order"
                    className="inline-flex items-center justify-center rounded-lg border border-ink-foreground/20 bg-ink-foreground/5 px-5 py-3 text-sm font-semibold text-ink-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-ink-foreground/10 active:translate-y-0"
                  >
                    How Ordering Works
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-8">
          <Reveal>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Shop By Category</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search or browse the full catalogue by category.
              </p>
            </div>
          </Reveal>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories found.</p>
          ) : (
            <CategoryGrid categories={collections} columns={3} />
          )}
        </Container>
      </Section>

      <Section tinted>
        <Container className="flex flex-col gap-8">
          <Reveal>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Popular This Month</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A sample of what's available to order right now.
              </p>
            </div>
          </Reveal>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : popularProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products found.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popularProducts.map((product, index) => (
                <Reveal key={product.sku} delayMs={index * 70}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
          )}
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-8">
          <Reveal>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                Process
              </span>
              <h2 className="mt-1 text-2xl font-semibold text-foreground">How It Works</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                From basket to confirmed order in five steps.
              </p>
            </div>
          </Reveal>
          <Reveal delayMs={100}>
            <OrderSteps variant="compact" />
          </Reveal>
        </Container>
      </Section>

      <Section tinted>
        <Container className="flex flex-col gap-8">
          <Reveal>
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The questions we hear most from guest and company buyers.
              </p>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <FAQ />
          </Reveal>
          <Reveal delayMs={140}>
            <div className="rounded-xl border border-primary/30 bg-hero-gradient p-6 shadow-soft">
              <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="font-semibold text-foreground">Still unsure?</p>
                  <p className="text-sm text-muted-foreground">
                    Reach out and we'll help you get started.
                  </p>
                </div>
                <a
                  href="/support"
                  className="sky-gradient shimmer-sweep inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 motion-reduce:hover:translate-y-0"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    </>
  )
}
