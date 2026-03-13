'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Wallet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[420px] rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-2">
            <h1 className="font-chakra-petch text-xl font-semibold text-center">
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
              className="min-h-[100px] font-mono text-sm"
            />
            {error && (
              <p className="text-xs font-[var(--font-chakra-petch)] text-destructive">{error}</p>
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
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

      <Link
        href="/"
        className="mt-6 flex items-center gap-2 text-xs font-[var(--font-chakra-petch)] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
    </div>
  );
}
