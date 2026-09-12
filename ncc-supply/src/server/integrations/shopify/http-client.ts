import { ShopifyApiError } from './errors'

export interface ShopifyGraphqlRequestOptions {
  endpoint: string
  headers: Record<string, string>
  query: string
  variables?: Record<string, unknown>
  /** Short label used only in logs — never the raw query/variables (may carry PII). */
  operationName: string
  timeoutMs?: number
  maxAttempts?: number
}

interface GraphqlEnvelope<T> {
  data?: T
  errors?: Array<{ message: string; extensions?: { code?: string } }>
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 250

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * One shared low-level requester for both the Storefront and Admin GraphQL
 * clients: bounded timeout, retry-with-backoff on network failure/429/
 * THROTTLED, and structured logging that never includes headers, tokens, or
 * full variables (CLAUDE.md rule 22) — only the operation name, endpoint
 * host, duration, and outcome.
 */
export async function shopifyGraphqlRequest<T>(opts: ShopifyGraphqlRequestOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const host = safeHost(opts.endpoint)

  let lastError: ShopifyApiError = new ShopifyApiError('Request never attempted', 'network', true)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now()
    try {
      const result = await attemptOnce<T>(opts, timeoutMs)
      logCall(opts.operationName, host, Date.now() - startedAt, 'ok')
      return result
    } catch (error) {
      lastError = error instanceof ShopifyApiError ? error : toNetworkError(error)
      logCall(opts.operationName, host, Date.now() - startedAt, `error:${lastError.kind}`)
      const isLastAttempt = attempt === maxAttempts
      if (!lastError.retryable || isLastAttempt) throw lastError
      await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
    }
  }

  throw lastError
}

async function attemptOnce<T>(opts: ShopifyGraphqlRequestOptions, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(opts.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      body: JSON.stringify({ query: opts.query, variables: opts.variables }),
      signal: controller.signal,
    })
  } catch (error) {
    throw toNetworkError(error)
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 429) {
    throw new ShopifyApiError('Rate limited by Shopify', 'throttled', true, 429)
  }
  if (!response.ok) {
    throw new ShopifyApiError(
      `Shopify API returned HTTP ${response.status}`,
      'http',
      false,
      response.status,
    )
  }

  const body = (await response.json()) as GraphqlEnvelope<T>

  if (body.errors && body.errors.length > 0) {
    const throttled = body.errors.some((e) => e.extensions?.code === 'THROTTLED')
    if (throttled)
      throw new ShopifyApiError('Rate limited by Shopify (GraphQL THROTTLED)', 'throttled', true)
    throw new ShopifyApiError(
      `Shopify GraphQL error: ${body.errors.map((e) => e.message).join('; ')}`,
      'graphql',
      false,
    )
  }

  if (body.data === undefined) {
    throw new ShopifyApiError('Shopify GraphQL response had no data', 'graphql', false)
  }

  return body.data
}

function toNetworkError(error: unknown): ShopifyApiError {
  const message = error instanceof Error ? error.message : 'Unknown network error'
  return new ShopifyApiError(`Shopify request failed: ${message}`, 'network', true)
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'unknown-host'
  }
}

function logCall(operationName: string, host: string, durationMs: number, outcome: string) {
  console.log(
    `[shopify] ${operationName} host=${host} duration_ms=${durationMs} outcome=${outcome}`,
  )
}
