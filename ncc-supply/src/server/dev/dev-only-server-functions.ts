import { createServerFn } from '@tanstack/react-start'
import { env } from '../env'

/**
 * Server-only. Used from route `beforeLoad` via this function rather than
 * reading `env` in the isomorphic loader — that would bundle env defaults
 * into client JS (see routes/dev/fixture-shopify-login.tsx).
 */
export const isDevOnlySurfaceEnabled = createServerFn({ method: 'GET' }).handler(
  async (): Promise<boolean> => env.NODE_ENV !== 'production',
)
