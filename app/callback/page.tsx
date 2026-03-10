'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface CallbackSuccess {
  success: true;
  mode: 'popup' | 'redirect';
  code: string;
  salt?: string;
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
          redirectUrl.searchParams.set('state', success.state);
          redirectUrl.searchParams.set('nonce', success.nonce);
          window.location.href = redirectUrl.toString();
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
            <summary className="text-sm text-muted-foreground cursor-pointer hover:underline">
              Technical details
            </summary>
            <pre className="mt-2 p-3 text-xs bg-muted rounded overflow-auto break-all">
              {errorDetails}
            </pre>
          </details>
        )}
        <a
          href="/error?reason=callback_failed"
          className="text-sm text-foreground hover:underline"
        >
          Return to error page
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
      <LoadingSpinner className="text-foreground" />
      <p className="text-sm text-muted-foreground">
        Completing sign in...
      </p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <LoadingSpinner className="text-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading...
          </p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
