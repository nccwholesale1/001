/**
 * Storefront/Admin GraphQL only accept the shop's `*.myshopify.com` host.
 * Pasting the admin URL, a custom domain, or a protocol-prefixed value
 * makes every catalogue request fail.
 */
export function normalizeShopifyStoreDomain(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  const adminMatch = trimmed.match(/admin\.shopify\.com\/store\/([^/?#]+)/i)
  if (adminMatch?.[1]) {
    return `${adminMatch[1].toLowerCase()}.myshopify.com`
  }

  const host = trimmed
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    ?.split(':')[0]
    ?.trim()
    .replace(/\.$/, '')
    .toLowerCase()

  if (!host) return undefined
  if (host.endsWith('.myshopify.com')) return host
  return undefined
}
