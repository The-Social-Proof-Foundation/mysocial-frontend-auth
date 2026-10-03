import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network'

export async function GET(request: NextRequest) {
  const credentialId = request.nextUrl.searchParams.get('credentialId') ?? ''
  const url = new URL(`${API_BASE.replace(/\/$/, '')}/wallet-vault/passkey`)
  url.searchParams.set('credentialId', credentialId)
  const response = await fetch(url, { method: 'GET', cache: 'no-store' })
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'text/plain',
    },
  })
}
