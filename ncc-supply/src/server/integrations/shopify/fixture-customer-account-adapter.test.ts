import { describe, expect, it } from 'vitest'
import { createFixtureCustomerAccountAdapter, mintFixtureIdToken } from './fixture-customer-account-adapter'

describe('fixture customer account adapter', () => {
  it('login() points at the dev-only fixture login page, carrying state/redirect_uri', async () => {
    const adapter = createFixtureCustomerAccountAdapter()
    const { url, state, codeVerifier, nonce } = await adapter.login('https://app.example.com/auth-callback')

    const parsed = new URL(url, 'http://fixture.local')
    expect(parsed.pathname).toBe('/dev/fixture-shopify-login')
    expect(parsed.searchParams.get('state')).toBe(state)
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app.example.com/auth-callback')
    expect(codeVerifier).toEqual(expect.any(String))
    expect(nonce).toEqual(expect.any(String))
  })

  it('authorize() then verifyIdentity() round-trips a minted fixture id_token to email/sub', async () => {
    const adapter = createFixtureCustomerAccountAdapter()
    const code = await mintFixtureIdToken('Buyer@Example.com')

    const session = await adapter.authorize(code, 'unused-verifier', 'https://app.example.com/auth-callback')
    expect(session.idToken).toBe(code)

    const identity = await adapter.verifyIdentity(session.idToken)
    expect(identity.email).toBe('buyer@example.com')
    expect(identity.shopifyCustomerId).toMatch(/^gid:\/\/shopify\/Customer\//)
  })

  it('rejects a tampered id_token (same contract as the real adapter — never trust an unverified claim)', async () => {
    const adapter = createFixtureCustomerAccountAdapter()
    const code = await mintFixtureIdToken('buyer@example.com')
    const tampered = `${code.slice(0, -2)}xx`

    await expect(adapter.verifyIdentity(tampered)).rejects.toThrow()
  })
})
