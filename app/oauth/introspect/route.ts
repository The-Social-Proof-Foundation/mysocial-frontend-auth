import { NextRequest, NextResponse } from 'next/server'
import { introspectionAuthorized, introspectSessionToken } from '@/lib/session-introspect'

export async function POST(request: NextRequest) {
  if (!introspectionAuthorized(request.headers.get('authorization'))) {
    return NextResponse.json({ active: false }, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="mcp-introspection"' } })
  }
  const form = await request.formData()
  const token = form.get('token')
  const result = await introspectSessionToken(typeof token === 'string' ? token : '')
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
}
