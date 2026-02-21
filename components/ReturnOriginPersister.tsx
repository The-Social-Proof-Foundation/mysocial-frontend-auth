'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'mysocial_return_origin';

/**
 * Persist opener's origin when auth frontend loads in a popup.
 * Must run on first load so we have the main app origin before client-side nav
 * to /create-wallet or /import-wallet (which would change document.referrer).
 */
export function ReturnOriginPersister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.opener) return;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) return;

      const referrer = document.referrer;
      if (!referrer) return;

      const url = new URL(referrer);
      const origin = `${url.protocol}//${url.host}`;
      if (origin === window.location.origin) return;

      sessionStorage.setItem(STORAGE_KEY, origin);
    } catch {
      // ignore
    }
  }, []);

  return null;
}
