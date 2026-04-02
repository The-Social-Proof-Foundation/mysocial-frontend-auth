'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wallet } from 'lucide-react';
import { BackgroundCells } from '@/components/ui/background-ripple-effect';
import { SparklesCore } from '@/components/ui/sparkles';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  importWalletFromMnemonic,
  importWalletFromPrivateKey,
  signMessage,
} from '@/lib/wallet';
import { completeWalletAuthFlow, completeWalletFlow } from '@/lib/wallet-complete';
import { getPendingAuthParams } from '@/lib/auth-actions';
import type { LoginParams } from '@/lib/params';

function buildChallengeMessage(state: string): string {
  const timestamp = Date.now();
  return `Login to MySocial\n${timestamp}\n${state}`;
}

export default function ImportWalletPage() {
  const [input, setInput] = useState('');
  const [pendingParams, setPendingParams] = useState<LoginParams | null | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    getPendingAuthParams().then(setPendingParams);
  }, []);

  const handleImport = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setIsImporting(true);
    setError(null);

    try {
      let address: string;
      let signKey: string;

      if (trimmed.includes(' ')) {
        address = await importWalletFromMnemonic(trimmed);
        signKey = trimmed;
      } else if (trimmed.startsWith('0x') || /^[a-fA-F0-9]{64}$/.test(trimmed)) {
        address = await importWalletFromPrivateKey(trimmed);
        signKey = trimmed;
      } else {
        const keyArray = trimmed.split(',').map(Number);
        if (keyArray.length === 32) {
          address = await importWalletFromPrivateKey(trimmed);
          signKey = trimmed;
        } else {
          throw new Error('Invalid input. Enter a mnemonic phrase (12-24 words) or private key (hex or comma-separated).');
        }
      }

      if (pendingParams === null) {
        setError('Please sign in from the app first.');
        return;
      }

      if (!pendingParams) {
        completeWalletFlow(
          address,
          'import',
          trimmed.includes(' ') ? { mnemonic: trimmed } : { privateKey: trimmed }
        );
        return;
      }

      const message = buildChallengeMessage(pendingParams.state);
      const signature = await signMessage(signKey, message);

      const res = await fetch('/api/auth/wallet-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          message,
          signature,
          state: pendingParams.state,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.message ?? data.error ?? 'Authentication failed';
        setError(errMsg);
        return;
      }

      if (data.success && data.mode && data.returnOrigin) {
        completeWalletAuthFlow(data, trimmed.includes(' ')
          ? { mnemonic: trimmed, source: 'import' }
          : { privateKey: trimmed, source: 'import' });
      } else {
        completeWalletFlow(
          address,
          'import',
          trimmed.includes(' ') ? { mnemonic: trimmed } : { privateKey: trimmed }
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-screen max-w-[100vw] flex-col overflow-x-hidden bg-background">
      <div
        className="absolute top-0 left-0 right-0 w-full h-[60vh] overflow-hidden z-0"
        style={{
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          width: '100vw',
          overflowX: 'hidden',
        }}
      >
        <BackgroundCells className="w-full h-full" />
      </div>

      <div
        className="absolute inset-0 w-full h-[75vh] -translate-y-[100px] z-[1]"
        style={{
          pointerEvents: 'none',
          maskImage:
            'radial-gradient(ellipse 80% 100% at center top, white 10%, white 30%, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 100% at center top, white 10%, white 30%, transparent 70%)',
        }}
      >
        <SparklesCore
          background="transparent"
          minSize={0.35}
          maxSize={0.9}
          particleDensity={35}
          className="w-full h-full pt-12"
          particleColor={['#ffffff', '#f0f9ff', '#ecfdf5', '#22c55e', '#10b981', '#059669']}
          speed={2}
        />
      </div>

      <header className="sticky top-0 z-[100] w-full shrink-0 border-b border-white/10 bg-black/55 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-black/40 pointer-events-auto">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center px-4 pb-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-[var(--font-chakra-petch)] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center p-4 pb-8 pointer-events-none">
        <div className="w-full max-w-[420px] -translate-y-[min(14dvh,4.75rem)] sm:-translate-y-[min(16dvh,5.25rem)] rounded-lg border border-border bg-card p-6 shadow-lg pointer-events-auto">
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <h1 className="font-chakra-petch text-2xl font-semibold text-center">
                Import Wallet
              </h1>
              <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center">
                Enter your mnemonic phrase or private key to restore your wallet.
              </p>
            </div>

            <div className="space-y-2">
              <Textarea
                ref={textareaRef}
                placeholder="Enter mnemonic phrase (12-24 words) or private key"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[100px] font-space-grotesk text-sm transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-white/22"
              />
              {error && (
                <p className="text-xs font-space-grotesk text-destructive">{error}</p>
              )}
            </div>

            {pendingParams === null && (
              <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center">
                Please sign in from the app first.
              </p>
            )}
            <Button
              className="w-full font-chakra-petch py-3"
              onClick={handleImport}
              disabled={isImporting || !input.trim() || pendingParams === null}
            >
              {isImporting ? (
                <>
                  <LoadingSpinner />
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Sign Into Wallet
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
