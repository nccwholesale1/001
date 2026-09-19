import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AdminCommerceAdapter } from './types'

/**
 * `env.ts` evaluates `process.env` once at import time (env is a frozen
 * singleton, by design — see env.ts), so tests that need different env
 * configurations per case mock the module directly and re-import fresh via
 * vi.resetModules() rather than mutating process.env after the fact.
 */
async function loadAdapterWithEnv(
  envOverrides: Record<string, string | undefined>,
): Promise<AdminCommerceAdapter> {
  vi.resetModules()
  vi.doMock('../../env', () => ({
    env: {
      DATABASE_FILE: './local.db',
      SESSION_SECRET: 'x'.repeat(32),
      NODE_ENV: 'test',
      CATALOGUE_ADAPTER: 'fixture',
      SHOPIFY_API_VERSION: '2026-07',
      SHOPIFY_STORE_DOMAIN: undefined,
      SHOPIFY_STOREFRONT_ACCESS_TOKEN: undefined,
      SHOPIFY_ADMIN_ACCESS_TOKEN: undefined,
      ...envOverrides,
    },
  }))
  const { createAdminCommerceAdapter } = await import('./admin-adapter')
  return createAdminCommerceAdapter()
}

function mockFetchOnce(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
  global.fetch = fetchMock
  return fetchMock
}

describe('admin commerce adapter (contract only — no live mutation is ever fired)', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.doUnmock('../../env')
  })

  it('createDraftOrder maps a successful response to the DraftOrder shape', async () => {
    const adapter = await loadAdapterWithEnv({
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-admin-token',
    })
    mockFetchOnce({
      data: {
        draftOrderCreate: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/1',
            name: '#D1',
            status: 'OPEN',
            invoiceUrl: null,
            totalPriceSet: { shopMoney: { amount: '19.99', currencyCode: 'GBP' } },
          },
          userErrors: [],
        },
      },
    })

    const result = await adapter.createDraftOrder({
      email: 'buyer@example.com',
      lines: [{ variantId: 'gid://shopify/ProductVariant/1', quantity: 2, unitPricePence: 999 }],
    })

    expect(result).toEqual({
      id: 'gid://shopify/DraftOrder/1',
      name: '#D1',
      status: 'OPEN',
      invoiceUrl: null,
      totalPrice: { amountPence: 1999, currencyCode: 'GBP' },
    })
  })

  /**
   * The whole point of the confirmed-pricing work: without `priceOverride`
   * Shopify re-prices every line from the live catalogue, so a catalogue
   * change between NCC approval and payment would charge the customer a
   * different total than the one they agreed to. Delivery has no Shopify
   * representation at all unless it is sent as an explicit shipping line.
   */
  it('sends NCC-confirmed unit prices and the delivery charge to Shopify', async () => {
    const adapter = await loadAdapterWithEnv({
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-admin-token',
    })
    const fetchMock = mockFetchOnce({
      data: {
        draftOrderCreate: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/2',
            name: '#D2',
            status: 'OPEN',
            invoiceUrl: 'https://example.myshopify.com/invoices/abc',
            totalPriceSet: { shopMoney: { amount: '25.50', currencyCode: 'GBP' } },
          },
          userErrors: [],
        },
      },
    })

    const result = await adapter.createDraftOrder({
      email: 'buyer@example.com',
      reference: 'order-abc',
      lines: [
        { variantId: 'gid://shopify/ProductVariant/1', quantity: 2, unitPricePence: 900 },
        { variantId: 'gid://shopify/ProductVariant/2', quantity: 1, unitPricePence: 2550 },
      ],
      shippingLine: { title: 'Delivery', pricePence: 495 },
    })

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(sent.variables.input.lineItems).toEqual([
      {
        variantId: 'gid://shopify/ProductVariant/1',
        quantity: 2,
        priceOverride: { amount: '9.00', currencyCode: 'GBP' },
      },
      {
        variantId: 'gid://shopify/ProductVariant/2',
        quantity: 1,
        priceOverride: { amount: '25.50', currencyCode: 'GBP' },
      },
    ])
    expect(sent.variables.input.shippingLine).toEqual({ title: 'Delivery', price: '4.95' })
    expect(sent.variables.input.tags).toEqual(['ncc-order-order-abc'])

    // The pay link comes back from create itself — no invoice email needed.
    expect(result.invoiceUrl).toBe('https://example.myshopify.com/invoices/abc')
  })

  it('omits the shipping line entirely when no delivery charge was set', async () => {
    const adapter = await loadAdapterWithEnv({
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-admin-token',
    })
    const fetchMock = mockFetchOnce({
      data: {
        draftOrderCreate: {
          draftOrder: {
            id: 'gid://shopify/DraftOrder/3',
            name: '#D3',
            status: 'OPEN',
            invoiceUrl: null,
            totalPriceSet: { shopMoney: { amount: '9.00', currencyCode: 'GBP' } },
          },
          userErrors: [],
        },
      },
    })

    await adapter.createDraftOrder({
      email: 'buyer@example.com',
      lines: [{ variantId: 'gid://shopify/ProductVariant/1', quantity: 1, unitPricePence: 900 }],
    })

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect('shippingLine' in sent.variables.input).toBe(false)
    expect('tags' in sent.variables.input).toBe(false)
  })

  it('throws when Shopify returns userErrors, instead of returning a partial result', async () => {
    const adapter = await loadAdapterWithEnv({
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-admin-token',
    })
    mockFetchOnce({
      data: {
        draftOrderCreate: {
          draftOrder: null,
          userErrors: [{ field: ['lineItems'], message: 'Variant not found' }],
        },
      },
    })

    await expect(
      adapter.createDraftOrder({
        email: 'buyer@example.com',
        lines: [{ variantId: 'bad', quantity: 1, unitPricePence: 100 }],
      }),
    ).rejects.toThrow('Variant not found')
  })

  it('approveReturn calls returnApproveRequest and maps the return status', async () => {
    const adapter = await loadAdapterWithEnv({
      SHOPIFY_STORE_DOMAIN: 'example.myshopify.com',
      SHOPIFY_ADMIN_ACCESS_TOKEN: 'test-admin-token',
    })
    const fetchMock = mockFetchOnce({
      data: {
        returnApproveRequest: {
          return: { id: 'gid://shopify/Return/1', status: 'OPEN' },
          userErrors: [],
        },
      },
    })

    const result = await adapter.approveReturn('gid://shopify/Return/1')

    expect(result).toEqual({ id: 'gid://shopify/Return/1', status: 'OPEN' })
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(requestInit.body)).toContain('returnApproveRequest')
  })

  it('refuses to call the Admin API at all without credentials configured', async () => {
    const adapter = await loadAdapterWithEnv({})
    const fetchMock = vi.fn()
    global.fetch = fetchMock

    await expect(adapter.approveReturn('gid://shopify/Return/1')).rejects.toThrow(/configured/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
