import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { useCallback } from 'react'
import { z } from 'zod'
import { getCatalogueAdapter } from '../server/integrations/shopify'
import type {
  FacetFilter,
  SearchResult,
  TypeaheadResult,
} from '../server/integrations/shopify/types'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Container, Section } from '../components/ui/Layout'
import { FacetLayout } from '../components/ui/FacetLayout'
import type { AppliedChipView, FacetGroupView, SortOptionView } from '../components/ui/FacetSidebar'
import { Pagination } from '../components/ui/Pagination'
import { ProductCard } from '../components/ui/ProductCard'
import { Reveal } from '../components/ui/Reveal'
import { SearchBar } from '../components/ui/SearchBar'

const PAGE_SIZE = 12
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'title_asc', label: 'A–Z' },
] as const
type SortValue = (typeof SORT_OPTIONS)[number]['value']

const searchSearchSchema = z.object({
  q: z.string().optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'title_asc']).optional(),
  after: z.string().optional(),
  filters: z.string().optional(),
})
type SearchSearch = z.infer<typeof searchSearchSchema>

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

function buildHref(overrides: SearchSearch): string {
  const params = new URLSearchParams()
  if (overrides.q) params.set('q', overrides.q)
  if (overrides.sort && overrides.sort !== 'relevance') params.set('sort', overrides.sort)
  if (overrides.after) params.set('after', overrides.after)
  if (overrides.filters) params.set('filters', overrides.filters)
  const query = params.toString()
  return `/search${query ? `?${query}` : ''}`
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

interface SearchData {
  q: string
  result: SearchResult | null
  error: string | null
}

const searchDataQuerySchema = searchSearchSchema
  .extend({ q: z.string().max(200) })
  .strict()

const getSearchData = createServerFn({ method: 'GET' })
  .validator(searchDataQuerySchema.parse)
  .handler(async ({ data }): Promise<SearchData> => {
    if (!data.q.trim()) return { q: data.q, result: null, error: null }
    try {
      const result = await getCatalogueAdapter().search(data.q, {
        first: PAGE_SIZE,
        after: data.after,
        sort: data.sort,
        filters: parseFiltersParam(data.filters),
      })
      return { q: data.q, result, error: null }
    } catch (error) {
      console.error('[search] failed to search catalogue', error)
      return { q: data.q, result: null, error: 'Could not search the catalogue right now.' }
    }
  })

const searchSuggestionsQuerySchema = z.object({ q: z.string().max(200) }).strict()

const getSearchSuggestions = createServerFn({ method: 'GET' })
  .validator(searchSuggestionsQuerySchema.parse)
  .handler(async ({ data }): Promise<TypeaheadResult> => {
    try {
      return await getCatalogueAdapter().suggest(data.q)
    } catch (error) {
      console.error('[search] failed to fetch suggestions', error)
      return { products: [], collections: [] }
    }
  })

export const Route = createFileRoute('/search')({
  validateSearch: searchSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getSearchData({ data: { q: deps.q ?? '', ...deps } }),
  head: ({ loaderData }) => {
    const result = loaderData?.result
    const hasNoResults = !result || result.products.length === 0
    return {
      meta: [
        {
          title: loaderData?.q ? `"${loaderData.q}" · Search · NCC Supply` : 'Search · NCC Supply',
        },
        ...(hasNoResults ? [{ name: 'robots', content: 'noindex' }] : []),
      ],
      links: loaderData?.q
        ? [{ rel: 'canonical', href: `/search?q=${encodeURIComponent(loaderData.q)}` }]
        : [],
      scripts:
        result && result.products.length > 0
          ? [
              {
                type: 'application/ld+json',
                children: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  itemListElement: result.products.map((product, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    name: product.title,
                    url: `/product/${product.sku}`,
                  })),
                }),
              },
            ]
          : [],
    }
  },
  component: SearchRoute,
})

function SearchRoute() {
  const { q, result, error } = Route.useLoaderData()
  const search = Route.useSearch()
  const activeFilters = parseFiltersParam(search.filters)
  const activeSort: SortValue = search.sort ?? 'relevance'
  const suggestFn = useServerFn(getSearchSuggestions)
  const suggest = useCallback((query: string) => suggestFn({ data: { q: query } }), [suggestFn])

  const sortOptions: SortOptionView[] = SORT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    active: option.value === activeSort,
    href: buildHref({ q, sort: option.value, filters: search.filters }),
  }))

  const facetsByAttribute = new Map<string, NonNullable<typeof result>['availableFacets']>()
  for (const facet of result?.availableFacets ?? []) {
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
          href: buildHref({
            q,
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
      href: buildHref({
        q,
        sort: activeSort,
        filters: stringifyFilters(toggleFilter(activeFilters, filter.attribute, value)),
      }),
    })),
  )

  return (
    <Section>
      <Container className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Search' }]} />
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold text-foreground">Search</h1>
          <SearchBar initialQuery={q} onSuggest={suggest} />
        </div>

        {!q.trim() ? (
          <p className="text-sm text-muted-foreground">
            Enter a search term to find products across the catalogue.
          </p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !result || result.products.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-semibold text-foreground">No results for "{q}"</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different term, clear any filters, or{' '}
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
            clearAllHref={appliedChips.length > 0 ? buildHref({ q, sort: activeSort }) : null}
            sortOptions={sortOptions}
            resultCount={result.totalCount}
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
                search.after ? buildHref({ q, sort: activeSort, filters: search.filters }) : null
              }
              nextHref={
                result.pageInfo.hasNextPage
                  ? buildHref({
                      q,
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
  )
}
