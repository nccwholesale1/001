import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { BadgeCheck, PackageCheck, ShieldCheck, Truck } from 'lucide-react'
import { getCatalogueAdapter } from '../server/integrations/shopify'
import type { CollectionSummary, ProductSummary } from '../server/integrations/shopify/types'
import { Banner } from '../components/ui/Banner'
import { CategoryGrid } from '../components/ui/CategoryGrid'
import { FAQ, HOME_FAQ_ITEMS } from '../components/ui/FAQ'
import { Icon } from '../components/ui/Icon'
import { Container, Section } from '../components/ui/Layout'
import { OrderSteps } from '../components/ui/OrderSteps'
import { ProductCard } from '../components/ui/ProductCard'
import { Reveal } from '../components/ui/Reveal'

interface HomeData {
  collections: CollectionSummary[]
  /** A sample of real catalogue data from the first collection — not a true popularity ranking (no analytics source exists yet). */
  popularProducts: ProductSummary[]
  error: string | null
}

const HOME_FAQ_STRUCTURED_DATA = HOME_FAQ_ITEMS.map((item) => ({
  '@type': 'Question',
  name: item.question,
  acceptedAnswer: { '@type': 'Answer', text: item.answer },
}))

const getHomeData = createServerFn({ method: 'GET' }).handler(async (): Promise<HomeData> => {
  const adapter = getCatalogueAdapter()
  try {
    const collections = await adapter.listCollections()
    const firstCollection = collections[0]
    const popularProducts = firstCollection
      ? (await adapter.getCollection(firstCollection.slug, { first: 8 })).products
      : []
    return { collections, popularProducts, error: null }
  } catch (error) {
    console.error('[home] failed to load catalogue data', error)
    return {
      collections: [],
      popularProducts: [],
      error: 'Could not load catalogue data right now.',
    }
  }
})

export const Route = createFileRoute('/')({
  loader: () => getHomeData(),
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
  { icon: BadgeCheck, label: 'Any quantity', description: 'No minimum or maximum order size' },
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
      </Banner>

      <Section className="border-b border-border/60">
        <Container>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {TRUST_STATS.map((stat, index) => (
              <Reveal key={stat.label} delayMs={index * 80}>
                <div className="group glow-hover flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-transform duration-300 hover:-translate-y-1">
                  <Icon icon={stat.icon} size="lg" className="text-primary transition-transform duration-300 group-hover:scale-110" />
                  <span className="text-sm font-semibold text-foreground">{stat.label}</span>
                  <span className="text-xs text-muted-foreground">{stat.description}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <Reveal>
            <div className="surface-card grid grid-cols-1 overflow-hidden rounded-2xl p-0 md:grid-cols-2">
              <div className="flex flex-col justify-center gap-5 p-8 sm:p-12">
                <span className="w-fit rounded-full bg-sky-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Confirmed before you pay
                </span>
                <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
                  Build one basket, let NCC confirm the rest
                </h2>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Submit lines from any category with no payment up front — NCC checks stock,
                  confirms delivery and VAT, and you approve the final total before anything is
                  charged.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <a
                    href="/categories"
                    className="sky-gradient shimmer-sweep inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:scale-[1.03] active:scale-95 motion-reduce:hover:scale-100"
                  >
                    Browse Catalogue
                  </a>
                  <a
                    href="/how-to-order"
                    className="glow-hover inline-flex items-center justify-center rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-secondary active:translate-y-0"
                  >
                    How Ordering Works
                  </a>
                </div>
              </div>
              {/* Image slot — placeholder until real product photography is supplied (design system §7's placeholder rule); never left blank. */}
              <div className="sky-gradient grid-mesh min-h-[220px] transition-transform duration-700 hover:scale-105" role="img" aria-label="NCC Supply product range" />
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
            <CategoryGrid categories={collections} />
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
                  href="/contact"
                  className="sky-gradient shimmer-sweep inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:scale-[1.03] active:scale-95 motion-reduce:hover:scale-100"
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
