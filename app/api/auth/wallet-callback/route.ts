import { NextRequest, NextResponse } from 'next/server';
import { getAuthState, clearAuthState } from '@/lib/state';
import { exchangeWalletAuth } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, message, signature, state } = body as {
      address?: string;
      message?: string;
      signature?: string;
      state?: string;
    };

    if (!address || !message || !signature || !state) {
      return NextResponse.json(
        { error: 'missing_params', message: 'Missing address, message, signature, or state' },
        { status: 400 }
      );
    }

    const authState = await getAuthState();

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

    if (authState.provider !== 'none') {
      await clearAuthState();
      return NextResponse.json(
        { error: 'invalid_state', message: 'Wallet auth requires provider=none flow' },
        { status: 400 }
      );
    }

    const result = await exchangeWalletAuth({
      address,
      message,
      signature,
      client_id: authState.client_id,
      redirect_uri: authState.redirect_uri,
      state: authState.state,
      nonce: authState.nonce,
      request_id: authState.request_id,
    });

    await clearAuthState();

    const user =
      result.user != null && Object.keys(result.user).length > 0
        ? result.user
        : { address };

    return NextResponse.json({
      success: true,
      mode: authState.mode,
      code: result.code,
      ...(result.salt != null && { salt: result.salt }),
      ...(result.id_token != null && { id_token: result.id_token }),
      ...(result.access_token != null && { access_token: result.access_token }),
      ...(result.session_access_token != null && {
        session_access_token: result.session_access_token,
      }),
      ...(result.refresh_token != null && { refresh_token: result.refresh_token }),
      ...(result.expires_in != null && { expires_in: result.expires_in }),
      user,
      state: authState.state,
      nonce: authState.nonce,
      clientId: authState.client_id,
      requestId: authState.request_id,
      redirectUri: authState.redirect_uri,
      returnOrigin: authState.return_origin,
    });
  } catch (err) {
    console.error('[auth/wallet-callback] exchangeWalletAuth failed:', err);
    const message = err instanceof Error ? err.message : 'Wallet auth exchange failed';
    return NextResponse.json(
      { error: 'exchange_failed', message },
      { status: 500 }
    );
  }
}
