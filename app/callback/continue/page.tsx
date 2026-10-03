'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Copy } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { generateNewWallet, signMessage } from '@/lib/wallet';
import {
  fetchExistingVaultAddress,
  MNEMONIC_RECOVERY_INFO,
  publishRootVault,
} from '@/lib/publish-vault';

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
  debug?: Record<string, unknown>;
}

const DERIVATION_PATH = "m/44'/6976'/0'/0'/0'";

function finishLogin(success: CallbackSuccess) {
  if (success.mode === 'popup' && window.opener) {
    window.opener.postMessage(
      {
        type: 'MYSOCIAL_AUTH_RESULT',
        code: success.code,
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
    return;
  }

  const redirectUrl = new URL(success.redirectUri);
  redirectUrl.searchParams.set('code', success.code);
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

function withAddress(success: CallbackSuccess, address: string): CallbackSuccess {
  return {
    ...success,
    user: { ...(success.user ?? {}), address },
  };
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'save-phrase'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [pendingSuccess, setPendingSuccess] = useState<CallbackSuccess | null>(null);
  const [newWallet, setNewWallet] = useState<{ address: string; mnemonic: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

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
              credentials: 'include',
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
          credentials: 'include',
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
          const details =
            res.status === 500
              ? rawMessage
              : err.debug != null
                ? JSON.stringify(err.debug, null, 2)
                : null;
          setErrorDetails(details);
          setStatus('error');
          return;
        }

        const success = data as CallbackSuccess;
        if (!success.session_access_token) {
          setErrorMessage('Could not store the encrypted wallet vault.');
          setStatus('error');
          return;
        }

        const existingAddress = await fetchExistingVaultAddress(success.session_access_token);
        if (cancelled) return;
        if (existingAddress) {
          finishLogin(withAddress(success, existingAddress));
          return;
        }

        const wallet = await generateNewWallet();
        if (cancelled) return;
        setPendingSuccess(success);
        setNewWallet(wallet);
        setStatus('save-phrase');
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

  const saveVaultAndFinish = async () => {
    if (!pendingSuccess?.session_access_token || !newWallet) return;
    setPublishing(true);
    setErrorMessage('');
    try {
      await publishRootVault({
        accessToken: pendingSuccess.session_access_token,
        address: newWallet.address,
        plaintext: {
          kind: 'mnemonic',
          mnemonic: newWallet.mnemonic,
          derivationPath: DERIVATION_PATH,
        },
        recoveryPhrase: newWallet.mnemonic,
        recoveryInfo: MNEMONIC_RECOVERY_INFO,
        sign: (message) => signMessage(newWallet.mnemonic, message),
      });
      const address = newWallet.address;
      setNewWallet(null);
      finishLogin(withAddress(pendingSuccess, address));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not store the encrypted wallet vault.');
      setPublishing(false);
    }
  };

  if (status === 'save-phrase' && newWallet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background text-foreground p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-chakra-petch text-2xl font-semibold text-center">
              Save your recovery phrase
            </h1>
            <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center">
              This phrase unlocks the wallet for this login. It is shown once.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium font-[var(--font-chakra-petch)] text-muted-foreground">Recovery Phrase</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(newWallet.mnemonic)}
                className="h-6 px-2"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-lg grid grid-cols-3 gap-2">
              {newWallet.mnemonic.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                  <span className="font-mono">{word}</span>
                </div>
              ))}
            </div>
          </div>
          {errorMessage && (
            <p className="text-xs font-[var(--font-chakra-petch)] text-destructive text-center">{errorMessage}</p>
          )}
          <Button
            className="w-full font-chakra-petch py-3 bg-button-surface text-foreground border border-border hover:border-white/15"
            onClick={saveVaultAndFinish}
            disabled={publishing}
          >
            {publishing ? <LoadingSpinner /> : 'Continue'}
          </Button>
        </div>
      </div>
    );
  }

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

export default function CallbackContinuePage() {
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
