'use client';

const STORAGE_KEY = 'mysocial_return_origin';

/**
 * Get the target origin for postMessage to the opener (main app).
 * Uses URL param return_origin, then persisted sessionStorage (from ReturnOriginPersister),
 * then NEXT_PUBLIC_APP_REDIRECT_URI, then document.referrer.
 */
function getTargetOrigin(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const returnOrigin = params.get('return_origin');
  if (returnOrigin) {
    try {
      const url = new URL(returnOrigin);
      return `${url.protocol}//${url.host}`;
    } catch {
      // fall through
    }
  }

  const appUri = process.env.NEXT_PUBLIC_APP_REDIRECT_URI?.trim();
  if (appUri) {
    try {
      const url = new URL(appUri);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  if (document.referrer) {
    try {
      const url = new URL(document.referrer);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
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
    } catch (err) {
      console.error('postMessage failed:', err);
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
