import type { AuthProvider } from './params';

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
}

export function getDirectLoginConfig(): DirectLoginConfig | null {
  const clientId = process.env.NEXT_PUBLIC_DEV_CLIENT_ID?.trim();
  const codeChallenge = process.env.NEXT_PUBLIC_DEV_CODE_CHALLENGE?.trim();

  if (!clientId || !codeChallenge) return null;

  return {
    clientId,
    redirectUri: getRedirectUri(),
    codeChallenge,
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
