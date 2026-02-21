import { NextRequest, NextResponse } from 'next/server';
import { getAuthState, clearAuthState } from '@/lib/state';
import { exchangeProviderCode } from '@/lib/api';

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

    const result = await exchangeProviderCode({
      provider: authState.provider,
      code,
      code_challenge: authState.code_challenge,
      redirect_uri: authState.redirect_uri,
      client_id: authState.client_id,
      state: authState.state,
      nonce: authState.nonce,
      request_id: authState.request_id,
    });

    await clearAuthState();

    return NextResponse.json({
      success: true,
      mode: authState.mode,
      code: result.code,
      state: authState.state,
      nonce: authState.nonce,
      clientId: authState.client_id,
      requestId: authState.request_id,
      redirectUri: authState.redirect_uri,
      returnOrigin: authState.return_origin,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Exchange failed';
    return NextResponse.json(
      { error: 'exchange_failed', message },
      { status: 500 }
    );
  }
}
