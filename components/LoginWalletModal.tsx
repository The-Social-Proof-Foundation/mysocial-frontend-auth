'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Wallet, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  facebook: 'Facebook',
  twitch: 'Twitch',
};

const PROVIDER_LOGOS: Record<AuthProvider, string> = {
  google: '/google.svg',
  apple: '/apple.svg',
  facebook: '/facebook.svg',
  twitch: '/twitch.svg',
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
        <Image src="/logo.svg" alt="MySocial" width={74} height={74} priority />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent mt-4" />
      </div>
    );
  }

  if (!pickerEnabled) {
    return (
      <div className="flex flex-col items-center gap-0 pointer-events-auto">
        <Image src="/logo.svg" alt="MySocial" width={74} height={74} priority />
        <h1 className="text-muted-foreground text-base pt-4">Sign into the</h1>
        <p className="font-chakra-petch text-3xl font-medium text-foreground text-center max-w-md">
          MySocial Testnet
        </p>
        <p className="text-sm text-muted-foreground text-center max-w-sm mt-4">
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

      <div className="w-full max-w-[320px] space-y-2 pt-8">
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
              className="w-full h-11 flex items-center justify-center gap-4 rounded-md bg-black border border-white/20 border-1 text-white font-chakra-petch hover:bg-secondary hover:border-white/30 transition-colors disabled:opacity-50"
            >
              {isNavigating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
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
      </div>

      <div className="relative flex items-center w-full max-w-[320px] py-8">
        <div className="flex-grow border-t border-white/20" />
        <span className="px-3 text-xs text-muted-foreground">Or continue with</span>
        <div className="flex-grow border-t border-white/20" />
      </div>

      <div className="w-full max-w-[320px] space-y-2">
        <Button
          variant="secondary"
          className="w-full h-11 bg-black border border-white/20 text-white font-chakra-petch text-sm hover:bg-secondary hover:border-white/30"
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
          className="w-full h-11 font-chakra-petch text-sm text-muted-foreground hover:text-foreground hover:bg-secondary border border-white/10"
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
