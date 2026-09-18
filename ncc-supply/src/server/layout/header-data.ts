import { eq } from 'drizzle-orm'
import { getBasketItemCount } from '../basket/basket'
import { getOrCreateBasketId } from '../basket/session'
import { getCurrentActor } from '../buyers/buyer-session'
import { db } from '../db/client'
import { buyerUsers, companies, type BuyerRole } from '../db/schema'
import { getCatalogueAdapter } from '../integrations/shopify'

export interface HeaderData {
  categories: Array<{ slug: string; title: string }>
  buyer: { companyName: string; role: BuyerRole } | null
  basketCount: number
}

export const EMPTY_HEADER_DATA: HeaderData = {
  categories: [],
  buyer: null,
  basketCount: 0,
}

/**
 * Plain server function — not a createServerFn — so the root loader can
 * call it without nesting RPC (nested createServerFn on Vercel 500s the
 * whole HTML response as HTTPError).
 */
export async function loadHeaderData(): Promise<HeaderData> {
  const [categories, buyer, basketCount] = await Promise.all([
    loadCategories(),
    loadBuyer(),
    loadBasketCount(),
  ])
  return { categories, buyer, basketCount }
}

async function loadCategories(): Promise<HeaderData['categories']> {
  try {
    const collections = await getCatalogueAdapter().listCollections()
    return collections.map((collection) => ({ slug: collection.slug, title: collection.title }))
  } catch (error) {
    console.error('[root] failed to load header categories', error)
    return []
  }
}

async function loadBuyer(): Promise<HeaderData['buyer']> {
  try {
    const actor = await getCurrentActor(db)
    if (!actor) return null
    const [row] = await db
      .select({ companyName: companies.name })
      .from(buyerUsers)
      .innerJoin(companies, eq(companies.id, buyerUsers.companyId))
      .where(eq(buyerUsers.id, actor.buyerUserId))
      .limit(1)
    if (!row) return null
    return { companyName: row.companyName, role: actor.role }
  } catch (error) {
    console.error('[root] failed to load header buyer', error)
    return null
  }
}

async function loadBasketCount(): Promise<number> {
  try {
    const basketId = await getOrCreateBasketId(db)
    return getBasketItemCount(db, basketId)
  } catch (error) {
    console.error('[root] failed to load basket count', error)
    return 0
  }
}
