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

/**
 * Complete the wallet flow: if in a popup, postMessage to opener and close.
 * Otherwise redirect to the app with address in query params.
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
