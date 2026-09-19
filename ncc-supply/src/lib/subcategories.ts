/**
 * Divisions shown as tabs inside a category page (PRD §6.20).
 *
 * Driven by product tags, not by Shopify collections. Three matching
 * collections do exist in Shopify but are unpublished, and publishing them
 * would add three more *top-level* categories to the homepage, the header
 * rail and /categories — the app has no notion of nesting, so every
 * published collection is a top-level category. Tags avoid that entirely
 * and need no change to the live store.
 *
 * Verified against the live catalogue on 19 September 2026: the three tags
 * below cover all 68 storefront-visible Screens products (23 + 27 + 18)
 * with none untagged, so no product becomes unreachable through the tabs.
 */
export interface Subcategory {
  /** URL value for the `sub` search param. */
  slug: string
  label: string
  /** The Shopify product tag, which must match exactly. */
  tag: string
}

export const SUBCATEGORIES: Record<string, readonly Subcategory[]> = {
  screens: [
    { slug: 'colorx-lcd', label: 'Colorx LCD', tag: 'Colorx LCD' },
    { slug: 'prime', label: 'Prime', tag: 'NCC prime' },
    { slug: 'soft-oled', label: 'Soft OLED', tag: 'NCC SOFT OLED' },
  ],
}

export function subcategoriesFor(categorySlug: string): readonly Subcategory[] {
  return SUBCATEGORIES[categorySlug] ?? []
}

/** The tag for a `sub` value, or null when it isn't one this category has. */
export function subcategoryTag(categorySlug: string, sub: string | undefined): string | null {
  if (!sub) return null
  const match = subcategoriesFor(categorySlug).find((entry) => entry.slug === sub)
  return match?.tag ?? null
}
