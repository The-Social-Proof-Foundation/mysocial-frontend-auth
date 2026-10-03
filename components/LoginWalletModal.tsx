'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Wallet, Download, Fingerprint } from 'lucide-react';
import {
  BrowserPasskeyProvider,
  PasskeyKeypair,
  findCommonPublicKey,
} from '@socialproof/myso/keypairs/passkey';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  buildLoginUrl,
  buildLoginUrlFromParams,
  isDirectLoginEnabled,
} from '@/lib/build-login-url';
import { getConfiguredProviders } from '@/lib/providers';
import { getPendingAuthParams } from '@/lib/auth-actions';
import { isSafeOrigin, STORAGE_KEY } from '@/lib/wallet-complete';
import type { AuthProvider, LoginParams } from '@/lib/params';

const PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
};

const PROVIDER_LOGOS: Record<AuthProvider, string> = {
  google: '/google.svg',
  apple: '/apple.svg',
};

export function LoginWalletModal() {
  const [navigating, setNavigating] = useState<AuthProvider | null>(null);
  const [pendingParams, setPendingParams] = useState<LoginParams | null>(null);
  const [pendingParamsLoaded, setPendingParamsLoaded] = useState(false);

  const directLoginEnabled = isDirectLoginEnabled();
  const configuredProviders = getConfiguredProviders();
  const pickerEnabled = directLoginEnabled || !!pendingParams;

  useEffect(() => {
    getPendingAuthParams().then((params) => {
      setPendingParams(params);
      setPendingParamsLoaded(true);
      if (params?.return_origin && isSafeOrigin(params.return_origin)) {
        try {
          sessionStorage.setItem(STORAGE_KEY, params.return_origin);
        } catch {
          // ignore storage errors
        }
      }
    });
  }, []);

  const signInWithPasskey = async () => {
    if (!pendingParams?.return_origin || !isSafeOrigin(pendingParams.return_origin)) {
      return;
    }
    const host = window.location.hostname.toLowerCase();
    const rpId = host === 'localhost' || host === '127.0.0.1'
      ? 'localhost'
      : host === 'mysocial.network' || host.endsWith('.mysocial.network')
        ? 'mysocial.network'
        : host;
    const passkeyProvider = new BrowserPasskeyProvider('MySocial', {
      rp: { id: rpId, name: 'MySocial' },
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 60_000,
    });
    let keypair: PasskeyKeypair;
    try {
      const first = await PasskeyKeypair.signAndRecover(passkeyProvider, crypto.getRandomValues(new Uint8Array(32)));
      const second = await PasskeyKeypair.signAndRecover(passkeyProvider, crypto.getRandomValues(new Uint8Array(32)));
      const publicKey = findCommonPublicKey(first, second);
      keypair = new PasskeyKeypair(publicKey.toRawBytes(), passkeyProvider);
    } catch {
      keypair = await PasskeyKeypair.getPasskeyInstance(passkeyProvider);
    }
    const raw = keypair.getPublicKey().toRawBytes();
    let binary = '';
    for (let i = 0; i < raw.length; i += 1) binary += String.fromCharCode(raw[i]);
    window.opener?.postMessage(
      {
        type: 'MYSOCIAL_AUTH_RESULT',
        passkeyPublicKey: btoa(binary),
        user: { address: keypair.getPublicKey().toMySoAddress() },
        state: pendingParams.state,
        nonce: pendingParams.nonce,
        clientId: pendingParams.client_id,
      },
      pendingParams.return_origin,
    );
    window.close();
  };

  const handleSocialLogin = (provider: AuthProvider) => {
    const url = pendingParams
      ? buildLoginUrlFromParams(pendingParams, provider)
      : buildLoginUrl(provider);
    if (url) {
      setNavigating(provider);
      window.location.href = url;
    }
  };

  if (!pendingParamsLoaded) {
    return (
      <div className="flex flex-col items-center gap-0 pointer-events-auto">
        <Image src="/logo.svg" alt="MySocial" width={64} height={64} priority />
        <LoadingSpinner className="mt-[25vh]" tone="foreground" />
      </div>
    );
  }

  if (!pickerEnabled) {
    return (
      <div className="flex flex-col items-center gap-0 pointer-events-auto">
        <Image src="/logo.svg" alt="MySocial" width={64} height={64} priority />
        <h1 className="text-muted-foreground text-base pt-4">Sign into the</h1>
        <p className="font-chakra-petch text-3xl font-medium text-foreground text-center max-w-md">
          MySocial Testnet
        </p>
        <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center max-w-sm mt-4">
          Set NEXT_PUBLIC_DEV_CLIENT_ID and NEXT_PUBLIC_DEV_CODE_CHALLENGE in .env to enable the login UI.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0 pointer-events-auto">
      <Image src="/logo.svg" alt="MySocial" width={64} height={64} priority />
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-muted-foreground text-base pt-4">Sign into the</h1>
        <p className="font-chakra-petch text-3xl font-medium text-foreground text-center max-w-md">
          MySocial Testnet
        </p>
      </div>

      <div className="w-full max-w-[320px] space-y-2 pt-12">
        {configuredProviders.map((provider) => {
          const url = pendingParams
            ? buildLoginUrlFromParams(pendingParams, provider)
            : buildLoginUrl(provider);
          if (!url) return null;

          const label = `Login with ${PROVIDER_LABELS[provider]}`;
          const isNavigating = navigating === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => handleSocialLogin(provider)}
              disabled={!!navigating}
              className="w-full h-11 flex items-center justify-center gap-4 rounded-md bg-button-hover border border-border text-white font-chakra-petch hover:bg-zinc-800/90 active:bg-button-surface active:border-zinc-800 transition-colors disabled:opacity-50"
            >
              {isNavigating ? (
                <LoadingSpinner className="h-5 w-5" tone="foreground" />
              ) : (
                <Image
                  src={PROVIDER_LOGOS[provider]}
                  alt=""
                  width={20}
                  height={20}
                  className="flex-shrink-0"
                />
              )}
              <span>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => void signInWithPasskey()}
          className="w-full h-11 flex items-center justify-center gap-4 rounded-md bg-button-hover border border-border text-white font-chakra-petch hover:bg-zinc-800/90 active:bg-button-surface active:border-zinc-800 transition-colors"
        >
          <Fingerprint className="h-5 w-5" />
          <span>Sign in with Passkey</span>
        </button>
      </div>

      <div className="relative flex items-center w-full max-w-[320px] py-4">
        <div className="flex-grow border-t border-white/20" />
        <span className="px-3 text-xs font-[var(--font-chakra-petch)] text-muted-foreground">Or continue with</span>
        <div className="flex-grow border-t border-white/20" />
      </div>

      <div className="w-full max-w-[320px] space-y-2">
        <Button
          variant="secondary"
          className="w-full h-11 bg-button-hover border border-border text-white font-chakra-petch text-sm hover:bg-zinc-800/90 active:bg-button-surface active:border-zinc-800 shadow-none"
          asChild
        >
          <Link
            href={
              pendingParams?.return_origin && isSafeOrigin(pendingParams.return_origin)
                ? `/create-wallet?return_origin=${encodeURIComponent(pendingParams.return_origin)}`
                : '/create-wallet'
            }
          >
            <Wallet className="mr-2 h-4 w-4" />
            Create Wallet
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full h-11 font-chakra-petch text-sm text-muted-foreground hover:text-foreground hover:bg-button-hover border border-white/10"
          asChild
        >
          <Link
            href={
              pendingParams?.return_origin && isSafeOrigin(pendingParams.return_origin)
                ? `/import-wallet?return_origin=${encodeURIComponent(pendingParams.return_origin)}`
                : '/import-wallet'
            }
          >
            <Download className="mr-2 h-3 w-3" />
            Import Wallet
          </Link>
        </Button>
      </div>
    </div>
  );
}
