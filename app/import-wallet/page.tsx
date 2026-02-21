'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { importWalletFromMnemonic, importWalletFromPrivateKey } from '@/lib/wallet';
import { completeWalletFlow } from '@/lib/wallet-complete';

export default function ImportWalletPage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleImport = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setIsImporting(true);
    setError(null);

    try {
      let address: string;
      let walletData: { mnemonic?: string; privateKey?: string } | undefined;

      if (trimmed.includes(' ')) {
        address = await importWalletFromMnemonic(trimmed);
        walletData = { mnemonic: trimmed };
      } else if (trimmed.startsWith('0x') || /^[a-fA-F0-9]{64}$/.test(trimmed)) {
        address = await importWalletFromPrivateKey(trimmed);
        walletData = { privateKey: trimmed };
      } else {
        const keyArray = trimmed.split(',').map(Number);
        if (keyArray.length === 32) {
          address = await importWalletFromPrivateKey(trimmed);
          walletData = { privateKey: trimmed };
        } else {
          throw new Error('Invalid input. Enter a mnemonic phrase (12-24 words) or private key (hex or comma-separated).');
        }
      }

      completeWalletFlow(address, 'import', walletData);
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
            <p className="text-sm text-muted-foreground text-center">
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
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <Button
            className="w-full font-chakra-petch py-3"
            onClick={handleImport}
            disabled={isImporting || !input.trim()}
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
        className="mt-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
    </div>
  );
}
