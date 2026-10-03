import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network'

export async function POST(request: NextRequest) {
  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await request.text(),
    cache: 'no-store',
  })
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json',
    },
  })
}
