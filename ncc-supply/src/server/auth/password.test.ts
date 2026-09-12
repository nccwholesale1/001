import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password against its own hash', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('wrong password', hash)).toBe(false)
  })

  it('never stores the plaintext password in the hash', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toContain('correct horse battery staple')
  })

  it('produces a different hash each time (random salt)', async () => {
    const first = await hashPassword('same password')
    const second = await hashPassword('same password')
    expect(first).not.toBe(second)
    expect(await verifyPassword('same password', first)).toBe(true)
    expect(await verifyPassword('same password', second)).toBe(true)
  })

  it('rejects a malformed stored hash instead of throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-real-hash')).resolves.toBe(false)
    await expect(verifyPassword('anything', 'scrypt:onlyonepart')).resolves.toBe(false)
    await expect(verifyPassword('anything', 'bcrypt:abc:def')).resolves.toBe(false)
  })
})
