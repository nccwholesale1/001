import { createHash, randomBytes } from 'node:crypto'

/**
 * Shared primitive for every "raw token in the client's hands, only a hash
 * stored server-side" pattern in this app: staff sessions and guest
 * order/quote/return/support tokens alike (CLAUDE.md rule 16). Keeping one
 * implementation means both get the same entropy and hashing choices rather
 * than two hand-rolled variants drifting apart.
 */
const TOKEN_BYTES = 32

export function generateOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export function hashOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}
