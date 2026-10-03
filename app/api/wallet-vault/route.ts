import { NextRequest, NextResponse } from 'next/server'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://salt.testnet.mysocial.network'

function saltHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  const authorization = request.headers.get('authorization')
  if (authorization) headers.set('authorization', authorization)
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  return headers
}

async function proxy(request: NextRequest, method: 'GET' | 'PUT'): Promise<NextResponse> {
  const init: RequestInit = {
    method,
    headers: saltHeaders(request),
    cache: 'no-store',
  }
  if (method === 'PUT') init.body = await request.text()
  const response = await fetch(`${API_BASE.replace(/\/$/, '')}/wallet-vault`, init)
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'text/plain',
    },
  })
}

export function GET(request: NextRequest) {
  return proxy(request, 'GET')
}

export function PUT(request: NextRequest) {
  return proxy(request, 'PUT')
}
