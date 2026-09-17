import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const hostedBase = {
  VERCEL: '1',
  NODE_ENV: 'production',
  SESSION_SECRET: 'a-real-production-secret-at-least-32ch',
  DATABASE_URL: 'libsql://ncc-supply-staging.turso.io',
  DATABASE_AUTH_TOKEN: 'turso-token',
  CATALOGUE_ADAPTER: 'live',
  ADMIN_COMMERCE_ADAPTER: 'live',
  SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
  SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'storefront-token',
  SHOPIFY_ADMIN_ACCESS_TOKEN: 'admin-token',
}

describe('parseEnv', () => {
  it('allows local development with the fixture catalogue and no hosted database', () => {
    const env = parseEnv({ NODE_ENV: 'development' })
    expect(env.CATALOGUE_ADAPTER).toBe('fixture')
    expect(env.ADMIN_COMMERCE_ADAPTER).toBe('fixture')
    expect(env.DATABASE_URL).toBeUndefined()
  })

  it('refuses the insecure SESSION_SECRET default when NODE_ENV=production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET/)
  })

  it('allows a local production build (no VERCEL) without Turso or Shopify secrets', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      SESSION_SECRET: 'a-real-production-secret-at-least-32ch',
    })
    expect(env.CATALOGUE_ADAPTER).toBe('fixture')
    expect(env.DATABASE_URL).toBeUndefined()
  })

  it('accepts a hosted live-catalogue production config', () => {
    const env = parseEnv(hostedBase)
    expect(env.CATALOGUE_ADAPTER).toBe('live')
    expect(env.ADMIN_COMMERCE_ADAPTER).toBe('live')
    expect(env.DATABASE_URL).toBe('libsql://ncc-supply-staging.turso.io')
  })

  it('requires DATABASE_URL on a hosted deploy', () => {
    expect(() => parseEnv({ ...hostedBase, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/)
  })

  it('rejects a local file DATABASE_URL on a hosted deploy', () => {
    expect(() => parseEnv({ ...hostedBase, DATABASE_URL: 'file:./local.db' })).toThrow(/libsql:\/\//)
  })

  it('requires DATABASE_AUTH_TOKEN on a hosted deploy', () => {
    expect(() => parseEnv({ ...hostedBase, DATABASE_AUTH_TOKEN: undefined })).toThrow(/DATABASE_AUTH_TOKEN/)
  })

  it('boots on a hosted deploy with Turso even if Shopify adapters are still fixture', () => {
    const env = parseEnv({
      VERCEL: '1',
      NODE_ENV: 'production',
      SESSION_SECRET: 'a-real-production-secret-at-least-32ch',
      DATABASE_URL: 'libsql://ncc-supply-staging.turso.io',
      DATABASE_AUTH_TOKEN: 'turso-token',
    })
    expect(env.CATALOGUE_ADAPTER).toBe('fixture')
    expect(env.ADMIN_COMMERCE_ADAPTER).toBe('fixture')
  })

  it('promotes the catalogue to live on a hosted deploy when Storefront credentials are present', () => {
    const env = parseEnv({
      VERCEL: '1',
      NODE_ENV: 'production',
      SESSION_SECRET: 'a-real-production-secret-at-least-32ch',
      DATABASE_URL: 'libsql://ncc-supply-staging.turso.io',
      DATABASE_AUTH_TOKEN: 'turso-token',
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: 'storefront-token',
    })
    expect(env.CATALOGUE_ADAPTER).toBe('live')
    expect(env.ADMIN_COMMERCE_ADAPTER).toBe('fixture')
  })

  it('still requires Storefront credentials when CATALOGUE_ADAPTER=live', () => {
    expect(() =>
      parseEnv({ ...hostedBase, SHOPIFY_STOREFRONT_ACCESS_TOKEN: undefined }),
    ).toThrow(/SHOPIFY_STOREFRONT_ACCESS_TOKEN/)
  })

  it('honours NCC_HOSTED=1 the same way as VERCEL=1', () => {
    expect(() =>
      parseEnv({
        VERCEL: undefined,
        NCC_HOSTED: '1',
        NODE_ENV: 'production',
        SESSION_SECRET: 'a-real-production-secret-at-least-32ch',
      }),
    ).toThrow(/DATABASE_URL/)
  })
})
