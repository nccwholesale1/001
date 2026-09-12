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

  return (
    <>
      <Banner
        eyebrow="Lorem ipsum · Available to order"
        title={
          <>
            Trade pricing on mobile accessories,{' '}
            <span className="text-gradient">without the wait.</span>
          </>
        }
        description="Order chargers, batteries, screens and repair parts as a guest or a company account — no card details until NCC confirms your order."
        primaryCta={{ label: 'Shop Chargers', href: '/category/chargers' }}
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
            {TRUST_STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-2 text-center">
                <Icon icon={stat.icon} size="lg" className="text-primary" />
                <span className="text-sm font-semibold text-foreground">{stat.label}</span>
                <span className="text-xs text-muted-foreground">{stat.description}</span>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Shop By Category</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search or browse the full catalogue by category.
            </p>
          </div>
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
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Popular This Month</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A sample of what's available to order right now.
            </p>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : popularProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No products found.</p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popularProducts.map((product) => (
                <ProductCard key={product.sku} product={product} />
              ))}
            </div>
          )}
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Process
            </span>
            <h2 className="mt-1 text-2xl font-semibold text-foreground">How It Works</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From basket to confirmed order in five steps.
            </p>
          </div>
          <OrderSteps variant="compact" />
        </Container>
      </Section>

      <Section tinted>
        <Container className="flex flex-col gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Frequently Asked Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The questions we hear most from guest and company buyers.
            </p>
          </div>
          <FAQ />
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
                className="sky-gradient inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-transform duration-200 hover:scale-[1.03] active:scale-95 motion-reduce:hover:scale-100"
              >
                Contact Us
              </a>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
