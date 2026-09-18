import { getCatalogueAdapter } from '../integrations/shopify'
import type { CollectionSummary, ProductSummary } from '../integrations/shopify/types'
import { env } from '../env'

export interface HomeCatalogueData {
  collections: CollectionSummary[]
  /** A sample of real catalogue data from the first collection — not a true popularity ranking (no analytics source exists yet). */
  popularProducts: ProductSummary[]
  error: string | null
  /** Non-secret diagnostics for hosted failures. Never includes tokens. */
  detail?: string | null
  adapter?: 'fixture' | 'live'
  storeHost?: string | null
}

const LOAD_ERROR = 'Could not load catalogue data right now.'

export const EMPTY_HOME_CATALOGUE: HomeCatalogueData = {
  collections: [],
  popularProducts: [],
  error: null,
}

export async function loadHomeCatalogue(): Promise<HomeCatalogueData> {
  const adapter = getCatalogueAdapter()
  try {
    const collections = await adapter.listCollections()
    const firstStockedCollection = collections.find((collection) => collection.lineCount > 0)
    const popularProducts = firstStockedCollection
      ? (await adapter.getCollection(firstStockedCollection.slug, { first: 8 })).products
      : []
    return { collections, popularProducts, error: null, adapter: env.CATALOGUE_ADAPTER, storeHost: env.SHOPIFY_STORE_DOMAIN ?? null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[catalogue] failed to load catalogue data', {
      adapter: env.CATALOGUE_ADAPTER,
      storeHost: env.SHOPIFY_STORE_DOMAIN ?? null,
      name: error instanceof Error ? error.name : typeof error,
      message,
    })
    return {
      collections: [],
      popularProducts: [],
      error: LOAD_ERROR,
      detail: message,
      adapter: env.CATALOGUE_ADAPTER,
      storeHost: env.SHOPIFY_STORE_DOMAIN ?? null,
    }
  }
}
