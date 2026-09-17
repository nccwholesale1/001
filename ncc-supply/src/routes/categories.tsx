import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCatalogueAdapter } from '../server/integrations/shopify'
import type { CollectionSummary } from '../server/integrations/shopify/types'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { CategoryGrid } from '../components/ui/CategoryGrid'
import { Container, Section } from '../components/ui/Layout'

interface CategoriesData {
  collections: CollectionSummary[]
  error: string | null
}

const getCategoriesData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CategoriesData> => {
    try {
      const collections = await getCatalogueAdapter().listCollections()
      return { collections, error: null }
    } catch (error) {
      console.error('[categories] failed to load collections', error)
      return { collections: [], error: 'Could not load categories right now.' }
    }
  },
)

export const Route = createFileRoute('/categories')({
  ssr: false,
  loader: async () => {
    try {
      return await getCategoriesData()
    } catch (error) {
      console.error('[categories] loader failed', error)
      return { collections: [], error: 'Could not load categories right now.' } satisfies CategoriesData
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: 'All Categories · NCC Supply' },
      {
        name: 'description',
        content:
          'Browse the full NCC Supply catalogue by category — chargers, batteries, screens, repair parts and more.',
      },
    ],
    scripts: loaderData?.collections.length
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: loaderData.collections.map((collection, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: collection.title,
                url: `/category/${collection.slug}`,
              })),
            }),
          },
        ]
      : [],
  }),
  component: CategoriesRoute,
})

function CategoriesRoute() {
  const { collections, error } = Route.useLoaderData()

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'All Categories' }]} />
        <div>
          <h1 className="text-3xl font-semibold text-foreground">All Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the full catalogue by category.
          </p>
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <CategoryGrid categories={collections} />
        )}
      </Container>
    </Section>
  )
}
