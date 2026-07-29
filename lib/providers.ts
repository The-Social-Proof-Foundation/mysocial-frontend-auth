import type { AuthProvider } from './params';

/** `/auth/callback` is an app alias of `/callback`. Salt + Google OAuth require exact match; unify to canonical `/callback`. */
export function canonicalProviderCallbackUrl(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.replace(/\/$/, '') || '/';
    if (path === '/auth/callback') {
      return `${u.origin}/callback`;
    }
    return trimmed.replace(/\/$/, '');
  } catch {
    return trimmed.replace(/\/$/, '');
  }
}

/** Match the incoming request so OAuth return hits the same origin as the session cookie. */
function getRequestProto(headerList: { get(name: string): string | null }): string {
  const raw = headerList.get('x-forwarded-proto');
  if (raw) {
    const p = raw.split(',')[0]?.trim().toLowerCase();
    if (p === 'https' || p === 'http') return p;
  }
  return 'http';
}

function firstForwardedValue(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first || null;
}

function getAuthCallbackUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim();
  if (explicit) {
    return canonicalProviderCallbackUrl(explicit);
  }
  if (
    ['development', 'localnet'].includes(String(process.env.NODE_ENV ?? ''))
  ) {
    return 'http://localhost:3000/callback';
  }
  return 'https://auth.testnet.mysocial.network/callback';
}

/**
 * Public site origin for redirects (never Railway/Docker internal `localhost` from `request.url`).
 * Prefer x-forwarded-*; fall back to NEXT_PUBLIC_AUTH_CALLBACK_URL origin.
 */
export function publicOriginFromHeaders(headerList: {
  get(name: string): string | null;
}): string {
  const forwardedHost = firstForwardedValue(headerList.get('x-forwarded-host'));
  if (forwardedHost) {
    const proto = getRequestProto(headerList);
    return `${proto}://${forwardedHost}`;
  }

  const explicit = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim();
  if (explicit) {
    try {
      return new URL(canonicalProviderCallbackUrl(explicit)).origin;
    } catch {
      // fall through
    }
  }

  const host = firstForwardedValue(headerList.get('host'));
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const proto = getRequestProto(headerList);
    return `${proto}://${host}`;
  }

  try {
    return new URL(getAuthCallbackUrl()).origin;
  } catch {
    return 'https://auth.testnet.mysocial.network';
  }
}

/**
 * OAuth provider redirect_uri must match how the user reached /login (http vs https, host, port).
 * Forcing http:// while the app runs on https:// leaves the iron-session cookie on the wrong origin.
 */
export function resolveAuthCallbackUrlFromHeaders(headerList: {
  get(name: string): string | null;
}): string {
  const explicit = process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL?.trim();
  let resolved: string;
  if (explicit) {
    resolved = explicit;
  } else if (
    ['development', 'localnet'].includes(String(process.env.NODE_ENV ?? ''))
  ) {
    const host =
      firstForwardedValue(headerList.get('x-forwarded-host')) ??
      firstForwardedValue(headerList.get('host'));
    if (host) {
      const proto = getRequestProto(headerList);
      resolved = `${proto}://${host}/callback`;
    } else {
      resolved = getAuthCallbackUrl();
    }
  } else {
    resolved = getAuthCallbackUrl();
  }
  return canonicalProviderCallbackUrl(resolved);
}

const AUTH_CALLBACK_URL = getAuthCallbackUrl();

export interface ProviderConfig {
  authUrl: string;
  clientId: string;
  getAuthParams: (params: {
    state: string;
    codeChallenge: string;
    nonce: string;
  }) => Record<string, string>;
}

function getEnvClientId(provider: AuthProvider): string {
  switch (provider) {
    case 'google':
      return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
    case 'apple':
      return process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? '';
  }
}

export function getProviderConfig(
  provider: AuthProvider,
  redirectUri: string = AUTH_CALLBACK_URL
): ProviderConfig | null {
  const clientId = getEnvClientId(provider);
  if (!clientId) return null;

  switch (provider) {
    case 'google':
      return {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId,
        getAuthParams: ({ state, codeChallenge, nonce }) => ({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: 'openid email profile',
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
        }),
      };

    case 'apple':
      // Apple requires form_post when requesting name/email scopes.
      // POST /callback (route.ts) bridges to /callback/continue for the client page.
      return {
        authUrl: 'https://appleid.apple.com/auth/authorize',
        clientId,
        getAuthParams: ({ state, codeChallenge, nonce }) => ({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          response_mode: 'form_post',
          scope: 'name email',
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        }),
      };

    // case 'facebook':
    //   return {
    //     authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    //     clientId,
    //     getAuthParams: ({ state }) => ({
    //       client_id: clientId,
    //       redirect_uri: AUTH_CALLBACK_URL,
    //       response_type: 'code',
    //       scope: 'email,public_profile',
    //       state,
    //     }),
    //   };
    //
    // case 'twitch':
    //   return {
    //     authUrl: 'https://id.twitch.tv/oauth2/authorize',
    //     clientId,
    //     getAuthParams: ({ state }) => ({
    //       client_id: clientId,
    //       redirect_uri: AUTH_CALLBACK_URL,
    //       response_type: 'code',
    //       scope: 'openid user:read:email',
    //       state,
    //       force_verify: 'true',
    //     }),
    //   };
  }
}

export function buildProviderAuthUrl(
  provider: AuthProvider,
  state: string,
  codeChallenge: string,
  nonce: string,
  redirectUri: string = AUTH_CALLBACK_URL
): string | null {
  const config = getProviderConfig(provider, redirectUri);
  if (!config) return null;

  const params = config.getAuthParams({ state, codeChallenge, nonce });
  const search = new URLSearchParams(params);
  return `${config.authUrl}?${search.toString()}`;
}

const ALL_PROVIDERS: AuthProvider[] = [
  'google',
  'apple',
  // 'facebook',
  // 'twitch',
];

export function getConfiguredProviders(): AuthProvider[] {
  return ALL_PROVIDERS.filter((p) => getProviderConfig(p) !== null);
}
