import { NextRequest, NextResponse } from 'next/server';
import { decodeJwt } from '@socialproof/myso/zklogin';
import {
  authDebugEnabled,
  authDebugLog,
  getAuthState,
  clearAuthState,
} from '@/lib/state';
import { exchangeProviderCode } from '@/lib/api';
import { canonicalProviderCallbackUrl } from '@/lib/providers';
import { deriveEd25519AddressFromSubAndSalt } from '@/lib/address-derivation';

export const dynamic = 'force-dynamic';

const AUTH_STATE_COOKIE = 'auth_state';

function buildSessionExpiredDebug(request: NextRequest): Record<string, unknown> {
  const auth = request.cookies.get(AUTH_STATE_COOKIE);
  const len = auth?.value?.length ?? 0;
  const host = request.headers.get('host');
  const xfh = request.headers.get('x-forwarded-host');
  const xfp = request.headers.get('x-forwarded-proto');
  const publicHost = xfh?.split(',')[0]?.trim() || host || '';

  const internalHostHint =
    host?.includes('localhost') || host?.includes('127.0.0.1')
      ? '`host` is often the container bind address on Railway/Docker — use `xForwardedHost` for your real URL.'
      : null;

  let hint: string;
  if (len === 0) {
    hint =
      'Cookie named auth_state exists but has no value — try clearing site data for this domain and sign in again.';
  } else {
    hint =
      'Cookie has data but session is empty after decrypt. Common causes: (1) AUTH_STATE_SECRET differs between the server action that set the cookie and this API route (different env on instances or redeploy changed secret), (2) stale cookie from an old secret — clear cookies or use incognito, (3) expired iron-session seal (wait > TTL).';
  }

  return {
    authStateCookieLength: len,
    cookieHasValue: len > 0,
    host,
    xForwardedHost: xfh,
    xForwardedProto: xfp,
    effectivePublicHost: publicHost,
    ...(internalHostHint ? { note: internalHostHint } : {}),
    hint,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body as { code?: string; state?: string };

    if (authDebugEnabled()) {
      const cookieNames = request.cookies.getAll().map((c) => c.name);
      authDebugLog('POST /api/auth/callback', {
        host: request.headers.get('host'),
        xForwardedProto: request.headers.get('x-forwarded-proto'),
        xForwardedHost: request.headers.get('x-forwarded-host'),
        cookieNames,
        hasAuthStateCookie: cookieNames.includes('auth_state'),
        hasCode: Boolean(code),
        statePrefix: state?.slice(0, 8) ?? null,
      });
    }

    if (!state) {
      return NextResponse.json(
        { error: 'missing_params', message: 'Missing state' },
        { status: 400 }
      );
    }

    const authState = await getAuthState();

    if (!code) {
      if (!authState) {
        authDebugLog('POST /api/auth/callback:fail', {
          reason: 'no_session_provider_error_path',
          statePrefix: state.slice(0, 8),
        });
        return NextResponse.json(
          { error: 'session_expired', message: 'Auth session expired' },
          { status: 400 }
        );
      }
      if (authState.state !== state) {
        authDebugLog('POST /api/auth/callback:fail', {
          reason: 'state_mismatch_provider_error',
          sessionStatePrefix: authState.state?.slice(0, 8),
          paramStatePrefix: state.slice(0, 8),
        });
        return NextResponse.json(
          { error: 'invalid_state', message: 'State mismatch' },
          { status: 400 }
        );
      }
      await clearAuthState();
      return NextResponse.json({
        mode: authState.mode,
        returnOrigin: authState.return_origin,
        redirectUri: authState.redirect_uri,
        clientId: authState.client_id,
        requestId: authState.request_id,
      });
    }

    if (!authState) {
      authDebugLog('POST /api/auth/callback:fail', {
        reason: 'no_session_success_path',
        statePrefix: state.slice(0, 8),
        ...buildSessionExpiredDebug(request),
      });
      return NextResponse.json(
        {
          error: 'session_expired',
          message: 'Auth session expired or not found',
          ...(authDebugEnabled() && { debug: buildSessionExpiredDebug(request) }),
        },
        { status: 400 }
      );
    }

    if (authState.state !== state) {
      authDebugLog('POST /api/auth/callback:fail', {
        reason: 'state_mismatch_success_path',
        sessionStatePrefix: authState.state?.slice(0, 8),
        paramStatePrefix: state.slice(0, 8),
      });
      await clearAuthState();
      return NextResponse.json(
        { error: 'invalid_state', message: 'State mismatch' },
        { status: 400 }
      );
    }

    if (authState.provider === 'none') {
      await clearAuthState();
      return NextResponse.json(
        { error: 'invalid_state', message: 'Provider not selected' },
        { status: 400 }
      );
    }

    const rawOAuthRedirectUri =
      authState.provider_redirect_uri?.trim() ||
      process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim() ||
      '';
    const oauthRedirectUri = canonicalProviderCallbackUrl(rawOAuthRedirectUri);

    if (!oauthRedirectUri) {
      await clearAuthState();
      return NextResponse.json(
        {
          error: 'configuration',
          message:
            'Missing OAuth callback URL in session. Clear cookies and start sign-in again.',
        },
        { status: 500 }
      );
    }

    const result = await exchangeProviderCode({
      provider: authState.provider,
      code,
      code_challenge: authState.code_challenge ?? '',
      redirect_uri: oauthRedirectUri,
      client_id: authState.client_id,
      state: authState.state,
      nonce: authState.nonce,
      code_verifier: authState.code_verifier,
      request_id: authState.request_id,
    });

    await clearAuthState();

    let user: { address?: string; sub?: string; email?: string; [key: string]: unknown } | undefined;
    if (result.user != null) {
      user = { ...result.user };
      if (user.sub == null && result.id_token != null) {
        try {
          const payload = decodeJwt(result.id_token) as { sub?: string };
          if (payload.sub) user.sub = payload.sub;
        } catch {
          // JWT decode failed; keep user as-is
        }
      }
    } else if (result.salt != null && result.id_token != null) {
      try {
        const payload = decodeJwt(result.id_token) as { sub?: string; email?: string };
        if (payload.sub) {
          const address = await deriveEd25519AddressFromSubAndSalt(payload.sub, result.salt);
          user = { address, sub: payload.sub, ...(payload.email && { email: payload.email }) };
        } else {
          user = { sub: payload.sub, ...(payload.email && { email: payload.email }) };
        }
      } catch {
        user = undefined;
      }
    } else if (result.id_token != null) {
      try {
        const payload = decodeJwt(result.id_token) as { sub?: string; email?: string };
        user = {};
        if (payload.sub) user.sub = payload.sub;
        if (payload.email) user.email = payload.email;
      } catch {
        // JWT decode failed; no user
      }
    }

    return NextResponse.json({
      success: true,
      mode: authState.mode,
      code: result.code,
      ...(result.salt != null && { salt: result.salt }),
      ...(result.id_token != null && { id_token: result.id_token }),
      ...(result.access_token != null && { access_token: result.access_token }),
      ...(result.session_access_token != null && { session_access_token: result.session_access_token }),
      ...(result.refresh_token != null && { refresh_token: result.refresh_token }),
      ...(result.expires_in != null && { expires_in: result.expires_in }),
      ...(user != null && Object.keys(user).length > 0 && { user }),
      state: authState.state,
      nonce: authState.nonce,
      clientId: authState.client_id,
      requestId: authState.request_id,
      redirectUri: authState.redirect_uri,
      returnOrigin: authState.return_origin,
    });
  } catch (err) {
    console.error('[auth/callback] exchangeProviderCode failed:', err);
    const message = err instanceof Error ? err.message : 'Exchange failed';
    return NextResponse.json(
      { error: 'exchange_failed', message },
      { status: 500 }
    );
  }
}
