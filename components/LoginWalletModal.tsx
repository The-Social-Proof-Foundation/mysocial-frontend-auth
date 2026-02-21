'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Wallet, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildLoginUrl, isDirectLoginEnabled } from '@/lib/build-login-url';
import { getConfiguredProviders } from '@/lib/providers';
import type { AuthProvider } from '@/lib/params';

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

  const directLoginEnabled = isDirectLoginEnabled();
  const configuredProviders = getConfiguredProviders();

  const handleSocialLogin = (provider: AuthProvider) => {
    const url = buildLoginUrl(provider);
    if (url) {
      setNavigating(provider);
      window.location.href = url;
    }
  };

  if (!directLoginEnabled) {
    return (
      <div className="flex flex-col items-center gap-4 pointer-events-auto">
        <Image src="/logo.svg" alt="MySocial" width={74} height={74} priority />
        <h1 className="text-muted-foreground text-base">Sign into the</h1>
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
    <div className="flex flex-col items-center gap-4 pointer-events-auto">
      <Image src="/logo.svg" alt="MySocial" width={64} height={64} priority />
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-muted-foreground text-base">Sign into the</h1>
        <p className="font-chakra-petch text-3xl font-medium text-foreground text-center max-w-md">
          MySocial Testnet
        </p>
      </div>

      <div className="w-full max-w-[320px] space-y-2 pt-8">
        {configuredProviders.map((provider) => {
          const url = buildLoginUrl(provider);
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

      <div className="relative flex items-center w-full max-w-[320px] py-3">
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
          <Link href="/create-wallet">
            <Wallet className="mr-2 h-4 w-4" />
            Create Wallet
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="w-full h-11 font-chakra-petch text-sm text-muted-foreground hover:text-foreground hover:bg-secondary border border-white/10"
          asChild
        >
          <Link href="/import-wallet">
            <Download className="mr-2 h-3 w-3" />
            Import Wallet
          </Link>
        </Button>
      </div>
    </div>
  );
}
