import { NextRequest, NextResponse } from 'next/server';
import { publicOriginFromHeaders } from '@/lib/providers';

/**
 * OAuth providers redirect to `/callback` (registered redirect_uri).
 * Next.js cannot host both page.tsx and route.ts on the same segment, so
 * this route bridges to the client exchange UI at `/callback/continue`.
 *
 * - Google: GET /callback?code&state
 * - Apple: POST /callback (form_post) with code/state
 *
 * Location must use the public origin (x-forwarded-* / AUTH_CALLBACK_URL).
 * `request.url` on Railway is often http://localhost and breaks ASWebAuth.
 */
function continueUrl(request: NextRequest, params: URLSearchParams): URL {
  const origin = publicOriginFromHeaders(request.headers);
  const url = new URL('/callback/continue', origin);
  params.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url;
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    continueUrl(request, request.nextUrl.searchParams),
    303
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = new URLSearchParams();

  const error = form.get('error');
  const errorDescription = form.get('error_description');
  const code = form.get('code');
  const state = form.get('state');

  if (typeof error === 'string' && error.length > 0) {
    params.set('error', error);
    if (typeof errorDescription === 'string' && errorDescription.length > 0) {
      params.set('error_description', errorDescription);
    }
    if (typeof state === 'string' && state.length > 0) {
      params.set('state', state);
    }
    return NextResponse.redirect(continueUrl(request, params), 303);
  }

  if (typeof code === 'string' && code.length > 0) {
    params.set('code', code);
  }
  if (typeof state === 'string' && state.length > 0) {
    params.set('state', state);
  }

  return NextResponse.redirect(continueUrl(request, params), 303);
}
