'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface CallbackSuccess {
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

interface CallbackError {
  error: string;
  message: string;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const providerError = searchParams.get('error');
      const providerErrorDesc = searchParams.get('error_description');
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (providerError) {
        const errMsg = providerErrorDesc ?? providerError;
        let errorTargetOrigin = '*';
        let errorRedirectUri: string | null = null;
        let errorMode: 'popup' | 'redirect' | null = null;
        let errorClientId: string | undefined;
        let errorRequestId: string | undefined;

        if (state) {
          try {
            const res = await fetch('/api/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: '', state }),
            });
            const data = (await res.json()) as {
              mode?: 'popup' | 'redirect';
              returnOrigin?: string;
              redirectUri?: string;
              clientId?: string;
              requestId?: string;
            };
            if (data.returnOrigin) errorTargetOrigin = data.returnOrigin;
            if (data.redirectUri) errorRedirectUri = data.redirectUri;
            if (data.mode) errorMode = data.mode;
            errorClientId = data.clientId;
            errorRequestId = data.requestId;
          } catch {
            // Use defaults if API fails
          }
        }

        if (!cancelled && errorMode === 'popup' && window.opener) {
          window.opener.postMessage(
            {
              type: 'MYSOCIAL_AUTH_ERROR',
              error: errMsg,
              state: state ?? '',
              clientId: errorClientId,
              requestId: errorRequestId,
            },
            errorTargetOrigin
          );
          window.close();
        } else if (!cancelled && errorRedirectUri) {
          const redirectUrl = new URL(errorRedirectUri);
          redirectUrl.searchParams.set('error', errMsg);
          if (state) redirectUrl.searchParams.set('state', state);
          if (errorMode === 'popup') redirectUrl.searchParams.set('_popup_fallback', '1');
          window.location.href = redirectUrl.toString();
        } else {
          setErrorMessage(errMsg);
          setStatus('error');
        }
        return;
      }

      if (!code || !state) {
        setErrorMessage('Missing code or state from provider');
        setStatus('error');
        return;
      }

      try {
        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });

        const data = (await res.json()) as CallbackSuccess | CallbackError;

        if (cancelled) return;

        if (!res.ok) {
          const err = data as CallbackError;
          const rawMessage = err.message ?? err.error ?? 'Exchange failed';
          const message =
            res.status === 500
              ? 'Unable to complete sign in. Please try again.'
              : rawMessage;
          setErrorMessage(message);
          setErrorDetails(res.status === 500 ? rawMessage : null);
          setStatus('error');
          return;
        }

        const success = data as CallbackSuccess;

        if (success.mode === 'popup' && window.opener) {
          window.opener.postMessage(
            {
              type: 'MYSOCIAL_AUTH_RESULT',
              code: success.code,
              ...(success.salt != null && { salt: success.salt }),
              ...(success.id_token != null && { id_token: success.id_token }),
              ...(success.access_token != null && { access_token: success.access_token }),
              ...(success.session_access_token != null && { session_access_token: success.session_access_token }),
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
          redirectUrl.searchParams.set('clientId', success.clientId);
          if (success.requestId != null) redirectUrl.searchParams.set('requestId', success.requestId);
          if (success.user?.email != null) redirectUrl.searchParams.set('email', success.user.email);
          if (success.mode === 'popup') redirectUrl.searchParams.set('_popup_fallback', '1');
          const hashParams = new URLSearchParams();
          if (success.access_token) hashParams.set('access_token', success.access_token);
          if (success.id_token) hashParams.set('id_token', success.id_token);
          if (success.session_access_token) hashParams.set('session_access_token', success.session_access_token);
          if (success.refresh_token) hashParams.set('refresh_token', success.refresh_token);
          if (success.expires_in != null) hashParams.set('expires_in', String(success.expires_in));
          const hash = hashParams.toString();
          window.location.href = hash ? `${redirectUrl.toString()}#${hash}` : redirectUrl.toString();
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('Unable to complete sign in. Please try again.');
          setStatus('error');
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-4">
        <p className="text-destructive text-center">{errorMessage}</p>
        {errorDetails && (
          <details className="w-full max-w-md text-left">
            <summary className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground cursor-pointer hover:underline">
              Technical details
            </summary>
            <pre className="mt-2 p-3 text-xs bg-muted rounded overflow-auto break-all">
              {errorDetails}
            </pre>
          </details>
        )}
        <a
          href="/error?reason=callback_failed"
          className="text-xs font-[var(--font-chakra-petch)] text-foreground hover:underline"
        >
          Return to error page
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <LoadingSpinner tone="foreground" />
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <LoadingSpinner tone="foreground" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
