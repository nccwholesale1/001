import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `env.ts` reads `process.env` once at import time (a frozen singleton, by
 * design), so each case mocks the module and re-imports rather than mutating
 * process.env after the fact — same approach as admin-adapter.test.ts.
 */
async function loadTokenModuleWithEnv(envOverrides: Record<string, string | undefined>) {
  vi.resetModules()
  vi.doMock('../../env', () => ({
    env: {
      DATABASE_FILE: './local.db',
      SESSION_SECRET: 'x'.repeat(32),
      NODE_ENV: 'test',
      CATALOGUE_ADAPTER: 'fixture',
      SHOPIFY_API_VERSION: '2026-07',
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: undefined,
      SHOPIFY_CLIENT_ID: undefined,
      SHOPIFY_CLIENT_SECRET: undefined,
      ...envOverrides,
    },
  }))
  return import('./admin-token')
}

function tokenResponse(token: string, expiresIn = 86399) {
  return new Response(
    JSON.stringify({ access_token: token, scope: 'write_draft_orders', expires_in: expiresIn }),
    { status: 200 },
  )
}

const CREDENTIALS = { SHOPIFY_CLIENT_ID: 'client-id', SHOPIFY_CLIENT_SECRET: 'client-secret' }

describe('admin token (client credentials grant)', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.doUnmock('../../env')
    vi.useRealTimers()
  })

  it('sends the grant exactly as Shopify specifies, and never puts the secret in the URL', async () => {
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('shpat_minted'))
    global.fetch = fetchMock

    expect(await mod.getAdminAccessToken()).toBe('shpat_minted')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.myshopify.com/admin/oauth/access_token')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    const body = new URLSearchParams(init.body as URLSearchParams)
    expect(body.get('grant_type')).toBe('client_credentials')
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('client_secret')).toBe('client-secret')
    // A secret in a query string leaks into logs and proxies.
    expect(String(url)).not.toContain('client-secret')
  })

  it('caches the token instead of minting one per request', async () => {
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('shpat_cached'))
    global.fetch = fetchMock

    await mod.getAdminAccessToken()
    await mod.getAdminAccessToken()
    await mod.getAdminAccessToken()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shares one request between concurrent callers rather than minting several', async () => {
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('shpat_shared'))
    global.fetch = fetchMock

    const results = await Promise.all([
      mod.getAdminAccessToken(),
      mod.getAdminAccessToken(),
      mod.getAdminAccessToken(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results).toEqual(['shpat_shared', 'shpat_shared', 'shpat_shared'])
  })

  it('re-mints once the token is close enough to expiry to be unsafe', async () => {
    vi.useFakeTimers()
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('shpat_first'))
      .mockResolvedValueOnce(tokenResponse('shpat_second'))
    global.fetch = fetchMock

    expect(await mod.getAdminAccessToken()).toBe('shpat_first')

    // Still well inside the 24h lifetime.
    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(await mod.getAdminAccessToken()).toBe('shpat_first')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Past the refresh margin — a token this close to expiry must not be used.
    vi.advanceTimersByTime(23 * 60 * 60 * 1000)
    expect(await mod.getAdminAccessToken()).toBe('shpat_second')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refuses to cache a token whose lifetime Shopify did not state', async () => {
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    // Built inline rather than via the helper: passing `undefined` there
    // would trigger its default parameter and send a lifetime after all.
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: 'shpat_unknown_lifetime', scope: 'x' }), {
          status: 200,
        }),
    )
    global.fetch = fetchMock

    await mod.getAdminAccessToken()
    await mod.getAdminAccessToken()

    // Minting twice is the safe failure; trusting an unstated lifetime is not.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces Shopify’s own error reason, which names the actual misconfiguration', async () => {
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    global.fetch = vi.fn().mockResolvedValue(
      new Response('{"error":"shop_not_permitted"}', { status: 401 }),
    )

    await expect(mod.getAdminAccessToken()).rejects.toThrow('shop_not_permitted')
  })

  it('prefers a legacy static token when one is configured, and never calls the grant', async () => {
    const mod = await loadTokenModuleWithEnv({
      ...CREDENTIALS,
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'shpat_legacy_static',
    })
    const fetchMock = vi.fn()
    global.fetch = fetchMock

    expect(await mod.getAdminAccessToken()).toBe('shpat_legacy_static')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails with an actionable message when nothing is configured', async () => {
    const mod = await loadTokenModuleWithEnv({})
    expect(mod.hasClientCredentials()).toBe(false)
    await expect(mod.getAdminAccessToken()).rejects.toThrow('SHOPIFY_CLIENT_ID')
  })

  it('mints a fresh token after invalidation, so a revoked token cannot stick', async () => {
    const mod = await loadTokenModuleWithEnv(CREDENTIALS)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('shpat_stale'))
      .mockResolvedValueOnce(tokenResponse('shpat_replacement'))
    global.fetch = fetchMock

    expect(await mod.getAdminAccessToken()).toBe('shpat_stale')
    mod.invalidateAdminToken()
    expect(await mod.getAdminAccessToken()).toBe('shpat_replacement')
  })
})
