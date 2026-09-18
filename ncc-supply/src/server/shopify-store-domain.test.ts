import { describe, expect, it } from 'vitest'
import { normalizeShopifyStoreDomain } from './shopify-store-domain'

describe('normalizeShopifyStoreDomain', () => {
  it('keeps a bare myshopify host', () => {
    expect(normalizeShopifyStoreDomain('example.myshopify.com')).toBe('example.myshopify.com')
  })

  it('strips protocol, path, and port from a myshopify URL', () => {
    expect(normalizeShopifyStoreDomain('https://Example.myshopify.com/admin')).toBe(
      'example.myshopify.com',
    )
  })

  it('extracts the shop handle from an admin.shopify.com URL', () => {
    expect(
      normalizeShopifyStoreDomain('https://admin.shopify.com/store/9nd0we-wt/settings/domains'),
    ).toBe('9nd0we-wt.myshopify.com')
  })

  it('rejects a custom storefront domain', () => {
    expect(normalizeShopifyStoreDomain('nccwholesale.org')).toBeUndefined()
    expect(normalizeShopifyStoreDomain('https://nccwholesale.org')).toBeUndefined()
  })

  it('treats empty values as absent', () => {
    expect(normalizeShopifyStoreDomain(undefined)).toBeUndefined()
    expect(normalizeShopifyStoreDomain('')).toBeUndefined()
    expect(normalizeShopifyStoreDomain('   ')).toBeUndefined()
  })
})
