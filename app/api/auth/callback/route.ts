import { NextRequest, NextResponse } from 'next/server';
import { decodeJwt } from '@socialproof/myso/zklogin';
import { getAuthState, clearAuthState } from '@/lib/state';
import { exchangeProviderCode } from '@/lib/api';
import { deriveEd25519AddressFromSubAndSalt } from '@/lib/address-derivation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body as { code?: string; state?: string };

    if (!state) {
      return NextResponse.json(
        { error: 'missing_params', message: 'Missing state' },
        { status: 400 }
      );
    }

    const authState = await getAuthState();

    if (!code) {
      if (!authState) {
        return NextResponse.json(
          { error: 'session_expired', message: 'Auth session expired' },
          { status: 400 }
        );
      }
      if (authState.state !== state) {
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
      return NextResponse.json(
        { error: 'session_expired', message: 'Auth session expired or not found' },
        { status: 400 }
      );
    }

    if (authState.state !== state) {
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

    const result = await exchangeProviderCode({
      provider: authState.provider,
      code,
      code_challenge: authState.code_challenge ?? '',
      redirect_uri: authState.redirect_uri,
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
