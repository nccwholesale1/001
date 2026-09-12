import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomerAccountAdapter } from './types'

async function loadAdapterWithEnv(
  envOverrides: Record<string, string | undefined>,
): Promise<CustomerAccountAdapter> {
  vi.resetModules()
  vi.doMock('../../env', () => ({
    env: {
      DATABASE_FILE: './local.db',
      SESSION_SECRET: 'x'.repeat(32),
      NODE_ENV: 'test',
      CATALOGUE_ADAPTER: 'fixture',
      SHOPIFY_API_VERSION: '2026-07',
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: 'test-client-id',
      ...envOverrides,
    },
  }))
  const { createCustomerAccountAdapter } = await import('./customer-account-adapter')
  return createCustomerAccountAdapter()
}

const DISCOVERY_DOCUMENT = {
  authorization_endpoint: 'https://shopify.com/authentication/123/oauth/authorize',
  token_endpoint: 'https://shopify.com/authentication/123/oauth/token',
}

describe('customer account adapter (contract only, mocked fetch)', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.doUnmock('../../env')
  })

  it('login() discovers endpoints and builds a PKCE authorization URL with state/nonce/challenge', async () => {
    const adapter = await loadAdapterWithEnv({})
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(DISCOVERY_DOCUMENT), { status: 200 }))

    const result = await adapter.login('https://app.example.com/auth/callback')

    const url = new URL(result.url)
    expect(url.origin + url.pathname).toBe(DISCOVERY_DOCUMENT.authorization_endpoint)
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/auth/callback')
    expect(url.searchParams.get('state')).toBe(result.state)
    expect(url.searchParams.get('nonce')).toBe(result.nonce)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('code_challenge')).not.toBe(result.codeVerifier)
  })

  it('generates a different state/nonce/verifier on every call (no replay)', async () => {
    const adapter = await loadAdapterWithEnv({})
    global.fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify(DISCOVERY_DOCUMENT), { status: 200 }),
      )

    const first = await adapter.login('https://app.example.com/auth/callback')
    const second = await adapter.login('https://app.example.com/auth/callback')

    expect(first.state).not.toBe(second.state)
    expect(first.nonce).not.toBe(second.nonce)
    expect(first.codeVerifier).not.toBe(second.codeVerifier)
  })

  it('authorize() exchanges a code for a session via the discovered token endpoint', async () => {
    const adapter = await loadAdapterWithEnv({})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(DISCOVERY_DOCUMENT), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'at', id_token: 'it', expires_in: 3600 }), {
          status: 200,
        }),
      )
    global.fetch = fetchMock

    const session = await adapter.authorize(
      'auth-code',
      'verifier',
      'https://app.example.com/auth/callback',
    )

    expect(session.accessToken).toBe('at')
    expect(session.idToken).toBe('it')
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(tokenUrl).toBe(DISCOVERY_DOCUMENT.token_endpoint)
    expect(String(tokenInit.body)).toContain('code_verifier=verifier')
  })

  it('refuses to build a login URL without a configured client id', async () => {
    const adapter = await loadAdapterWithEnv({ SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: undefined })

    await expect(adapter.login('https://app.example.com/auth/callback')).rejects.toThrow(
      /configured/,
    )
  })
})
