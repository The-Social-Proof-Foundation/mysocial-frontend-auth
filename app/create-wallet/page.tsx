'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Eye, EyeOff, Download, Wallet } from 'lucide-react';
import { BackgroundCells } from '@/components/ui/background-ripple-effect';
import { SparklesCore } from '@/components/ui/sparkles';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { generateNewWallet, signMessage } from '@/lib/wallet';
import { completeWalletAuthFlow, completeWalletFlow } from '@/lib/wallet-complete';
import { getPendingAuthParams } from '@/lib/auth-actions';
import type { LoginParams } from '@/lib/params';

function buildChallengeMessage(state: string): string {
  const timestamp = Date.now();
  return `Login to MySocial\n${timestamp}\n${state}`;
}

export default function CreateWalletPage() {
  const [pendingParams, setPendingParams] = useState<LoginParams | null | undefined>(undefined);
  const [step, setStep] = useState<'warning' | 'generating' | 'final'>('warning');
  const [wallet, setWallet] = useState<{ address: string; mnemonic: string } | null>(null);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getPendingAuthParams().then(setPendingParams);
  }, []);

  const handleGenerate = async () => {
    setStep('generating');
    setError(null);
    try {
      const result = await generateNewWallet();
      setWallet(result);
      setStep('final');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate wallet');
      setStep('warning');
    }
  };

  const handleGetStarted = async () => {
    if (!wallet) return;

    if (pendingParams === null) {
      setError('Please sign in from the app first.');
      return;
    }

    if (!pendingParams) {
      completeWalletFlow(wallet.address, 'create', { mnemonic: wallet.mnemonic });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const message = buildChallengeMessage(pendingParams.state);
      const signature = await signMessage(wallet.mnemonic, message);

      const res = await fetch('/api/auth/wallet-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: wallet.address,
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
        completeWalletAuthFlow(data, { mnemonic: wallet.mnemonic, source: 'create' });
      } else {
        completeWalletFlow(wallet.address, 'create', { mnemonic: wallet.mnemonic });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setIsSubmitting(false);
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
        {step === 'warning' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <h1 className="font-chakra-petch text-2xl font-semibold text-center">
                Secure Your Recovery Phrase
              </h1>
              <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center">
                Before creating a wallet, understand:
              </p>
            </div>
            <ul className="space-y-2 text-xs font-[var(--font-chakra-petch)] text-muted-foreground">
              <li className="flex gap-2">
                <span>•</span>
                <span>If you lose your recovery phrase, you cannot recover your wallet</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Anyone with your recovery phrase can access your funds</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Store it securely offline and never share it with anyone</span>
              </li>
            </ul>
            {error && (
              <p className="text-xs font-[var(--font-chakra-petch)] text-destructive text-center">{error}</p>
            )}
            <Button
              className="w-full font-chakra-petch py-3 bg-button-surface text-foreground border border-border hover:border-white/15"
              onClick={handleGenerate}
            >
              I Understand
            </Button>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <LoadingSpinner tone="muted" />
          </div>  
        )}

        {step === 'final' && wallet && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-2">
              <h1 className="font-chakra-petch text-2xl font-semibold text-center">
                Your New MySocial Wallet
              </h1>
              <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center">
                Save your recovery phrase in a secure location.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium font-[var(--font-chakra-petch)] text-muted-foreground">Wallet Address</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(wallet.address);
                  }}
                  className="h-6 px-2"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all">
                {wallet.address}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium font-[var(--font-chakra-petch)] text-muted-foreground">Recovery Phrase</label>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMnemonic(!showMnemonic)}
                    className="h-6 px-2"
                  >
                    {showMnemonic ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(wallet.mnemonic)}
                    className="h-6 px-2"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob(
                        [`MySocial Wallet Address:\n${wallet.address}\n\nRecovery Phrase:\n${wallet.mnemonic}`],
                        { type: 'text/plain' }
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'mysocial-wallet-recovery-phrase.txt';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="h-6 px-2"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div
                className={`p-3 bg-muted rounded-lg grid grid-cols-3 gap-2 ${!showMnemonic ? 'blur-sm select-none' : ''}`}
              >
                {wallet.mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-mono w-5 text-right">{i + 1}.</span>
                    <span className="font-mono">{word}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs font-[var(--font-chakra-petch)] text-destructive text-center">{error}</p>
            )}
            <Button
              className="w-full font-chakra-petch py-3 bg-button-surface text-foreground border border-border hover:border-white/15"
              onClick={handleGetStarted}
              disabled={isSubmitting || pendingParams === undefined || pendingParams === null}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Get Started
                </>
              )}
            </Button>
            {pendingParams === null && (
              <p className="text-xs font-[var(--font-chakra-petch)] text-muted-foreground text-center">
                Please sign in from the app first.
              </p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
