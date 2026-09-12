import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShopifyApiError } from './errors'
import { shopifyGraphqlRequest } from './http-client'

describe('shopifyGraphqlRequest', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.stubGlobal('console', { ...console, log: vi.fn() })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.unstubAllGlobals()
  })

  it('returns data on a successful call', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { shop: { name: 'Test' } } }), { status: 200 }),
      )

    const result = await shopifyGraphqlRequest<{ shop: { name: string } }>({
      endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
      headers: {},
      query: '{ shop { name } }',
      operationName: 'test',
    })

    expect(result.shop.name).toBe('Test')
    expect(global.fetch).toHaveBeenCalledOnce()
  })

  it('retries a throttled response and succeeds on a later attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))
    global.fetch = fetchMock

    const result = await shopifyGraphqlRequest<{ ok: boolean }>({
      endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
      headers: {},
      query: '{ ok }',
      operationName: 'test',
      maxAttempts: 3,
    })

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after exhausting retries and throws a retryable ShopifyApiError', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('', { status: 429 }))

    await expect(
      shopifyGraphqlRequest({
        endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
        headers: {},
        query: '{ ok }',
        operationName: 'test',
        maxAttempts: 2,
      }),
    ).rejects.toMatchObject({
      kind: 'throttled',
      retryable: true,
    } satisfies Partial<ShopifyApiError>)

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-retryable GraphQL error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: 'Field not found' }] }), { status: 200 }),
      )
    global.fetch = fetchMock

    await expect(
      shopifyGraphqlRequest({
        endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
        headers: {},
        query: '{ ok }',
        operationName: 'test',
      }),
    ).rejects.toMatchObject({ kind: 'graphql', retryable: false })

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('never logs headers, tokens, or variables', async () => {
    const logSpy = vi.fn()
    vi.stubGlobal('console', { ...console, log: logSpy })
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))

    await shopifyGraphqlRequest({
      endpoint: 'https://example.myshopify.com/api/2026-07/graphql.json',
      headers: { 'X-Shopify-Storefront-Access-Token': 'super-secret-token' },
      query: '{ ok }',
      variables: { customerEmail: 'someone@example.com' },
      operationName: 'test',
    })

    const loggedText = logSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(loggedText).not.toContain('super-secret-token')
    expect(loggedText).not.toContain('someone@example.com')
  })
})
