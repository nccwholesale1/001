import { env } from '../../env'
import { withCache } from './cache'
import { createFixtureCatalogueAdapter } from './fixture-adapter'
import { createStorefrontCatalogueAdapter } from './storefront-adapter'
import type {
  CatalogueAdapter,
  CollectionResult,
  FacetOpts,
  PaginationOpts,
  ProductDetail,
  SearchResult,
  TypeaheadResult,
} from './types'

const COLLECTION_CACHE_TTL_MS = 60_000
const PRODUCT_CACHE_TTL_MS = 60_000

function withCatalogueCache(adapter: CatalogueAdapter): CatalogueAdapter {
  return {
    getCollection: (slug: string, opts: PaginationOpts & FacetOpts): Promise<CollectionResult> =>
      withCache(`collection:${slug}:${JSON.stringify(opts)}`, COLLECTION_CACHE_TTL_MS, () =>
        adapter.getCollection(slug, opts),
      ),
    getProduct: (sku: string): Promise<ProductDetail | null> =>
      withCache(`product:${sku}`, PRODUCT_CACHE_TTL_MS, () => adapter.getProduct(sku)),
    search: (query: string, opts: PaginationOpts & FacetOpts): Promise<SearchResult> =>
      adapter.search(query, opts),
    suggest: (query: string): Promise<TypeaheadResult> => adapter.suggest(query),
  }
}

/**
 * The one import point every later phase uses — nothing else should reach
 * into storefront-adapter.ts/fixture-adapter.ts directly (CLAUDE.md rule
 * 20: fixture and live adapters are never mixed in the same running
 * process). Search and suggest are left uncached since their results are
 * query-keyed and much less repeated than a fixed collection/product page.
 */
export function getCatalogueAdapter(): CatalogueAdapter {
  if (env.CATALOGUE_ADAPTER === 'live') {
    return withCatalogueCache(createStorefrontCatalogueAdapter())
  }
  return createFixtureCatalogueAdapter()
}
