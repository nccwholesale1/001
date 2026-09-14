import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCatalogueAdapter } from '../../server/integrations/shopify'
import type { CollectionResult, FacetFilter } from '../../server/integrations/shopify/types'
import { Banner } from '../../components/ui/Banner'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { Container, Section } from '../../components/ui/Layout'
import { FacetLayout } from '../../components/ui/FacetLayout'
import type { AppliedChipView, FacetGroupView, SortOptionView } from '../../components/ui/FacetSidebar'
import { Pagination } from '../../components/ui/Pagination'
import { ProductCard } from '../../components/ui/ProductCard'
import { Reveal } from '../../components/ui/Reveal'
import { cn } from '../../lib/cn'

const PAGE_SIZE = 12
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'title_asc', label: 'A–Z' },
] as const
type SortValue = (typeof SORT_OPTIONS)[number]['value']

const categorySearchSchema = z.object({
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'title_asc']).optional(),
  after: z.string().optional(),
  /** "Attribute:Value,Attribute:Value2" — a single string param, not an array, so it round-trips through the URL unambiguously (see DECISIONS.md ADR-015). */
  filters: z.string().optional(),
})
type CategorySearch = z.infer<typeof categorySearchSchema>

function parseFiltersParam(raw: string | undefined): FacetFilter[] {
  if (!raw) return []
  const grouped = new Map<string, string[]>()
  for (const pair of raw.split(',')) {
    const separatorIndex = pair.indexOf(':')
    if (separatorIndex === -1) continue
    const attribute = decodeURIComponent(pair.slice(0, separatorIndex))
    const value = decodeURIComponent(pair.slice(separatorIndex + 1))
    grouped.set(attribute, [...(grouped.get(attribute) ?? []), value])
  }
  return Array.from(grouped.entries()).map(([attribute, values]) => ({ attribute, values }))
}

function stringifyFilters(filters: FacetFilter[]): string | undefined {
  const pairs = filters.flatMap((filter) =>
    filter.values.map(
      (value) => `${encodeURIComponent(filter.attribute)}:${encodeURIComponent(value)}`,
    ),
  )
  return pairs.length > 0 ? pairs.join(',') : undefined
}

function buildHref(slug: string, overrides: CategorySearch): string {
  const params = new URLSearchParams()
  if (overrides.sort && overrides.sort !== 'relevance') params.set('sort', overrides.sort)
  if (overrides.after) params.set('after', overrides.after)
  if (overrides.filters) params.set('filters', overrides.filters)
  const query = params.toString()
  return `/category/${slug}${query ? `?${query}` : ''}`
}

function toggleFilter(filters: FacetFilter[], attribute: string, value: string): FacetFilter[] {
  const existing = filters.find((f) => f.attribute === attribute)
  if (!existing) return [...filters, { attribute, values: [value] }]
  const hasValue = existing.values.includes(value)
  const nextValues = hasValue
    ? existing.values.filter((v) => v !== value)
    : [...existing.values, value]
  return filters
    .map((f) => (f.attribute === attribute ? { ...f, values: nextValues } : f))
    .filter((f) => f.values.length > 0)
}

interface CategoryData {
  slug: string
  result: CollectionResult | null
  error: string | null
}

const categoryDataQuerySchema = categorySearchSchema.extend({ slug: z.string().min(1).max(200) }).strict()

const getCategoryData = createServerFn({ method: 'GET' })
  .validator(categoryDataQuerySchema.parse)
  .handler(async ({ data }): Promise<CategoryData> => {
    try {
      const result = await getCatalogueAdapter().getCollection(data.slug, {
        first: PAGE_SIZE,
        after: data.after,
        sort: data.sort,
        filters: parseFiltersParam(data.filters),
      })
      return { slug: data.slug, result, error: null }
    } catch (error) {
      console.error('[category] failed to load collection', error)
      return { slug: data.slug, result: null, error: 'Could not load this category right now.' }
    }
  })

export const Route = createFileRoute('/category/$slug')({
  validateSearch: categorySearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getCategoryData({ data: { slug: params.slug, ...deps } }),
  head: ({ loaderData, params }) => {
    const result = loaderData?.result
    const hasNoResults = !result || result.products.length === 0
    return {
      meta: [
        { title: result ? `${result.title} · NCC Supply` : `${params.slug} · NCC Supply` },
        ...(hasNoResults ? [{ name: 'robots', content: 'noindex' }] : []),
      ],
      links: [{ rel: 'canonical', href: `/category/${params.slug}` }],
      scripts:
        result && result.products.length > 0
          ? [
              {
                type: 'application/ld+json',
                children: JSON.stringify([
                  {
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                      { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
                      { '@type': 'ListItem', position: 2, name: 'Categories', item: '/categories' },
                      { '@type': 'ListItem', position: 3, name: result.title },
                    ],
                  },
                  {
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    itemListElement: result.products.map((product, index) => ({
                      '@type': 'ListItem',
                      position: index + 1,
                      name: product.title,
                      url: `/product/${product.sku}`,
                    })),
                  },
                ]),
              },
            ]
          : [],
    }
  },
  component: CategoryRoute,
})

function CategoryRoute() {
  const { slug, result, error } = Route.useLoaderData()
  const search = Route.useSearch()
  const activeFilters = parseFiltersParam(search.filters)
  const activeSort: SortValue = search.sort ?? 'relevance'

  if (error || !result) {
    return (
      <Section>
        <Container>
          <p className="text-sm text-destructive">{error ?? 'Could not load this category.'}</p>
        </Container>
      </Section>
    )
  }

  const sortOptions: SortOptionView[] = SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    active: option.value === activeSort,
    href: buildHref(slug, { sort: option.value, filters: search.filters }),
  }))

  const facetsByAttribute = new Map<string, typeof result.availableFacets>()
  for (const facet of result.availableFacets) {
    facetsByAttribute.set(facet.attribute, [
      ...(facetsByAttribute.get(facet.attribute) ?? []),
      facet,
    ])
  }
  const groups: FacetGroupView[] = Array.from(facetsByAttribute.entries()).map(
    ([attribute, options]) => ({
      attribute,
      options: options.map((option) => {
        const active = activeFilters.some(
          (f) => f.attribute === attribute && f.values.includes(option.value),
        )
        return {
          value: option.value,
          count: option.count,
          active,
          href: buildHref(slug, {
            sort: activeSort,
            filters: stringifyFilters(toggleFilter(activeFilters, attribute, option.value)),
          }),
        }
      }),
    }),
  )

  const appliedChips: AppliedChipView[] = activeFilters.flatMap((filter) =>
    filter.values.map((value) => ({
      attribute: filter.attribute,
      value,
      href: buildHref(slug, {
        sort: activeSort,
        filters: stringifyFilters(toggleFilter(activeFilters, filter.attribute, value)),
      }),
    })),
  )

  const noResults = result.products.length === 0

  return (
    <>
      <Section className="pb-0">
        <Container>
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Categories', href: '/categories' },
              { label: result.title },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <Banner
            variant="compact"
            title={result.title}
            description={result.description || undefined}
            imageUrl={result.thumbnail?.url}
          >
            <p
              className={cn(
                'text-sm font-medium',
                result.thumbnail?.url ? 'text-ink-foreground/80' : 'text-foreground/80',
              )}
            >
              {result.lineCount} {result.lineCount === 1 ? 'line' : 'lines'} · all available to order
            </p>
          </Banner>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container className="flex flex-col gap-6">
          {noResults ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="font-semibold text-foreground">No products found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try clearing some filters, or{' '}
                <a href="/contact" className="text-primary hover:underline">
                  contact NCC
                </a>{' '}
                for help finding what you need.
              </p>
            </div>
          ) : (
            <FacetLayout
              groups={groups}
              appliedChips={appliedChips}
              clearAllHref={appliedChips.length > 0 ? buildHref(slug, { sort: activeSort }) : null}
              sortOptions={sortOptions}
              resultCount={result.lineCount}
            >
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {result.products.map((product, index) => (
                  <Reveal key={product.sku} delayMs={(index % 6) * 70}>
                    <ProductCard product={product} />
                  </Reveal>
                ))}
              </div>
              <Pagination
                previousHref={
                  search.after
                    ? buildHref(slug, { sort: activeSort, filters: search.filters })
                    : null
                }
                nextHref={
                  result.pageInfo.hasNextPage
                    ? buildHref(slug, {
                        sort: activeSort,
                        filters: search.filters,
                        after: result.pageInfo.endCursor ?? undefined,
                      })
                    : null
                }
              />
            </FacetLayout>
          )}
        </Container>
      </Section>
    </>
  )
}
