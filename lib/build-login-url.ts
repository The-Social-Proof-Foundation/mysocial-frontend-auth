import type { AuthProvider, LoginParams } from './params';

function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.replace(/\/callback.*$/, '') ?? 'http://localhost:3000';
}

function getRedirectUri(): string {
  const explicit = process.env.NEXT_PUBLIC_DEV_REDIRECT_URI;
  if (explicit?.trim()) return explicit.trim();
  return `${getOrigin()}/callback`;
}

export interface DirectLoginConfig {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeVerifier?: string;
}

export function getDirectLoginConfig(): DirectLoginConfig | null {
  const clientId = process.env.NEXT_PUBLIC_DEV_CLIENT_ID?.trim();
  const codeChallenge = process.env.NEXT_PUBLIC_DEV_CODE_CHALLENGE?.trim();

  if (!clientId || !codeChallenge) return null;

  return {
    clientId,
    redirectUri: getRedirectUri(),
    codeChallenge,
    codeVerifier: process.env.NEXT_PUBLIC_DEV_CODE_VERIFIER?.trim() || undefined,
  };
}

export function isDirectLoginEnabled(): boolean {
  return getDirectLoginConfig() !== null;
}

export function buildLoginUrl(provider: AuthProvider): string | null {
  const config = getDirectLoginConfig();
  if (!config) return null;

  const origin = getOrigin();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    nonce,
    return_origin: origin,
    mode: 'redirect',
    provider,
    code_challenge: config.codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${origin}/login?${params.toString()}`;
}

export function buildLoginUrlFromParams(
  params: LoginParams,
  chosenProvider: AuthProvider
): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.replace(/\/callback.*$/, '') ??
        'http://localhost:3000';

  const searchParams = new URLSearchParams({
    client_id: params.client_id,
    redirect_uri: params.redirect_uri,
    state: params.state,
    nonce: params.nonce,
    return_origin: params.return_origin,
    mode: params.mode,
    provider: chosenProvider,
    code_challenge: params.code_challenge ?? '',
    code_challenge_method: params.code_challenge_method,
  });
  if (params.request_id) {
    searchParams.set('request_id', params.request_id);
  }

  return `${origin}/login?${searchParams.toString()}`;
}
