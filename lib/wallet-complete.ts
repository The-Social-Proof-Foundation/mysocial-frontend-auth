'use client';

export const STORAGE_KEY = 'mysocial_return_origin';

const UNSAFE_SCHEMES = ['javascript:', 'data:', 'file:', 'blob:', 'vbscript:'];

/**
 * Validate that an origin is safe for postMessage (https or http localhost only).
 */
export function isSafeOrigin(origin: string): boolean {
  if (!origin || typeof origin !== 'string') return false;
  const trimmed = origin.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const scheme = url.protocol.replace(':', '');
    if (UNSAFE_SCHEMES.includes(url.protocol)) return false;
    if (scheme === 'https') return true;
    if (scheme === 'http') {
      const host = url.hostname.toLowerCase();
      return host === 'localhost' || host === '127.0.0.1';
    }
    return false;
  } catch {
    return false;
  }
}

function normalizeToOrigin(value: string): string | null {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const origin = `${url.protocol}//${url.host}`;
    return isSafeOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

/**
 * Get the target origin for postMessage to the opener (main app).
 * Uses URL param return_origin, then persisted sessionStorage (from ReturnOriginPersister),
 * then NEXT_PUBLIC_APP_REDIRECT_URI, then document.referrer.
 * Only returns validated safe origins.
 */
function getTargetOrigin(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const returnOrigin = params.get('return_origin');
  if (returnOrigin) {
    const origin = normalizeToOrigin(returnOrigin);
    if (origin) return origin;
  }

  const appUri = process.env.NEXT_PUBLIC_APP_REDIRECT_URI?.trim();
  if (appUri) {
    const origin = normalizeToOrigin(appUri);
    if (origin) return origin;
  }

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored && isSafeOrigin(stored)) return stored;

  if (document.referrer) {
    const origin = normalizeToOrigin(document.referrer);
    if (origin) return origin;
  }
  return null;
}

export interface WalletResultMessage {
  type: 'MYSOCIAL_WALLET_RESULT';
  address: string;
  source: 'create' | 'import';
  mnemonic?: string;
  privateKey?: string;
}

export interface WalletAuthSuccess {
  success: true;
  mode: 'popup' | 'redirect';
  code: string;
  salt?: string;
  id_token?: string;
  access_token?: string;
  session_access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { address?: string; sub?: string; email?: string; [key: string]: unknown };
  state: string;
  nonce: string;
  clientId: string;
  requestId?: string;
  redirectUri: string;
  returnOrigin: string;
}

/**
 * Complete the wallet auth flow with session tokens (same as OAuth callback).
 * postMessage MYSOCIAL_AUTH_RESULT and dismiss popup, or redirect with hash fragment.
 */
export function completeWalletAuthFlow(success: WalletAuthSuccess): void {
  if (typeof window === 'undefined') return;

  if (success.mode === 'popup' && window.opener) {
    try {
      window.opener.postMessage(
        {
          type: 'MYSOCIAL_AUTH_RESULT',
          code: success.code,
          ...(success.salt != null && { salt: success.salt }),
          ...(success.id_token != null && { id_token: success.id_token }),
          ...(success.access_token != null && { access_token: success.access_token }),
          ...(success.session_access_token != null && {
            session_access_token: success.session_access_token,
          }),
          ...(success.refresh_token != null && { refresh_token: success.refresh_token }),
          ...(success.expires_in != null && { expires_in: success.expires_in }),
          ...(success.user != null && { user: success.user }),
          state: success.state,
          nonce: success.nonce,
          clientId: success.clientId,
          requestId: success.requestId,
        },
        success.returnOrigin
      );
      window.close();
    } catch {
      console.error('[wallet-complete] postMessage failed');
      const redirectUrl = new URL(success.redirectUri);
      redirectUrl.searchParams.set('code', success.code);
      if (success.user?.address) redirectUrl.searchParams.set('address', success.user.address);
      redirectUrl.searchParams.set('state', success.state);
      redirectUrl.searchParams.set('nonce', success.nonce);
      const hashParams = new URLSearchParams();
      if (success.session_access_token) hashParams.set('session_access_token', success.session_access_token);
      if (success.refresh_token) hashParams.set('refresh_token', success.refresh_token);
      if (success.expires_in != null) hashParams.set('expires_in', String(success.expires_in));
      const hash = hashParams.toString();
      window.location.href = hash ? `${redirectUrl.toString()}#${hash}` : redirectUrl.toString();
    }
  } else {
    const redirectUrl = new URL(success.redirectUri);
    redirectUrl.searchParams.set('code', success.code);
    if (success.salt != null) {
      redirectUrl.searchParams.set('salt', success.salt);
    }
    if (success.user?.address) {
      redirectUrl.searchParams.set('address', success.user.address);
    }
    if (success.user?.sub) {
      redirectUrl.searchParams.set('sub', success.user.sub);
    }
    redirectUrl.searchParams.set('state', success.state);
    redirectUrl.searchParams.set('nonce', success.nonce);
    const hashParams = new URLSearchParams();
    if (success.access_token) hashParams.set('access_token', success.access_token);
    if (success.id_token) hashParams.set('id_token', success.id_token);
    if (success.session_access_token) hashParams.set('session_access_token', success.session_access_token);
    if (success.refresh_token) hashParams.set('refresh_token', success.refresh_token);
    if (success.expires_in != null) hashParams.set('expires_in', String(success.expires_in));
    const hash = hashParams.toString();
    window.location.href = hash ? `${redirectUrl.toString()}#${hash}` : redirectUrl.toString();
  }
}

/**
 * Complete the wallet flow: if in a popup, postMessage to opener and close.
 * Otherwise redirect to the app with address in query params.
 * Use when no auth params (fallback for direct nav); prefer completeWalletAuthFlow when session tokens are available.
 */
export function completeWalletFlow(
  address: string,
  source: 'create' | 'import',
  walletData?: { mnemonic?: string; privateKey?: string }
): void {
  if (typeof window === 'undefined') return;

  const targetOrigin = getTargetOrigin();

  if (window.opener && targetOrigin) {
    try {
      const message: WalletResultMessage = {
        type: 'MYSOCIAL_WALLET_RESULT',
        address,
        source,
        ...(walletData?.mnemonic && { mnemonic: walletData.mnemonic }),
        ...(walletData?.privateKey && { privateKey: walletData.privateKey }),
      };
      window.opener.postMessage(message, targetOrigin);
      window.close();
    } catch {
      console.error('[wallet-complete] postMessage failed');
      fallbackRedirect(address);
    }
  } else {
    fallbackRedirect(address);
  }
}

function fallbackRedirect(address: string): void {
  const redirectUri = process.env.NEXT_PUBLIC_APP_REDIRECT_URI?.trim();
  if (redirectUri) {
    const url = new URL(redirectUri);
    url.searchParams.set('address', address);
    window.location.href = url.toString();
  } else {
    window.location.href = '/';
  }
}
