import { NextResponse } from 'next/server'
import { authIssuer } from '@/lib/session-introspect'

export function GET() {
  const issuer = authIssuer()
  const salt = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network').replace(/\/$/, '')
  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/login`,
    token_endpoint: `${salt}/auth/refresh`,
    introspection_endpoint: `${issuer}/oauth/introspect`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic'],
    introspection_endpoint_auth_methods_supported: ['client_secret_basic'],
    code_challenge_methods_supported: ['S256'],
  })
}
