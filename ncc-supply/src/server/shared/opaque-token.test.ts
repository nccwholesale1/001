import { describe, expect, it } from 'vitest'
import { generateOpaqueToken, hashOpaqueToken } from './opaque-token'

describe('generateOpaqueToken', () => {
  it('generates high-entropy, non-repeating tokens', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateOpaqueToken()))
    expect(tokens.size).toBe(1000)
  })

  it('generates url-safe tokens', () => {
    const token = generateOpaqueToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('hashOpaqueToken', () => {
  it('is deterministic for the same input', () => {
    const token = generateOpaqueToken()
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token))
  })

  it('produces different hashes for different tokens', () => {
    expect(hashOpaqueToken(generateOpaqueToken())).not.toBe(hashOpaqueToken(generateOpaqueToken()))
  })

  it('never returns the raw token itself', () => {
    const token = generateOpaqueToken()
    expect(hashOpaqueToken(token)).not.toBe(token)
  })
})
