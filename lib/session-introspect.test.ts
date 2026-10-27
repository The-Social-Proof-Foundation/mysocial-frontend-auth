import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { introspectSessionToken, introspectionAuthorized, verifySessionJwt } from './session-introspect'

function sessionToken(privateKey: KeyObject, kid: string, claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = sign(null, Buffer.from(`${header}.${payload}`), privateKey).toString('base64url')
  return `${header}.${payload}.${signature}`
}

describe('session introspection', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string }
  const now = Math.floor(Date.now() / 1000)
  const token = sessionToken(privateKey, 'mysocial-salt', {
    iss: 'https://salt.testnet.mysocial.network',
    aud: 'mysocial-auth-client-id',
    sub: 'user-1',
    wallet_address: '0xabc',
    provider: 'google',
    iat: now,
    exp: now + 60,
    jti: 'jti-1',
  })
  const fetchImpl = (async () => Response.json({ keys: [{ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', use: 'sig', kid: 'mysocial-salt', x: jwk.x }] })) as typeof fetch

  it('verifies a salt-signed session and returns the wallet', async () => {
    await expect(verifySessionJwt(token, fetchImpl)).resolves.toMatchObject({ sub: 'user-1', wallet_address: '0xabc' })
    await expect(introspectSessionToken(token, fetchImpl)).resolves.toMatchObject({ active: true, client_id: 'mysocial-auth-client-id', wallet_address: '0xabc' })
  })

  it('returns inactive for a bad token', async () => {
    await expect(introspectSessionToken(`${token}x`, fetchImpl)).resolves.toEqual({ active: false })
  })

  it('accepts only the configured basic client', () => {
    process.env.MCP_INTROSPECTION_CLIENT_ID = 'mcp'
    process.env.MCP_INTROSPECTION_CLIENT_SECRET = 'secret'
    const header = `Basic ${Buffer.from('mcp:secret').toString('base64')}`
    expect(introspectionAuthorized(header)).toBe(true)
    expect(introspectionAuthorized(`Basic ${Buffer.from('mcp:nope').toString('base64')}`)).toBe(false)
    delete process.env.MCP_INTROSPECTION_CLIENT_ID
    delete process.env.MCP_INTROSPECTION_CLIENT_SECRET
  })
})
