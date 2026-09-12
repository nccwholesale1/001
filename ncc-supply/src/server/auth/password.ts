import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const SALT_BYTES = 16
const KEY_LENGTH = 64

/**
 * scrypt via node:crypto rather than a third-party hashing library — no
 * native-binding dependency to fight (this machine has no Python/build
 * tools; see DECISIONS.md ADR-004 revision for the same constraint hitting
 * the database driver choice).
 *
 * Stored format: "scrypt:<saltHex>:<hashHex>" — self-describing so the
 * verify side never has to guess parameters, and a future algorithm change
 * can add a new prefix without breaking existing stored hashes.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derivedKey = (await scrypt(plainPassword, salt, KEY_LENGTH)) as Buffer
  return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const [, saltHex, hashHex] = parts
  if (!saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = (await scrypt(plainPassword, salt, expected.length)) as Buffer

  // timingSafeEqual throws on length mismatch rather than returning false —
  // guard first so a malformed/tampered hash can't leak timing information.
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}
