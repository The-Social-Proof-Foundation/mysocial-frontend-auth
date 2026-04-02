'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseLoginParams } from '@/lib/params';
import { authDebugLog, getAuthState, setAuthState } from '@/lib/state';
import { buildProviderAuthUrl, resolveAuthCallbackUrlFromHeaders } from '@/lib/providers';
import { generatePkce } from '@/lib/pkce';
import type { AuthProvider, LoginParams } from '@/lib/params';

async function ensurePkceForGoogleApple(
  loginParams: LoginParams
): Promise<LoginParams> {
  if (loginParams.code_verifier) {
    return {
      ...loginParams,
      code_challenge: loginParams.code_challenge ?? '',
    };
  }
  const existing = await getAuthState();
  if (
    existing?.provider === 'none' &&
    existing.code_challenge &&
    existing.code_challenge === loginParams.code_challenge
  ) {
    return {
      ...loginParams,
      code_challenge: existing.code_challenge,
      code_verifier: existing.code_verifier,
    };
  }
  const { codeVerifier, codeChallenge } = generatePkce();
  return {
    ...loginParams,
    code_challenge: codeChallenge,
    code_verifier: codeVerifier,
  };
}

export async function initLogin(params: Record<string, string>) {
  const parsed = parseLoginParams(params);
  if (!parsed.success) {
    redirect(
      `/error?reason=invalid_params&message=${encodeURIComponent(parsed.error)}`
    );
  }

  let loginParams = parsed.params;

  if (loginParams.provider === 'none') {
    const { codeVerifier, codeChallenge } = generatePkce();
    loginParams = {
      ...loginParams,
      code_challenge: codeChallenge,
      code_verifier: codeVerifier,
    };
    await setAuthState(loginParams);
    redirect('/');
  }

  if (loginParams.provider === 'google' || loginParams.provider === 'apple') {
    loginParams = await ensurePkceForGoogleApple(loginParams);
  }

  const provider = loginParams.provider as AuthProvider;
  const hdrs = await headers();
  const providerRedirectUri = resolveAuthCallbackUrlFromHeaders(hdrs);
  authDebugLog('initLogin:before-oauth-redirect', {
    provider,
    host: hdrs.get('host'),
    xForwardedProto: hdrs.get('x-forwarded-proto'),
    providerRedirectUri,
    loginStatePrefix: loginParams.state?.slice(0, 8),
  });
  const providerUrl = buildProviderAuthUrl(
    provider,
    loginParams.state,
    loginParams.code_challenge ?? '',
    providerRedirectUri
  );

  if (!providerUrl) {
    redirect(
      `/error?reason=provider_not_configured&provider=${provider}`
    );
  }

  await setAuthState(loginParams);
  authDebugLog('initLogin:redirect-to-provider', {
    provider,
    redirectHost: (() => {
      try {
        return new URL(providerUrl).host;
      } catch {
        return 'parse-error';
      }
    })(),
  });
  redirect(providerUrl);
}
