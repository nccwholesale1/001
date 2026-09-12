export type ShopifyApiErrorKind = 'network' | 'throttled' | 'graphql' | 'http'

/**
 * Typed error mapping so callers can distinguish "safe to retry" from "give
 * up" without inspecting raw fetch/GraphQL shapes themselves.
 */
export class ShopifyApiError extends Error {
  readonly kind: ShopifyApiErrorKind
  readonly retryable: boolean
  readonly status?: number

  constructor(message: string, kind: ShopifyApiErrorKind, retryable: boolean, status?: number) {
    super(message)
    this.name = 'ShopifyApiError'
    this.kind = kind
    this.retryable = retryable
    this.status = status
  }
}
