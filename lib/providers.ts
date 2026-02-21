import type { AuthProvider } from './params';

function getAuthCallbackUrl(): string {
  if (process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL) {
    return process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL;
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/callback';
  }
  return 'https://auth.mysocial.network/callback';
}

const AUTH_CALLBACK_URL = getAuthCallbackUrl();

export interface ProviderConfig {
  authUrl: string;
  clientId: string;
  getAuthParams: (params: {
    state: string;
    codeChallenge: string;
  }) => Record<string, string>;
}

function getEnvClientId(provider: AuthProvider): string {
  switch (provider) {
    case 'google':
      return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
    case 'apple':
      return process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? '';
    case 'facebook':
      return process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? '';
    case 'twitch':
      return process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID ?? '';
    default:
      return '';
  }
}

export function getProviderConfig(provider: AuthProvider): ProviderConfig | null {
  const clientId = getEnvClientId(provider);
  if (!clientId) return null;

  switch (provider) {
    case 'google':
      return {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        clientId,
        getAuthParams: ({ state, codeChallenge }) => ({
          client_id: clientId,
          redirect_uri: AUTH_CALLBACK_URL,
          response_type: 'code',
          scope: 'openid email profile',
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          access_type: 'offline',
          prompt: 'consent',
        }),
      };

    case 'apple':
      return {
        authUrl: 'https://appleid.apple.com/auth/authorize',
        clientId,
        getAuthParams: ({ state, codeChallenge }) => ({
          client_id: clientId,
          redirect_uri: AUTH_CALLBACK_URL,
          response_type: 'code',
          response_mode: 'query',
          scope: 'name email',
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        }),
      };

    case 'facebook':
      return {
        authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
        clientId,
        getAuthParams: ({ state }) => ({
          client_id: clientId,
          redirect_uri: AUTH_CALLBACK_URL,
          response_type: 'code',
          scope: 'email,public_profile',
          state,
        }),
      };

    case 'twitch':
      return {
        authUrl: 'https://id.twitch.tv/oauth2/authorize',
        clientId,
        getAuthParams: ({ state }) => ({
          client_id: clientId,
          redirect_uri: AUTH_CALLBACK_URL,
          response_type: 'code',
          scope: 'openid user:read:email',
          state,
          force_verify: 'true',
        }),
      };

    default:
      return null;
  }
}

export function buildProviderAuthUrl(
  provider: AuthProvider,
  state: string,
  codeChallenge: string
): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const params = config.getAuthParams({ state, codeChallenge });
  const search = new URLSearchParams(params);
  return `${config.authUrl}?${search.toString()}`;
}
