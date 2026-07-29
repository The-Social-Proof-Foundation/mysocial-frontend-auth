import { NextRequest, NextResponse } from 'next/server';

/**
 * Apple Sign In returns to the redirect_uri via HTTP POST (form_post)
 * when name/email scopes are requested. Bridge to the existing GET
 * callback page so the client exchange flow stays unchanged.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();

  const code = form.get('code');
  const state = form.get('state');
  const error = form.get('error');
  const errorDescription = form.get('error_description');

  const callbackUrl = new URL('/callback', request.url);

  if (typeof error === 'string' && error.length > 0) {
    callbackUrl.searchParams.set('error', error);
    if (typeof errorDescription === 'string' && errorDescription.length > 0) {
      callbackUrl.searchParams.set('error_description', errorDescription);
    }
    if (typeof state === 'string' && state.length > 0) {
      callbackUrl.searchParams.set('state', state);
    }
    return NextResponse.redirect(callbackUrl, 303);
  }

  if (typeof code === 'string' && code.length > 0) {
    callbackUrl.searchParams.set('code', code);
  }
  if (typeof state === 'string' && state.length > 0) {
    callbackUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(callbackUrl, 303);
}
