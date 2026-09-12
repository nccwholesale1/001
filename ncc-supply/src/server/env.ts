import { z } from 'zod'

/**
 * Server-only. Validated once at import time so a missing/invalid variable
 * fails loudly at startup rather than surfacing as a confusing runtime error
 * deep in a request handler. Never import this from client code.
 */
const envSchema = z.object({
  DATABASE_FILE: z.string().min(1).default('./local.db'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters')
    .default('dev-only-insecure-secret-do-not-use-in-production-xxxxx'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

const INSECURE_DEV_SECRET = 'dev-only-insecure-secret-do-not-use-in-production-xxxxx'

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`)
  }
  if (result.data.NODE_ENV === 'production' && result.data.SESSION_SECRET === INSECURE_DEV_SECRET) {
    throw new Error(
      'SESSION_SECRET must be set to a real value in production — refusing to start with the dev default.',
    )
  }
  return result.data
}

export const env = loadEnv()
