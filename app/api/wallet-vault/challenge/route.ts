import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network'

export async function POST(request: NextRequest) {
  const headers = new Headers({ 'content-type': 'application/json' })
  const authorization = request.headers.get('authorization')
  if (authorization) headers.set('authorization', authorization)
  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/wallet-vault/challenge`, {
    method: 'POST',
    headers,
    cache: 'no-store',
  })
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'text/plain',
    },
  })
}
