import { createPublicKey, timingSafeEqual, verify, type JsonWebKey, type KeyObject } from 'node:crypto'

const DEFAULT_ISSUER = 'https://auth.testnet.mysocial.network'
const DEFAULT_SALT_JWKS = 'https://salt.testnet.mysocial.network/.well-known/jwks.json'

export interface SessionClaims {
  iss: string
  aud: string
  sub: string
  wallet_address?: string
  provider: string
  iat: number
  exp: number
  jti: string
}

interface JsonWebKeySet {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>
}

export function authIssuer(): string {
  return (process.env.AUTH_PUBLIC_ORIGIN ?? DEFAULT_ISSUER).replace(/\/$/, '')
}

export function saltJwksUrl(): string {
  if (process.env.SESSION_JWKS_URL) return process.env.SESSION_JWKS_URL.replace(/\/$/, '')
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '')
  return base ? `${base}/.well-known/jwks.json` : DEFAULT_SALT_JWKS
}

export function allowedSessionIssuers(): string[] {
  const configured = process.env.SESSION_JWT_ISSUER?.trim().replace(/\/$/, '')
  const issuers = [authIssuer(), 'https://salt.testnet.mysocial.network']
  if (configured) issuers.push(configured)
  return issuers.filter((issuer, index) => issuers.indexOf(issuer) === index)
}

export function introspectionAuthorized(header: string | null): boolean {
  const clientId = process.env.MCP_INTROSPECTION_CLIENT_ID ?? ''
  const clientSecret = process.env.MCP_INTROSPECTION_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret || !header?.startsWith('Basic ')) return false
  let decoded = ''
  try {
    decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8')
  } catch {
    return false
  }
  const split = decoded.indexOf(':')
  if (split < 0) return false
  return safeEqual(decoded.slice(0, split), clientId) && safeEqual(decoded.slice(split + 1), clientSecret)
}

export async function introspectSessionToken(token: string, fetchImpl: typeof fetch = fetch): Promise<Record<string, unknown>> {
  try {
    const claims = await verifySessionJwt(token, fetchImpl)
    return {
      active: true,
      sub: claims.sub,
      client_id: claims.aud,
      exp: claims.exp,
      iss: claims.iss,
      ...(claims.wallet_address ? { wallet_address: claims.wallet_address } : {}),
    }
  } catch {
    return { active: false }
  }
}

export async function verifySessionJwt(token: string, fetchImpl: typeof fetch = fetch): Promise<SessionClaims> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string]
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { kid?: string; alg?: string }
  if (header.alg !== 'EdDSA' || !header.kid) throw new Error('Unsupported JWT')
  const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as SessionClaims
  if (!claims.iss || !allowedSessionIssuers().includes(claims.iss.replace(/\/$/, ''))) throw new Error('Invalid issuer')
  if (!claims.sub || !claims.aud || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error('Expired JWT')
  const key = await jwkForKid(header.kid, fetchImpl)
  const signature = Buffer.from(signaturePart, 'base64url')
  const ok = verify(null, Buffer.from(`${headerPart}.${payloadPart}`), key, signature)
  if (!ok) throw new Error('Invalid signature')
  return claims
}

async function jwkForKid(kid: string, fetchImpl: typeof fetch): Promise<KeyObject> {
  const response = await fetchImpl(saltJwksUrl(), { cache: 'no-store' })
  if (!response.ok) throw new Error('JWKS unavailable')
  const body = await response.json() as JsonWebKeySet
  const jwk = body.keys?.find((key) => key.kid === kid && key.kty === 'OKP' && key.crv === 'Ed25519')
  if (!jwk) throw new Error('Signing key not found')
  return createPublicKey({ key: jwk, format: 'jwk' })
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
